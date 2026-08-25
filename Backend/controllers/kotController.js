import mongoose from 'mongoose';
import BillDefault from '../models/Bill.js';
import UserDefault from '../models/User.js';
import SettingDefault from '../models/Setting.js';
import ServiceRequestDefault from '../models/ServiceRequest.js';
import cache from '../utils/cache.js';
import { deductStockForBillItems } from './inventoryController.js';
import { updateTableStatusHelper } from './floorController.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';
import { updateCustomerFromBill, syncCustomer } from './customerController.js';
import { emitNotification, emitDismissNotification } from '../utils/notificationHelper.js';
import { emitSocketEvent } from '../utils/socket.js';
import { printKOTToPrinters } from '../services/printerService.js';
import { getTableMatchCondition, getDynamicTaxRate, getTenantShopName } from '../utils/billHelpers.js';

export const generateKOT = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { items: currentCart } = req.body; // Frontend sends the current cart to be safe

    let bill = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bill = await Bill.findById(id);
    }
    if (!bill && (req.body.tableNo || req.query.tableNo)) {
      const tableNo = req.body.tableNo || req.query.tableNo;
      bill = await Bill.findOne({
        tableNo: getTableMatchCondition(tableNo),
        status: { $in: ['Open', 'Billed'] }
      });
    }
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Accurately synchronize bill.items with currentCart if provided
    if (currentCart && Array.isArray(currentCart)) {
      currentCart.forEach(cItem => {
        const cQty = Math.max(0, parseInt(cItem.quantity !== undefined ? cItem.quantity : 0, 10));
        const bItem = bill.items.find(i => 
          (cItem._id && i._id && i._id.toString() === cItem._id.toString()) ||
          (i.name && cItem.name && i.name.trim().toLowerCase() === cItem.name.trim().toLowerCase())
        );

        if (bItem) {
          bItem.quantity = cQty;
          if (cItem.price !== undefined) bItem.price = Number(cItem.price || 0);
          bItem.total = (bItem.price || 0) * cQty;
          if (cItem.specialNote !== undefined) bItem.specialNote = cItem.specialNote;
        } else if (cQty > 0) {
          bill.items.push({
            name: cItem.name,
            price: Number(cItem.price || 0),
            quantity: cQty,
            total: Number(cItem.price || 0) * cQty,
            specialNote: cItem.specialNote || '',
            printedQuantity: 0,
            status: 'Pending',
            unitStatuses: Array.from({ length: cQty }, () => 'Pending')
          });
        }
      });

      // Any item in bill.items NOT in currentCart:
      // If already printed, set quantity to 0 so reduction logic can scale down KOTs
      // If never printed, remove from bill.items
      bill.items = bill.items.filter(bItem => {
        const stillInCart = currentCart.find(c =>
          (c._id && bItem._id && bItem._id.toString() === c._id.toString()) ||
          (c.name && bItem.name && c.name.trim().toLowerCase() === bItem.name.trim().toLowerCase())
        );
        if (!stillInCart) {
          if ((bItem.printedQuantity || 0) > 0) {
            bItem.quantity = 0;
            bItem.total = 0;
            return true;
          }
          return false;
        }
        return true;
      });
    }

    // Calculate delta and update printed quantities
    const kotItems = [];
    const itemChanges = [];
    let hadQuantityReductions = false;

    for (const item of bill.items) {
      const currentQty = Math.max(0, parseInt(item.quantity || 0, 10));
      const printedQty = Math.max(0, parseInt(item.printedQuantity || 0, 10));
      const newQty = currentQty - printedQty;
      const currentNote = (item.specialNote || '').trim();
      const lastNote = (item.lastPrintedNote || '').trim();
      const noteChanged = currentNote !== lastNote;
      
      console.log(`[generateKOT] item: ${item.name}, currentQty: ${currentQty}, printedQty: ${printedQty}, newQty: ${newQty}, noteChanged: ${noteChanged}, currentNote: '${currentNote}', lastNote: '${lastNote}'`);

      if (newQty > 0 || (newQty === 0 && noteChanged)) {
        const isNoteUpdate = newQty === 0 && Boolean(noteChanged);
        console.log(`[generateKOT] isNoteUpdate: ${isNoteUpdate}`);
        
        if (isNoteUpdate) {
          // Update all previous KOTs for this item with the new note
          if (bill.kots) {
            for (let kot of bill.kots) {
              let kItem = (kot.items || []).find(i => i.name === item.name || (item._id && i._id?.toString() === item._id?.toString()));
              if (kItem) {
                kItem.specialNote = currentNote;
              }
            }
          }
          itemChanges.push({
            name: item.name,
            type: 'note_updated',
            note: currentNote
          });
        }
        
        const kotQty = newQty > 0 ? newQty : currentQty;
        if (kotQty > 0) {
          kotItems.push({
            name: item.name,
            quantity: kotQty,
            specialNote: currentNote,
            isNoteUpdateOnly: isNoteUpdate,
            status: 'Pending',
            preparedQuantity: 0,
            preparingQuantity: 0,
            pendingQuantity: kotQty,
            unitStatuses: Array.from({ length: kotQty }, () => 'Pending')
          });
        }
        if (newQty > 0) {
          itemChanges.push({
            name: item.name,
            type: 'added',
            delta: newQty,
            currentQty,
            previousQty: printedQty
          });
        }
        // Update printed quantity & last printed note
        item.printedQuantity = currentQty;
        item.lastPrintedNote = currentNote;
        if (!item.unitStatuses || item.unitStatuses.length !== currentQty) {
          const prevUnits = item.unitStatuses || [];
          item.unitStatuses = Array.from({ length: currentQty }, (_, idx) => prevUnits[idx] || item.status || 'Pending');
          item.preparedQuantity = item.unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
          item.preparingQuantity = item.unitStatuses.filter(s => s === 'Preparing').length;
          item.pendingQuantity = item.unitStatuses.filter(s => s === 'Pending').length;
        }
      } else if (newQty < 0) {
        // Quantity was reduced (e.g. from 5 to 4 or 5 to 0)
        hadQuantityReductions = true;
        const reducedCount = Math.abs(newQty);
        itemChanges.push({
          name: item.name,
          type: 'reduced',
          reducedQty: reducedCount,
          currentQty,
          previousQty: printedQty
        });

        item.printedQuantity = currentQty;
        item.lastPrintedNote = currentNote;
        item.reducedQuantity = (item.reducedQuantity || 0) + reducedCount;
        item.cancelledQuantity = (item.cancelledQuantity || 0) + reducedCount;

        // Add to kotItems to print cancellation slip
        kotItems.push({
          name: item.name,
          quantity: reducedCount,
          specialNote: `[CANCELLED] ${currentQty === 0 ? 'Full Cancellation' : `Reduced to ${currentQty}`}`,
          isNoteUpdateOnly: true, // Don't save as new KOT to DB
          status: 'Cancelled',
          isCancelled: true
        });

        if (currentQty === 0) {
          item.status = 'Cancelled';
          item.isCancelled = true;
        }

        // Scale down bill item unitStatuses
        if (item.unitStatuses && item.unitStatuses.length > currentQty) {
          item.unitStatuses = item.unitStatuses.slice(0, currentQty);
          item.preparedQuantity = item.unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
          item.preparingQuantity = item.unitStatuses.filter(s => s === 'Preparing').length;
          item.pendingQuantity = item.unitStatuses.filter(s => s === 'Pending').length;
        }

        // Adjust existing KOTs for this item so total active quantity across kots equals currentQty
        if (bill.kots && Array.isArray(bill.kots)) {
          let targetRemaining = currentQty;
          for (let k = bill.kots.length - 1; k >= 0; k--) {
            const kot = bill.kots[k];
            const kItem = (kot.items || []).find(i => i.name === item.name || (item._id && i._id?.toString() === item._id?.toString()));
            if (kItem) {
              if (targetRemaining <= 0) {
                kItem.quantity = 0;
                kItem.status = 'Cancelled';
                kItem.isCancelled = true;
                kItem.reducedQuantity = (kItem.reducedQuantity || 0) + reducedCount;
                kItem.unitStatuses = [];
                kItem.pendingQuantity = 0;
                kItem.preparingQuantity = 0;
                kItem.preparedQuantity = 0;
              } else {
                const kQty = Math.min(kItem.quantity, targetRemaining);
                kItem.reducedQuantity = (kItem.reducedQuantity || 0) + (kItem.quantity - kQty);
                kItem.quantity = kQty;
                targetRemaining -= kQty;
                // Reset all remaining units to 'Pending' so kitchen sees the updated order in KDS
                kItem.status = 'Pending';
                kItem.unitStatuses = Array.from({ length: kQty }, () => 'Pending');
                kItem.preparedQuantity = 0;
                kItem.preparingQuantity = 0;
                kItem.pendingQuantity = kQty;
              }
            }
          }
        }
      }
    }

    if (kotItems.length === 0 && !hadQuantityReductions) {
      return res.status(400).json({ message: 'No new items or changes to print KOT for.' });
    }

    let savedKOT = null;
    let kotPayload = null;

    const itemsToSave = kotItems.filter(k => !k.isNoteUpdateOnly);

    if (itemsToSave.length > 0) {
      // Generate KOT number (e.g., "KOT-1" relative to this bill)
      const kotNumber = `KOT-${(bill.kots ? bill.kots.length : 0) + 1}`;
      const newKOT = {
        kotNumber,
        items: itemsToSave,
        createdAt: new Date()
      };
      bill.kots.push(newKOT);
      savedKOT = bill.kots[bill.kots.length - 1];
      kotPayload = {
        _id: savedKOT._id,
        kotId: savedKOT._id,
        kotNumber: savedKOT.kotNumber,
        items: savedKOT.items,
        createdAt: savedKOT.createdAt,
        tableNo: bill.tableNo,
        billType: bill.billType,
        orderId: bill._id
      };
    }

    // Recalculate bill financial totals accurately
    const subtotal = bill.items.reduce((sum, item) => {
      if (item.isCancelled || item.status === 'Cancelled') return sum;
      const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
      return sum + (Number(item.price || 0) * activeQty);
    }, 0);

    const dType = bill.discountType || 'flat';
    const dValue = bill.discountValue || 0;
    let calculatedDiscount = 0;
    if (dType === 'percentage') {
      calculatedDiscount = (subtotal * dValue) / 100;
    } else if (dType === 'complimentary') {
      calculatedDiscount = subtotal;
    } else {
      calculatedDiscount = dValue;
    }

    const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
    const tRate = (bill.tax !== undefined && bill.tax !== null && Number(bill.tax) >= 0) 
      ? Number(bill.tax) 
      : await getDynamicTaxRate(req);
    const calculatedTax = (taxableAmount * tRate) / 100;
    const calculatedTotal = Math.round(taxableAmount + calculatedTax);

    bill.subtotal = subtotal;
    bill.discount = calculatedDiscount;
    bill.tax = tRate;
    bill.taxBreakdown = {
      cgst: Number(((subtotal * (tRate / 2)) / 100).toFixed(2)),
      sgst: Number(((subtotal * (tRate / 2)) / 100).toFixed(2)),
      igst: 0
    };
    bill.total = calculatedTotal;

    bill.markModified('items');
    bill.markModified('kots');
    await bill.save();

    // Clear caches for instant multi-page accuracy
    cache.clear('dailyStats');
    cache.clear('openOrders');

    if (bill.billType === 'Dine-In') {
      updateTableStatusHelper(req, bill.tableNo, 'Occupied', bill._id).catch(() => {});
    }

    const isUpdate = (bill.kots ? bill.kots.length : 0) > 1 || hadQuantityReductions || itemChanges.some(c => c.type === 'note_updated');
    const reducedItems = itemChanges.filter(c => c.type === 'reduced');
    const addedItems = itemChanges.filter(c => c.type === 'added');
    const noteUpdatedItems = itemChanges.filter(c => c.type === 'note_updated');

    let dynamicMessage = `KOT updated for Table ${bill.tableNo}`;
    if (reducedItems.length > 0) {
      const reducedText = reducedItems.map(c => `${c.name} reduced by ${c.reducedQty}x (Now ${c.currentQty}x)`).join(', ');
      dynamicMessage = `Table ${bill.tableNo}: ${reducedText}`;
    } else if (addedItems.length > 0) {
      const addedText = addedItems.map(c => `${c.name} +${c.delta}x (Now ${c.currentQty}x)`).join(', ');
      dynamicMessage = `Table ${bill.tableNo}: ${addedText}`;
    } else if (noteUpdatedItems.length > 0) {
      const noteText = noteUpdatedItems.map(c => `${c.name} Note Updated`).join(', ');
      dynamicMessage = `Table ${bill.tableNo}: ${noteText}`;
    }

    if (kotPayload) {
      emitSocketEvent(req, 'newKOT', { tableNo: bill.tableNo, kot: kotPayload, billId: bill._id, order: bill, isUpdate });
      emitSocketEvent(req, 'kotQuantityUpdated', { 
        tableNo: bill.tableNo, 
        orderId: bill._id, 
        kot: kotPayload, 
        isUpdate, 
        changes: itemChanges,
        message: dynamicMessage 
      });
      
      const notifTitle = isUpdate ? (reducedItems.length > 0 ? 'Item Quantity Reduced' : 'KOT Quantity Updated') : 'New KOT Fired';
      emitNotification(req, notifTitle, dynamicMessage, isUpdate ? 'warning' : 'info', ['Chef', 'Manager', 'Admin', 'Captain']);

      // Trigger physical network thermal printing to configured IP printers
      printKOTToPrinters(req, bill, kotPayload.kotNumber, kotItems).catch(err => {
        console.error('[KOT Print Error]:', err.message);
      });
    } else if (hadQuantityReductions || noteUpdatedItems.length > 0) {
      emitSocketEvent(req, 'kotQuantityUpdated', { 
        tableNo: bill.tableNo, 
        orderId: bill._id, 
        isReduction: hadQuantityReductions, 
        changes: itemChanges,
        message: dynamicMessage 
      });
      emitNotification(req, hadQuantityReductions ? 'Item Quantity Reduced' : 'KOT Note Updated', dynamicMessage, 'warning', ['Chef', 'Manager', 'Admin', 'Captain']);
      
      if (kotItems.length > 0) {
        // There were note updates to print, but no new KOT saved to DB
        const dummyKotNumber = `KOT UPDATE`;
        printKOTToPrinters(req, bill, dummyKotNumber, kotItems).catch(err => {
          console.error('[KOT Print Error]:', err.message);
        });
      }
    }

    // If we only have note updates or cancellations, synthesize a payload for the frontend popup
    let responseKotPayload = kotPayload;
    if (!responseKotPayload && kotItems.length > 0) {
      responseKotPayload = {
        kotNumber: 'KOT UPDATE',
        items: kotItems,
        createdAt: new Date(),
        tableNo: bill.tableNo,
        billType: bill.billType,
        orderId: bill._id
      };
    }

    emitSocketEvent(req, 'orderUpdated', { tableNo: bill.tableNo, status: bill.status, order: bill, total: bill.total });

    res.status(200).json({
      message: kotPayload ? 'KOT generated successfully' : 'KOT updated successfully',
      kot: responseKotPayload || { items: bill.items, tableNo: bill.tableNo, orderId: bill._id },
      bill: bill
    });
  } catch (error) {
    console.error('Error generating KOT:', error);
    res.status(500).json({ message: 'Error generating KOT', error: error.message });
  }
};

// Get all KOTs generated today (or specific date) across all bills
// Get all KOTs generated today (or specific date) across all bills
// Get all KOTs generated today (or specific date) across all bills - Ultra-fast & reliable


export const getTodayKOTs = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { date, search } = req.query;

    let targetDateStr = '';
    let queryStart, queryEnd;

    if (date && typeof date === 'string' && date.trim()) {
      const trimmed = date.trim();
      if (trimmed.includes('-')) {
        const parts = trimmed.split('-');
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          targetDateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          const y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2]);
          queryStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 24 * 3600 * 1000);
          queryEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) + 24 * 3600 * 1000);
        } else if (parts[2].length === 4) {
          // DD-MM-YYYY
          targetDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          const y = Number(parts[2]), m = Number(parts[1]), d = Number(parts[0]);
          queryStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 24 * 3600 * 1000);
          queryEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) + 24 * 3600 * 1000);
        }
      }
    }

    if (!targetDateStr) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      targetDateStr = `${y}-${m}-${d}`;
      queryStart = new Date(Date.UTC(y, now.getMonth(), now.getDate(), 0, 0, 0, 0) - 24 * 3600 * 1000);
      queryEnd = new Date(Date.UTC(y, now.getMonth(), now.getDate(), 23, 59, 59, 999) + 24 * 3600 * 1000);
    }

    // Find bills that have KOTs
    const bills = await Bill.find({
      $or: [
        { 'kots.0': { $exists: true } },
        { createdAt: { $gte: queryStart, $lte: queryEnd } },
        { updatedAt: { $gte: queryStart, $lte: queryEnd } }
      ]
    })
    .select('tableNo billType kots status items createdAt updatedAt')
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(500)
    .lean();

    // Flatten KOTs into a single array, validating date match for each KOT
    let allKOTs = [];
    (bills || []).forEach(bill => {
      const itemCancelMap = {};
      (bill.items || []).forEach(i => {
        if (i.name) {
          itemCancelMap[i.name] = {
            isCancelled: i.isCancelled || false,
            cancelledQuantity: i.cancelledQuantity || 0
          };
        }
      });

      if (bill.kots && Array.isArray(bill.kots) && bill.kots.length > 0) {
        bill.kots.forEach(kot => {
          // If targetDateStr is set, check if KOT matches targetDateStr in either local or UTC time
          if (targetDateStr) {
            const rawDate = kot.createdAt || bill.createdAt || bill.updatedAt;
            if (rawDate) {
              const kotD = new Date(rawDate);
              if (!isNaN(kotD.getTime())) {
                const kotLocalStr = `${kotD.getFullYear()}-${String(kotD.getMonth() + 1).padStart(2, '0')}-${String(kotD.getDate()).padStart(2, '0')}`;
                const kotUtcStr = kotD.toISOString().split('T')[0];
                const matchesDate = kotLocalStr === targetDateStr || kotUtcStr === targetDateStr;
                
                if (!matchesDate) {
                  return;
                }
              }
            }
          }

          const processedItems = (kot.items || [])
            .map(kItem => {
              const itemStatus = itemCancelMap[kItem.name];
              const isCancelled = kItem.status === 'Cancelled' || kItem.isCancelled || (itemStatus && itemStatus.isCancelled);
              const orderItem = (bill.items || []).find(i => i.name === kItem.name || (kItem._id && i._id?.toString() === kItem._id?.toString()));
              
              const qty = Math.max(0, parseInt(kItem.quantity !== undefined ? kItem.quantity : 0, 10));
              let unitStatuses = kItem.unitStatuses;
              if (!unitStatuses || !Array.isArray(unitStatuses) || unitStatuses.length !== qty) {
                unitStatuses = Array.from({ length: qty }, () => kItem.status || 'Pending');
              }

              const preparedQty = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
              const preparingQty = unitStatuses.filter(s => s === 'Preparing').length;
              const pendingQty = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

              return {
                ...kItem,
                quantity: qty,
                specialNote: kItem.specialNote || orderItem?.specialNote || '',
                isCancelled: isCancelled,
                status: isCancelled ? 'Cancelled' : (kItem.status || 'Pending'),
                cancelledQuantity: isCancelled ? (itemStatus?.cancelledQuantity || kItem.quantity) : (kItem.cancelledQuantity || 0),
                unitStatuses,
                preparedQuantity: preparedQty,
                preparingQuantity: preparingQty,
                pendingQuantity: pendingQty
              };
            })
            // Skip note-only update items and include cancelled items for history
            .filter(item => !item.isNoteUpdateOnly && (item.quantity > 0 || item.isCancelled));


          allKOTs.push({
            ...kot,
            _id: kot._id || `${bill._id}_${kot.kotNumber}`,
            kotId: kot._id,
            items: processedItems,
            billId: bill._id,
            tableNo: bill.tableNo,
            billType: bill.billType,
            billStatus: bill.status,
            createdAt: kot.createdAt || bill.createdAt || bill.updatedAt
          });
        });
      }
    });

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      allKOTs = allKOTs.filter(kot => 
        (kot.kotNumber && kot.kotNumber.toLowerCase().includes(searchLower)) ||
        (kot.tableNo && kot.tableNo.toLowerCase().includes(searchLower))
      );
    }

    // Sort by KOT creation time descending
    allKOTs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json(allKOTs || []);
  } catch (error) {
    console.error('Error fetching today KOTs:', error);
    res.status(200).json([]);
  }
};



// Reopen a Billed order back to Open state


export const getActiveKOTs = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    // Fetch all open/billed orders that have KOTs
    const activeOrders = await Bill.find({
      status: { $in: ['Open', 'Billed'] },
      kots: { $not: { $size: 0 } }
    }).sort({ updatedAt: 1 }).lean();

    const allKots = [];
    activeOrders.forEach(order => {
      // Build a map of item status + EXPECTED total quantity from order.items (source of truth)
      // printedQuantity = how many units were actually sent to kitchen
      const itemInfoMap = {};
      (order.items || []).forEach(i => {
        if (i.name) {
          itemInfoMap[i.name.trim().toLowerCase()] = {
            isCancelled: i.isCancelled || false,
            cancelledQuantity: i.cancelledQuantity || 0,
            // printedQuantity is the absolute max units this item should show across ALL KOTs
            totalExpected: Math.max(0, parseInt(i.printedQuantity || i.quantity || 0, 10)),
            allocated: 0, // track how many units we've already included in KOTs
            specialNote: i.specialNote || '',
            reducedQuantity: Math.max(0, parseInt(i.reducedQuantity || i.cancelledQuantity || 0, 10))
          };
        }
      });

      order.kots.forEach(kot => {
        const processedItems = (kot.items || [])
          .filter(kItem => {
            // Skip items explicitly flagged as note-only updates
            if (kItem.isNoteUpdateOnly) return false;
            const key = (kItem.name || '').trim().toLowerCase();
            const info = itemInfoMap[key];
            const isCancelled = kItem.status === 'Cancelled' || kItem.isCancelled || (info && info.isCancelled);
            
            // If item is cancelled in the order or KOT, include it as cancelled entry
            if (isCancelled) return true;

            const qty = Math.max(0, parseInt(kItem.quantity || 0, 10));
            if (qty <= 0) return false;
            // Skip this KOT entry if we've already accounted for all expected units of this item
            if (info && info.allocated >= info.totalExpected) return false;
            return true;
          })
          .map(kItem => {
            const key = (kItem.name || '').trim().toLowerCase();
            const info = itemInfoMap[key];
            const orderItem = (order.items || []).find(i => i.name === kItem.name || (kItem._id && i._id?.toString() === kItem._id?.toString()));
            const isCancelled = kItem.status === 'Cancelled' || kItem.isCancelled || (info && info.isCancelled);

            if (isCancelled) {
              const cancelQty = Math.max(1, parseInt(info?.cancelledQuantity || kItem.cancelledQuantity || kItem.quantity || 1, 10));
              return {
                ...kItem,
                quantity: 0,
                cancelledQuantity: cancelQty,
                reducedQuantity: 0,
                specialNote: info?.specialNote || kItem.specialNote || '',
                isCancelled: true,
                status: 'Cancelled',
                unitStatuses: [],
                preparedQuantity: 0,
                preparingQuantity: 0,
                pendingQuantity: 0
              };
            }

            let qty = Math.max(0, parseInt(kItem.quantity || 0, 10));

            // Clamp qty so total across KOTs never exceeds order.items.printedQuantity
            if (info) {
              const remaining = info.totalExpected - info.allocated;
              qty = Math.min(qty, remaining);
              info.allocated += qty;
            }

            let unitStatuses = kItem.unitStatuses;
            if (!unitStatuses || !Array.isArray(unitStatuses) || unitStatuses.length !== qty) {
              unitStatuses = Array.from({ length: qty }, () => kItem.status || 'Pending');
            } else if (unitStatuses.length > qty) {
              unitStatuses = unitStatuses.slice(0, qty);
            }

            const preparedQty = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
            const preparingQty = unitStatuses.filter(s => s === 'Preparing').length;
            const pendingQty = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

            const reducedQty = Math.max(0, parseInt(info?.reducedQuantity || orderItem?.reducedQuantity || orderItem?.cancelledQuantity || kItem.reducedQuantity || kItem.cancelledQuantity || 0, 10));

            // Use note from order.items as the current source of truth (may have been updated without a new KOT)
            const currentNote = info?.specialNote || kItem.specialNote || orderItem?.specialNote || '';

            return {
              ...kItem,
              quantity: qty,
              reducedQuantity: reducedQty,
              specialNote: currentNote,
              isCancelled: false,
              status: kItem.status || 'Pending',
              cancelledQuantity: kItem.cancelledQuantity || 0,
              unitStatuses,
              preparedQuantity: preparedQty,
              preparingQuantity: preparingQty,
              pendingQuantity: pendingQty
            };
          })
          .filter(kItem => kItem.quantity > 0 || kItem.isCancelled); // Keep active items and cancelled items

        // Include KOTs that have active items needing kitchen preparation or cancelled items
        const hasActiveKitchenItems = processedItems.some(item => (
          item.status === 'Pending' ||
          item.status === 'Preparing' ||
          item.pendingQuantity > 0 ||
          item.preparingQuantity > 0 ||
          (item.reducedQuantity > 0 && item.pendingQuantity > 0) ||
          item.isCancelled
        ));
        if (hasActiveKitchenItems) {
          allKots.push({
            orderId: order._id,
            tableNo: order.tableNo,
            billType: order.billType,
            orderSource: order.orderSource,
            kotId: kot._id,
            kotNumber: kot.kotNumber,
            items: processedItems,
            createdAt: kot.createdAt
          });
        }
      });
    });

    res.json(allKots);
  } catch (error) {
    console.error('Error fetching active KOTs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};




export const updateKOTItemStatus = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { orderId, kotId, itemId, status, unitIndex, unitStatuses: customUnitStatuses } = req.body;

    const order = await Bill.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let kot = order.kots.id(kotId);
    if (!kot) {
      kot = order.kots.find(k => k._id?.toString() === kotId?.toString() || k.kotNumber === kotId);
    }
    if (!kot && order.kots.length > 0) {
      kot = order.kots.find(k => k.items && k.items.some(i => i._id?.toString() === itemId?.toString() || i.name === itemId)) || order.kots[0];
    }
    if (!kot) return res.status(404).json({ message: 'KOT not found' });

    let item = kot.items.id(itemId);
    if (!item) {
      item = kot.items.find(i => i._id?.toString() === itemId?.toString() || i.name === itemId);
    }
    if (!item) {
      for (const k of order.kots) {
        item = k.items.find(i => i._id?.toString() === itemId?.toString() || i.name === itemId);
        if (item) break;
      }
    }
    if (!item) return res.status(404).json({ message: 'Item not found in KOT' });

    const qty = Math.max(0, parseInt(item.quantity || 0, 10) || 1);
    if (!item.unitStatuses || !Array.isArray(item.unitStatuses) || item.unitStatuses.length !== qty) {
      item.unitStatuses = Array.from({ length: qty }, () => item.status || 'Pending');
    }

    if (customUnitStatuses && Array.isArray(customUnitStatuses)) {
      item.unitStatuses = customUnitStatuses;
    } else if (unitIndex !== undefined && unitIndex !== null && unitIndex !== 'all') {
      const idx = Number(unitIndex);
      if (idx >= 0 && idx < item.unitStatuses.length) {
        item.unitStatuses[idx] = status;
      }
    } else if (status) {
      // Set all units
      item.unitStatuses = Array.from({ length: qty }, () => status);
    }

    // Recalculate portion counts
    const preparedCount = item.unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
    const preparingCount = item.unitStatuses.filter(s => s === 'Preparing').length;
    const pendingCount = item.unitStatuses.filter(s => s === 'Pending').length;

    item.preparedQuantity = preparedCount;
    item.preparingQuantity = preparingCount;
    item.pendingQuantity = pendingCount;

    // Determine overall item status
    let computedItemStatus = 'Pending';
    if (preparedCount === qty) {
      computedItemStatus = 'Ready';
    } else if (preparingCount > 0 || preparedCount > 0) {
      computedItemStatus = 'Preparing';
    } else {
      computedItemStatus = 'Pending';
    }
    item.status = computedItemStatus;

    // Sync to order.items
    if (order.items && Array.isArray(order.items)) {
      const orderItem = order.items.find(i => i._id?.toString() === itemId?.toString() || i.name === item.name);
      if (orderItem) {
        orderItem.status = computedItemStatus;
        orderItem.unitStatuses = [...item.unitStatuses];
        orderItem.preparedQuantity = preparedCount;
        orderItem.preparingQuantity = preparingCount;
        orderItem.pendingQuantity = pendingCount;
        order.markModified('items');
      }
    }

    order.markModified('kots');
    await order.save();

    emitSocketEvent(req, 'kotUpdated', { 
      orderId, 
      kotId, 
      itemId, 
      status: computedItemStatus, 
      unitStatuses: item.unitStatuses,
      preparedQuantity: preparedCount,
      preparingQuantity: preparingCount,
      pendingQuantity: pendingCount,
      tableNo: order.tableNo, 
      itemName: item.name 
    });

    emitSocketEvent(req, 'orderUpdated', {
      tableNo: order.tableNo,
      status: order.status,
      order
    });
    
    if (computedItemStatus === 'Preparing') {
      const cleanTable = order.tableNo.replace('Table ', '');
      emitNotification(req, 'KOT Accepted', `Chef accepted KOT for Table ${cleanTable} - ${item.name}`, 'info', ['Captain', 'Manager', 'Admin']);
    } else if (computedItemStatus === 'Ready') {
      const cleanTable = order.tableNo.replace('Table ', '');
      emitSocketEvent(req, 'foodReady', {
        orderId,
        kotId,
        itemId,
        tableNo: order.tableNo,
        itemName: item.name
      });
      emitNotification(req, 'Food Ready', `${item.name} is ready for Table ${cleanTable}`, 'success', ['Captain', 'Manager', 'Admin']);
    }

    res.json({ message: 'Item status updated successfully', kot, item });
  } catch (error) {
    console.error('Error updating KOT item status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



export const updateItemPrepTime = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { orderId, kotId, itemId, prepTimeMinutes, itemName } = req.body;

    const order = await Bill.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let updated = false;

    const prepStartTime = new Date();

    // Update in bill.items
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(i => {
        if (i._id?.toString() === itemId?.toString() || (itemName && i.name === itemName)) {
          i.prepTimeMinutes = Number(prepTimeMinutes);
          i.prepStartTime = prepStartTime;
          updated = true;
        }
      });
      order.markModified('items');
    }

    // Update in bill.kots
    if (order.kots && Array.isArray(order.kots)) {
      order.kots.forEach(kot => {
        if (!kotId || kot._id?.toString() === kotId?.toString()) {
          kot.items?.forEach(i => {
            if (i._id?.toString() === itemId?.toString() || (itemName && i.name === itemName)) {
              i.prepTimeMinutes = Number(prepTimeMinutes);
              i.prepStartTime = prepStartTime;
              updated = true;
            }
          });
        }
      });
      order.markModified('kots');
    }

    await order.save();

    emitSocketEvent(req, 'kotUpdated', { orderId, kotId, itemId, prepTimeMinutes, prepStartTime, itemName });
    emitSocketEvent(req, 'prepTimeUpdated', { orderId, tableNo: order.tableNo, itemId, itemName, prepTimeMinutes, prepStartTime });
    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: order.status });

    res.json({ message: 'Prep time updated successfully', prepTimeMinutes, prepStartTime });
  } catch (error) {
    console.error('Error updating prep time:', error);
    res.status(500).json({ message: 'Server error updating prep time' });
  }
};

// Get all edited bills for the Edited Bills history page - Optimized with lean query


export const syncOrderKotsWithItems = (order) => {
  if (!order || !order.kots || !Array.isArray(order.kots) || order.kots.length === 0) return;

  (order.items || []).forEach(item => {
    const currentQty = item.isCancelled ? 0 : Math.max(0, parseInt(item.quantity || 0, 10) - parseInt(item.cancelledQuantity || 0, 10));
    let targetRemaining = currentQty;

    for (let k = order.kots.length - 1; k >= 0; k--) {
      const kot = order.kots[k];
      const kItem = (kot.items || []).find(i => 
        (item._id && i._id && i._id.toString() === item._id.toString()) ||
        (i.name && item.name && i.name.trim().toLowerCase() === item.name.trim().toLowerCase())
      );
      if (kItem) {
        if (targetRemaining <= 0) {
          kItem.quantity = 0;
          kItem.status = 'Cancelled';
          kItem.isCancelled = true;
          kItem.unitStatuses = [];
          kItem.pendingQuantity = 0;
          kItem.preparingQuantity = 0;
          kItem.preparedQuantity = 0;
        } else {
          const kQty = Math.min(kItem.quantity, targetRemaining);
          kItem.quantity = kQty;
          targetRemaining -= kQty;
          kItem.unitStatuses = (kItem.unitStatuses || []).slice(0, kQty);
          while (kItem.unitStatuses.length < kQty) {
            kItem.unitStatuses.push(kItem.status || 'Pending');
          }
          kItem.preparedQuantity = kItem.unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
          kItem.preparingQuantity = kItem.unitStatuses.filter(s => s === 'Preparing').length;
          kItem.pendingQuantity = kItem.unitStatuses.filter(s => s === 'Pending').length;
        }
      }
    }
  });

  order.kots.forEach(kot => {
    (kot.items || []).forEach(kItem => {
      const exists = (order.items || []).some(i => 
        (kItem._id && i._id && i._id.toString() === kItem._id.toString()) ||
        (i.name && kItem.name && i.name.trim().toLowerCase() === kItem.name.trim().toLowerCase())
      );
      if (!exists) {
        kItem.quantity = 0;
        kItem.status = 'Cancelled';
        kItem.isCancelled = true;
        kItem.unitStatuses = [];
      }
    });
  });
};

// Create or Update Order (Open Status)


export const resolveItemCancel = async (req, res) => {
  try {
    const TenantBill = getTenantModel(req, 'Bill', BillDefault);
    const { orderId, itemId, action } = req.body; // action: 'accept' or 'reject'

    if (!orderId || !itemId || !action) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const bill = await TenantBill.findById(orderId);
    if (!bill) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const item = bill.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    if (action === 'accept') {
      const cancelQty = item.cancellationRequestedQty || item.quantity;
      item.cancelledQuantity = (item.cancelledQuantity || 0) + cancelQty;
      
      if (item.cancelledQuantity >= item.quantity) {
        item.isCancelled = true;
      }
      
      item.cancellationRequested = false;
      item.cancellationRequestedQty = 0;
      
      // Recalculate subtotal
      bill.subtotal = bill.items.reduce((acc, i) => {
        if (i.isCancelled) return acc;
        const activeQty = i.quantity - (i.cancelledQuantity || 0);
        return acc + (i.price * activeQty);
      }, 0);
      
      const uncancelledItemsCount = bill.items.filter(i => !i.isCancelled).length;
      const originalSubtotal = bill.subtotal + (item.price * cancelQty); // Approximate previous subtotal for tax ratio
      
      if (uncancelledItemsCount === 0 || bill.subtotal === 0) {
        bill.tax = 0;
        bill.taxBreakdown = { cgst: 0, sgst: 0, igst: 0 };
        bill.total = 0;
        if (uncancelledItemsCount === 0) bill.status = 'Cancelled';
      } else {
        const dynamicTaxRate = await getDynamicTaxRate(req);
        const activeTaxRate = (bill.tax && bill.tax > 0) ? bill.tax : dynamicTaxRate;
        const taxAmount = Number(((bill.subtotal * activeTaxRate) / 100).toFixed(2));
        bill.tax = activeTaxRate;
        bill.taxBreakdown = {
          cgst: Number(((bill.subtotal * (activeTaxRate / 2)) / 100).toFixed(2)),
          sgst: Number(((bill.subtotal * (activeTaxRate / 2)) / 100).toFixed(2)),
          igst: 0
        };
        bill.total = Math.round(bill.subtotal + taxAmount - (bill.discountValue || 0));
      }
      
      bill.isEdited = true;
      
      // Update inside bill.kots array
      if (bill.kots && Array.isArray(bill.kots)) {
        bill.kots.forEach(kot => {
          if (kot.items && Array.isArray(kot.items)) {
            kot.items.forEach(kItem => {
              if (kItem.name === item.name || (itemId && kItem._id?.toString() === itemId.toString())) {
                if (item.isCancelled) {
                  kItem.status = 'Cancelled';
                  kItem.isCancelled = true;
                }
                kItem.cancelledQuantity = (kItem.cancelledQuantity || 0) + cancelQty;
              }
            });
          }
        });
        bill.markModified('kots');
      }
    } else {
      item.cancellationRequested = false;
      item.cancellationRequestedQty = 0;
      item.cancellationRejected = true;
    }

    bill.markModified('items');
    await bill.save();

    const io = req.app?.locals?.io;
    const tenantDb = req.headers['x-tenant-db'];

    if (io && tenantDb) {
      // Notify customer UI
      io.to(tenantDb).emit('cancellationResolved', { 
        orderId, 
        itemId, 
        action, 
        tableNo: bill.tableNo,
        itemName: item.name 
      });
      // Update POS/Kitchen screens
      io.to(tenantDb).emit('orderUpdated', { tableNo: bill.tableNo, status: bill.status });
    }

    // ⚡ Dismiss & permanently delete the cancellation request notification from DB & all Admin/Captain panels
    await emitDismissNotification(req, {
      type: 'cancel_item_request',
      orderId,
      itemId,
      itemName: item.name,
      tableNo: bill.tableNo
    });

    res.status(200).json({ message: `Cancellation ${action}ed successfully`, bill });
  } catch (error) {
    console.error('Error resolving item cancel:', error);
    res.status(500).json({ message: 'Server error while resolving item cancellation' });
  }
};

/**
 * Fetch currently active/pending notifications from the database for instant sync on all devices (APK, Desktop, Web)
 */
import { NotificationDefault } from '../models/Notification.js';