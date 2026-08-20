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

// Helper to get indexed clean match for table/space variations (e.g. "Ground Floor - Cabin 1" vs "Ground Floor - Table 1" vs "Table 1")
const getTableMatchCondition = (tblStr) => {
  if (!tblStr) return tblStr;
  const trimmed = tblStr.trim();
  
  // If floor prefix exists (e.g. "Ground Floor - Cabin 1", "First Floor - Table 2", "Ground Floor - H-1")
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    const floorPart = parts[0].trim();
    const tablePart = parts.slice(1).join(' - ').trim();
    
    const escapedFloor = floorPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedTable = tablePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const patterns = [];
    // 1. Exact match with floor: "Ground Floor - H-1"
    patterns.push(`^${escapedFloor}\\s*-\\s*${escapedTable}$`);
    // 2. Bare match without floor: "H-1"
    patterns.push(`^${escapedTable}$`);
    
    // 3. If standard space type (e.g. "Table 1", "Cabin 2", "Sofa 3", "Room 4", "Bar 5")
    const standardMatch = tablePart.match(/^(Table|Cabin|Sofa|Room|Bar)\s*0*(\d+)$/i);
    if (standardMatch) {
      const type = standardMatch[1];
      const num = parseInt(standardMatch[2], 10);
      const firstLetter = type.charAt(0).toUpperCase();
      patterns.push(`^${escapedFloor}\\s*-\\s*(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
      patterns.push(`^(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
    } else {
      // If tablePart is a custom letter/prefix and number (e.g. "H-1", "H1", "M-2")
      const letterNumMatch = tablePart.match(/^([A-Za-z]+)-?0*(\d+)$/);
      if (letterNumMatch) {
        const letter = letterNumMatch[1];
        const num = parseInt(letterNumMatch[2], 10);
        patterns.push(`^${escapedFloor}\\s*-\\s*${letter}-?0*${num}$`);
        patterns.push(`^${letter}-?0*${num}$`);
      }
    }
    
    return new RegExp(`(?:${patterns.join('|')})`, 'i');
  }

  // If no floor prefix (e.g. "Table 8", "Cabin 1", "Sofa 3", "H-1"):
  const escapedTrimmed = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [];
  patterns.push(`^${escapedTrimmed}$`);
  patterns.push(`^.*?\\s*-\\s*${escapedTrimmed}$`);
  
  const standardMatch = trimmed.match(/^(Table|Cabin|Sofa|Room|Bar)\s*0*(\d+)$/i);
  if (standardMatch) {
    const type = standardMatch[1];
    const num = parseInt(standardMatch[2], 10);
    const firstLetter = type.charAt(0).toUpperCase();
    patterns.push(`^(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
    patterns.push(`^.*?\\s*-\\s*(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
  } else {
    const letterNumMatch = trimmed.match(/^([A-Za-z]+)-?0*(\d+)$/);
    if (letterNumMatch) {
      const letter = letterNumMatch[1];
      const num = parseInt(letterNumMatch[2], 10);
      patterns.push(`^${letter}-?0*${num}$`);
      patterns.push(`^.*?\\s*-\\s*${letter}-?0*${num}$`);
    }
  }
  
  return new RegExp(`(?:${patterns.join('|')})`, 'i');
};


// In-memory cache for dynamic tax rate per tenant DB with 60s TTL
const taxRateCache = new Map();

// Helper to dynamically get active tax rate from restaurantSettings in DB
const getDynamicTaxRate = async (req) => {
  try {
    const tenantDb = req.tenantDb || req.headers['x-tenant-db'] || req.user?.db || 'default';
    const cached = taxRateCache.get(tenantDb);
    if (cached && (Date.now() - cached.time < 60000)) {
      return cached.rate;
    }

    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).maxTimeMS(600).lean().catch(() => null);
    let s = {};
    if (settingsDoc?.value) {
      s = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
    }
    let tot = 0;
    if (s.enableCgst) {
      tot += Number(s.cgstRate || 0);
    }
    if (s.enableSgst) {
      tot += Number(s.sgstRate || 0);
    }
    if (s.enableGst) {
      tot += Number(s.gstRate || 0);
    }

    taxRateCache.set(tenantDb, { rate: tot, time: Date.now() });
    return tot;
  } catch (e) {
    console.error("Error reading dynamic tax rate:", e);
    return 0;
  }
};

// Get active order for a table
export const getActiveOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { tableNo } = req.params;
    let order = await Bill.findOne({ 
      tableNo: getTableMatchCondition(tableNo), 
      status: { $in: ['Open', 'Billed'] } 
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();

    if (order) {
      const hasValidItems = order.items && order.items.length > 0 && order.items.some(i => (Number(i.quantity || 0) > 0 || (i.printedQuantity || 0) > 0));
      if (!hasValidItems) {
        return res.json(null);
      }

      if (order.kots && Array.isArray(order.kots)) {
        const kotStatusMap = {};
        order.kots.forEach(kot => {
          (kot.items || []).forEach(kItem => {
            if (kItem.name) {
              kotStatusMap[kItem.name] = kItem.status;
              if (kItem._id) kotStatusMap[kItem._id.toString()] = kItem.status;
            }
          });
        });

        if (order.items && Array.isArray(order.items)) {
          order.items = order.items.map(item => {
            const matchedStatus = kotStatusMap[item._id?.toString()] || kotStatusMap[item.name] || item.status;
            return {
              ...item,
              status: matchedStatus || item.status || 'Pending'
            };
          });
        }
      }

      if (order.status === 'Open') {
        const dynamicTaxRate = await getDynamicTaxRate(req);
        const subtotal = order.subtotal || (order.items || []).reduce((acc, i) => acc + (i.isCancelled ? 0 : (i.price * (i.quantity - (i.cancelledQuantity || 0)))), 0);
        const taxRate = dynamicTaxRate;
        const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
        order.tax = taxRate;
        order.subtotal = subtotal;
        order.total = Math.round(subtotal + taxAmount);
      }
    }

    res.json(order || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper to keep KOTs and order.items unit statuses / quantities in 100% sync
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
export const saveOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { 
      tableNo, 
      items, 
      customerName, 
      customerPhone, 
      kitchenNotes, 
      billType,
      orderSource,
      id,
      discountType,
      discountValue,
      tax
    } = req.body;

    // Validate required fields
    if (!tableNo) {
      return res.status(400).json({ message: 'Table number is required' });
    }
    
    // Handle empty items array or removing all items from a table:
    if (!items || !Array.isArray(items) || items.length === 0) {
      let existingOrder = null;
      if (id) {
        existingOrder = await Bill.findById(id);
      } else if (tableNo) {
        existingOrder = await Bill.findOne({ 
          tableNo: getTableMatchCondition(tableNo), 
          status: { $in: ['Open', 'Billed'] } 
        });
      }

      if (existingOrder) {
        const hasPrintedKots = existingOrder.kots && existingOrder.kots.length > 0;
        const hasPrintedItems = (existingOrder.items || []).some(i => (i.printedQuantity || 0) > 0);

        if (!hasPrintedKots && !hasPrintedItems) {
          // Unprinted draft order: Cancel/delete it and release table
          existingOrder.status = 'Cancelled';
          existingOrder.cancelReason = 'All unprinted items removed from table';
          existingOrder.items = [];
          existingOrder.subtotal = 0;
          existingOrder.total = 0;
          await existingOrder.save();

          cache.clear('dailyStats');
          cache.clear('openOrders');

          emitSocketEvent(req, 'orderUpdated', { tableNo: existingOrder.tableNo, status: 'Cancelled', orderId: existingOrder._id });

          if (existingOrder.billType === 'Dine-In') {
            updateTableStatusHelper(req, existingOrder.tableNo, 'Available', null).catch(() => {});
          }

          return res.status(200).json({ 
            _id: existingOrder._id, 
            tableNo: existingOrder.tableNo, 
            status: 'Cancelled', 
            items: [], 
            total: 0 
          });
        }
      }

      return res.status(400).json({ message: 'Items array is required and must not be empty' });
    }

    // Sanitize items and calculate item totals - ignore items with 0 quantity that aren't printed/cancelled
    const sanitizedItems = items
      .filter(item => (Number(item.quantity || 0) > 0 || (item.printedQuantity || 0) > 0 || item.isCancelled))
      .map(item => {
        const isCancelled = item.isCancelled || false;
        const cancelledQty = item.cancelledQuantity || 0;
        const activeQty = isCancelled ? 0 : Math.max(0, Number(item.quantity || 0) - cancelledQty);
        return {
          _id: item._id,
          name: item.name,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
          total: Number(item.price || 0) * activeQty,
          specialNote: item.specialNote !== undefined ? item.specialNote : undefined,
          status: item.status || 'Pending',
          isCancelled: isCancelled,
          cancelledQuantity: cancelledQty,
          cancellationRequested: item.cancellationRequested || false,
          cancellationRequestedQty: item.cancellationRequestedQty || 0,
          cancellationRejected: item.cancellationRejected || false
        };
      });

    if (sanitizedItems.length === 0) {
      let existingOrder = null;
      if (id) {
        existingOrder = await Bill.findById(id);
      } else if (tableNo) {
        existingOrder = await Bill.findOne({ 
          tableNo: getTableMatchCondition(tableNo), 
          status: { $in: ['Open', 'Billed'] } 
        });
      }

      if (existingOrder) {
        existingOrder.status = 'Cancelled';
        existingOrder.cancelReason = 'All unprinted items removed from table';
        existingOrder.items = [];
        existingOrder.subtotal = 0;
        existingOrder.total = 0;
        await existingOrder.save();

        cache.clear('dailyStats');
        cache.clear('openOrders');

        emitSocketEvent(req, 'orderUpdated', { tableNo: existingOrder.tableNo, status: 'Cancelled', orderId: existingOrder._id });

        if (existingOrder.billType === 'Dine-In') {
          updateTableStatusHelper(req, existingOrder.tableNo, 'Available', null).catch(() => {});
        }

        return res.status(200).json({ 
          _id: existingOrder._id, 
          tableNo: existingOrder.tableNo, 
          status: 'Cancelled', 
          items: [], 
          total: 0 
        });
      }

      return res.status(400).json({ message: 'Items array is required and must not be empty' });
    }

    let order;
    if (id) {
      order = await Bill.findById(id);
    } else {
      order = await Bill.findOne({ 
        tableNo: getTableMatchCondition(tableNo), 
        status: { $in: ['Open', 'Billed'] } 
      });
    }

    if (order) {
      // Preserve printedQuantity and cancellation status for existing items
      const updatedItems = sanitizedItems.map(newItem => {
        const existingItem = order.items.find(i => 
          (newItem._id && i._id && String(i._id) === String(newItem._id)) ||
          (i.name && newItem.name && i.name.trim().toLowerCase() === newItem.name.trim().toLowerCase())
        );
        if (existingItem) {
          const isCancelled = existingItem.isCancelled || newItem.isCancelled || false;
          const cancelledQty = Math.max(existingItem.cancelledQuantity || 0, newItem.cancelledQuantity || 0);
          const activeQty = isCancelled ? 0 : Math.max(0, Number(newItem.quantity || 0) - cancelledQty);
          const resolvedNote = (newItem.specialNote !== undefined && newItem.specialNote !== null)
            ? newItem.specialNote
            : (existingItem.specialNote || '');

          return { 
            _id: existingItem._id || newItem._id,
            ...newItem, 
            printedQuantity: existingItem.printedQuantity !== undefined ? existingItem.printedQuantity : newItem.printedQuantity,
            specialNote: resolvedNote,
            lastPrintedNote: existingItem.lastPrintedNote || '',
            status: newItem.status || existingItem.status || 'Pending',
            isCancelled,
            cancelledQuantity: cancelledQty,
            total: Number(newItem.price || 0) * activeQty,
            cancellationRequested: newItem.cancellationRequested !== undefined ? newItem.cancellationRequested : (existingItem.cancellationRequested || false),
            cancellationRequestedQty: newItem.cancellationRequestedQty !== undefined ? newItem.cancellationRequestedQty : (existingItem.cancellationRequestedQty || 0),
            cancellationRejected: newItem.cancellationRejected !== undefined ? newItem.cancellationRejected : (existingItem.cancellationRejected || false)
          };
        }
        return newItem;
      });

      // Preserve items that were already printed or cancelled for KOT tracking
      order.items.forEach(oldItem => {
        if ((oldItem.printedQuantity || 0) > 0 || oldItem.isCancelled) {
          const stillExists = updatedItems.find(i => 
            (oldItem._id && i._id && String(i._id) === String(oldItem._id)) ||
            (i.name && oldItem.name && i.name.trim().toLowerCase() === oldItem.name.trim().toLowerCase())
          );
          if (!stillExists) {
            updatedItems.push({
              _id: oldItem._id,
              name: oldItem.name,
              price: oldItem.price,
              quantity: 0,
              total: 0,
              printedQuantity: oldItem.printedQuantity || 0,
              specialNote: oldItem.specialNote || '',
              lastPrintedNote: oldItem.lastPrintedNote || '',
              status: 'Cancelled',
              isCancelled: true,
              cancelledQuantity: oldItem.printedQuantity || oldItem.quantity || 0
            });
          }
        }
      });

      const subtotal = updatedItems.reduce((sum, item) => {
        if (item.isCancelled) return sum;
        const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
        return sum + (Number(item.price || 0) * activeQty);
      }, 0);

      const dType = discountType || order.discountType || 'flat';
      const dValue = discountValue !== undefined ? discountValue : (order.discountValue || 0);
      let calculatedDiscount = 0;
      if (dType === 'percentage') {
        calculatedDiscount = (subtotal * dValue) / 100;
      } else if (dType === 'complimentary') {
        calculatedDiscount = subtotal;
      } else {
        calculatedDiscount = dValue;
      }

      const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
      const tRate = (tax !== undefined && tax !== null && Number(tax) >= 0) 
        ? Number(tax) 
        : (order.status === 'Billed' && order.tax !== undefined && order.tax !== null ? Number(order.tax) : await getDynamicTaxRate(req));
      const calculatedTax = (taxableAmount * tRate) / 100;
      const calculatedTotal = Math.round(taxableAmount + calculatedTax);

      // Check if actual items, quantities, or prices changed compared to the previous state
      const cleanOldItems = (order.items || [])
        .filter(i => !i.isCancelled && Number(i.quantity || 0) > 0)
        .map(i => ({ name: (i.name || '').trim(), quantity: Number(i.quantity || 0), price: Number(i.price || 0) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const cleanNewItems = (updatedItems || [])
        .filter(i => !i.isCancelled && Number(i.quantity || 0) > 0)
        .map(i => ({ name: (i.name || '').trim(), quantity: Number(i.quantity || 0), price: Number(i.price || 0) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const itemsActuallyChanged = JSON.stringify(cleanOldItems) !== JSON.stringify(cleanNewItems);
      const isAlreadyBilled = !!(order.billNumber || order.status === 'Billed' || order.status === 'Paid');

      // An order is ONLY recorded in editHistory if it was ALREADY BILLED (locked) AND items were added/removed/changed!
      if (isAlreadyBilled && itemsActuallyChanged) {
        const previousState = {
          items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal: order.subtotal,
          totalDiscount: order.discount || 0,
          totalTax: ((order.subtotal - (order.discount || 0)) * (order.tax || 0)) / 100,
          total: order.total,
          discountType: order.discountType || 'flat',
          discountValue: order.discountValue || 0
        };

        const newState = {
          items: updatedItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal: subtotal,
          totalDiscount: calculatedDiscount,
          totalTax: calculatedTax,
          total: calculatedTotal,
          discountType: dType,
          discountValue: dValue
        };

        order.editHistory = order.editHistory || [];
        order.editHistory.push({
          editedAt: new Date(),
          previousState,
          newState
        });
        order.isEdited = true;
      }

      order.items = updatedItems;
      order.customerName = customerName;
      order.customerPhone = customerPhone;
      order.kitchenNotes = kitchenNotes;
      order.billType = billType || order.billType;
      order.discountType = dType;
      order.discountValue = dValue;
      order.discount = calculatedDiscount;
      
      // Update delivery fields if delivery order
      if (billType === 'Delivery') {
        order.orderSource = orderSource || 'Direct';
        order.deliveryStatus = 'Pending';
      } else {
        // Remove orderSource for Dine-In and Takeaway orders
        order.orderSource = undefined;
        order.deliveryStatus = undefined;
      }
      
      syncOrderKotsWithItems(order);

      order.subtotal = subtotal;
      order.tax = tRate;
      order.taxBreakdown = {
        cgst: Number(((subtotal * (tRate / 2)) / 100).toFixed(2)),
        sgst: Number(((subtotal * (tRate / 2)) / 100).toFixed(2)),
        igst: 0
      };
      order.total = calculatedTotal;
      order.status = 'Open';
      order.markModified('items');
      order.markModified('kots');
      try {
        await order.save();
      } catch (saveErr) {
        if (saveErr.name === 'VersionError' || saveErr.message?.includes('No matching document found')) {
          console.warn('[saveOrder] VersionError caught, fetching fresh document from DB...');
          const freshOrder = await Bill.findById(order._id);
          if (freshOrder) {
            freshOrder.items = updatedItems;
            freshOrder.customerName = customerName;
            freshOrder.customerPhone = customerPhone;
            freshOrder.kitchenNotes = kitchenNotes;
            freshOrder.billType = billType || freshOrder.billType;
            freshOrder.discountType = dType;
            freshOrder.discountValue = dValue;
            freshOrder.discount = calculatedDiscount;
            freshOrder.subtotal = subtotal;
            freshOrder.tax = tRate;
            freshOrder.taxBreakdown = order.taxBreakdown;
            freshOrder.total = calculatedTotal;
            freshOrder.status = 'Open';
            await freshOrder.save();
            order = freshOrder;
          } else {
            const newOrderData = {
              tableNo,
              items: updatedItems,
              customerName,
              customerPhone,
              kitchenNotes,
              billType: billType || 'Dine-In',
              discountType: dType,
              discountValue: dValue,
              discount: calculatedDiscount,
              subtotal,
              tax: tRate,
              taxBreakdown: order.taxBreakdown,
              total: calculatedTotal,
              status: 'Open'
            };
            order = await Bill.create(newOrderData);
          }
        } else {
          throw saveErr;
        }
      }
    } else {
      // Create new order
      const subtotal = sanitizedItems.reduce((sum, item) => {
        if (item.isCancelled) return sum;
        const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
        return sum + (Number(item.price || 0) * activeQty);
      }, 0);

      const dType = discountType || 'flat';
      const dValue = discountValue || 0;
      let calculatedDiscount = 0;
      if (dType === 'percentage') {
        calculatedDiscount = (subtotal * dValue) / 100;
      } else if (dType === 'complimentary') {
        calculatedDiscount = subtotal;
      } else {
        calculatedDiscount = dValue;
      }

      const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
      const tRate = tax !== undefined ? Number(tax) : 0;
      const calculatedTax = (taxableAmount * tRate) / 100;
      const calculatedTotal = Math.round(taxableAmount + calculatedTax);

      const orderData = {
        tableNo,
        items: sanitizedItems,
        subtotal,
        discount: calculatedDiscount,
        tax: tRate,
        total: calculatedTotal,
        status: 'Open',
        billType: billType || 'Dine-In',
        customerName,
        customerPhone,
        kitchenNotes,
        discountType: dType,
        discountValue: dValue
      };

      // Add delivery fields only if delivery order
      if (billType === 'Delivery') {
        orderData.orderSource = orderSource || 'Direct';
        orderData.deliveryStatus = 'Pending';
      }
      // For Dine-In and Takeaway, orderSource should not be set (undefined)

      order = await Bill.create(orderData);
    }
    
    // Clear cache when order is updated
    cache.clear('dailyStats');
    cache.clear('openOrders');
    
    emitSocketEvent(req, 'orderUpdated', { tableNo, status: order.status, order });

    if (!req.body.skipNotification) {
      if (id) {
        emitNotification(req, 'Order Updated', `Order updated for Table ${tableNo}`, 'info', ['Chef', 'Manager', 'Admin', 'Captain']);
      } else {
        emitNotification(req, 'New Order Placed', `Order placed for Table ${tableNo} (${order.billType})`, 'success', ['Chef', 'Manager', 'Admin', 'Captain']);
      }
    }
    
    // Update Floor/Table status in DB in background
    if (order.status === 'Open' && order.billType === 'Dine-In') {
      updateTableStatusHelper(req, order.tableNo, 'Occupied', order._id).catch(err => console.error('Table status update error:', err));
    }
    // Sync customer to CRM immediately without modifying visits/spend
    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName).catch(err => console.error('Immediate CRM sync error:', err));
    }
    
    res.status(200).json(order);
  } catch (error) {
    console.error('Error in saveOrder:', error);
    res.status(400).json({ message: error.message, details: error.errors });
  }
};

// Generate Bill (Lock Order)
export const generateBill = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { discount, discountType, discountValue, tax, taxBreakdown } = req.body;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Bill.findById(id);
    }
    if (!order && (req.body.tableNo || req.query.tableNo)) {
      const tableNo = req.body.tableNo || req.query.tableNo;
      order = await Bill.findOne({
        tableNo: getTableMatchCondition(tableNo),
        status: { $in: ['Open', 'Billed'] }
      });
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'Paid') return res.status(400).json({ message: 'Order already paid' });
    if (order.status === 'Billed') {
      if (discount !== undefined) order.discount = Number(discount) || 0;
      if (discountType) order.discountType = discountType;
      if (discountValue !== undefined) order.discountValue = Number(discountValue) || 0;
      if (tax !== undefined) order.tax = Number(tax) || 0;
      if (taxBreakdown) order.taxBreakdown = taxBreakdown;
      const taxableAmount = Math.max(0, order.subtotal - (order.discount || 0));
      const taxAmount = (taxableAmount * (order.tax || 0)) / 100;
      order.total = Math.round(taxableAmount + taxAmount);
      await order.save();
      cache.clear('dailyStats');
      cache.clear('openOrders');
      emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Billed', order });
      emitNotification(req, 'Bill Saved & Printed', `Bill #${order.billNumber || ''} saved and printed for Table ${order.tableNo}`, 'info', ['Chef', 'Manager', 'Admin', 'Captain']);
      return res.json(order);
    }

    // Generate Sequential Bill Number (e.g. MS0001, MS0002)
    let nextNum = 1;
    const latestBill = await Bill.findOne({ billNumber: /^MS\d+$/ })
      .sort({ billNumber: -1 })
      .collation({ locale: 'en_US', numericOrdering: true });

    if (latestBill && latestBill.billNumber) {
      const currentNum = parseInt(latestBill.billNumber.replace('MS', ''), 10);
      if (!isNaN(currentNum)) {
        nextNum = currentNum + 1;
      }
    }
    
    const billNumber = `MS${nextNum.toString().padStart(4, '0')}`;

    order.status = 'Billed';
    order.billNumber = billNumber;
    order.discount = Number(discount) || 0;
    order.discountType = discountType || 'flat';
    order.discountValue = Number(discountValue) || 0;
    order.tax = Number(tax) || 0;
    if (taxBreakdown) {
      order.taxBreakdown = taxBreakdown;
    }

    // Calculate final total
    const taxableAmount = order.subtotal - order.discount;
    const taxAmount = (taxableAmount * order.tax) / 100;
    order.total = Math.round(taxableAmount + taxAmount);

    try {
      await order.save();
    } catch (saveErr) {
      if (saveErr.name === 'VersionError' || saveErr.message?.includes('No matching document found')) {
        console.warn('[generateBill] VersionError caught, re-fetching fresh document...');
        const freshOrder = await Bill.findById(id);
        if (!freshOrder) return res.status(404).json({ message: 'Order not found after retry' });
        freshOrder.status = 'Billed';
        freshOrder.billNumber = billNumber;
        freshOrder.discount = order.discount;
        freshOrder.discountType = order.discountType;
        freshOrder.discountValue = order.discountValue;
        freshOrder.tax = order.tax;
        if (taxBreakdown) freshOrder.taxBreakdown = taxBreakdown;
        freshOrder.total = order.total;
        await freshOrder.save();
        order = freshOrder;
      } else {
        throw saveErr;
      }
    }
    
    // Clear cache when bill is generated
    cache.clear('dailyStats');
    cache.clear('openOrders');
    
    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Billed', order });
    emitNotification(req, 'Bill Saved & Printed', `Bill #${billNumber} saved and printed for Table ${order.tableNo}`, 'success', ['Chef', 'Manager', 'Admin', 'Captain']);
    
    // Update Floor/Table status in DB in background
    if (order.billType === 'Dine-In') {
      updateTableStatusHelper(req, order.tableNo, 'Billed', order._id).catch(err => console.error('Table status error:', err));
    }
    
    return res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Transfer Bill to a new Table
export const transferTable = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { newTableNo } = req.body;

    if (!newTableNo) {
      return res.status(400).json({ message: 'New table number is required' });
    }

    const order = await Bill.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    if (order.status !== 'Open' && order.status !== 'Billed') {
      return res.status(400).json({ message: 'Only open or billed orders can be transferred' });
    }

    // Check if new table is already occupied by an Open or Billed order
    const existingOrder = await Bill.findOne({ tableNo: newTableNo, status: { $in: ['Open', 'Billed'] } });
    if (existingOrder) {
      return res.status(400).json({ message: `Table ${newTableNo} is already occupied` });
    }

    const oldTableNo = order.tableNo;
    order.tableNo = newTableNo;

    // Log the transfer in edit history
    order.editHistory = order.editHistory || [];
    order.editHistory.push({
      editedAt: new Date(),
      previousState: {
        tableNo: oldTableNo,
        items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
        subtotal: order.subtotal,
        totalDiscount: order.discount || 0,
        totalTax: order.tax || 0,
        total: order.total,
        discountType: order.discountType || 'flat',
        discountValue: order.discountValue || 0
      },
      newState: {
        tableNo: newTableNo,
        items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
        subtotal: order.subtotal,
        totalDiscount: order.discount || 0,
        totalTax: order.tax || 0,
        total: order.total,
        discountType: order.discountType || 'flat',
        discountValue: order.discountValue || 0
      }
    });
    order.isEdited = true;

    await order.save();
    
    cache.clear('openOrders');
    
    emitSocketEvent(req, 'tableTransferred', { oldTableNo, newTableNo });
    
    // Update Floor/Table status in DB
    if (order.billType === 'Dine-In') {
      await updateTableStatusHelper(req, oldTableNo, 'Available', null);
      await updateTableStatusHelper(req, newTableNo, 'Occupied', order._id);
    }
    
    return res.json({ message: 'Table transferred successfully', order });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Merge multiple table bills into a single target table bill
export const mergeTableOrders = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { targetTableNo, sourceTableNos } = req.body;
    console.log('[mergeTableOrders] Request:', { targetTableNo, sourceTableNos });

    if (!targetTableNo || !sourceTableNos || !Array.isArray(sourceTableNos) || sourceTableNos.length === 0) {
      return res.status(400).json({ message: 'Target table and at least one source table are required' });
    }

    // Find active order on target table (Open or Billed)
    let targetOrder = await Bill.findOne({ tableNo: getTableMatchCondition(targetTableNo), status: { $in: ['Open', 'Billed'] } });
    console.log('[mergeTableOrders] Target order found:', targetOrder ? { id: targetOrder._id, tableNo: targetOrder.tableNo } : 'None');
    
    // Find active orders on all source tables
    const sourceConditions = sourceTableNos.map(tblStr => ({ tableNo: getTableMatchCondition(tblStr) }));
    const sourceQuery = { 
      $or: sourceConditions, 
      status: { $in: ['Open', 'Billed'] }
    };
    if (targetOrder && targetOrder._id) {
      sourceQuery._id = { $ne: targetOrder._id };
    }
    const sourceOrders = await Bill.find(sourceQuery);
    console.log('[mergeTableOrders] Source orders found:', sourceOrders.map(o => ({ id: o._id, tableNo: o.tableNo, status: o.status })));

    if (sourceOrders.length === 0) {
      return res.status(404).json({ message: 'No active bills found on the selected source tables to merge' });
    }

    // If targetOrder doesn't exist, create one based on the first source order
    if (!targetOrder) {
      const firstSource = sourceOrders[0];
      targetOrder = new Bill({
        tableNo: targetTableNo,
        billType: firstSource.billType || 'Dine-In',
        status: 'Open',
        items: [],
        customerName: firstSource.customerName || 'Merged Party',
        customerPhone: firstSource.customerPhone || '',
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0
      });
    }

    // Combine items from all source orders into targetOrder
    for (const sourceOrder of sourceOrders) {
      for (const item of (sourceOrder.items || [])) {
        // Check if exact same item & variant already exists in target
        const existingItemIndex = targetOrder.items.findIndex(
          ti => ti.name?.toLowerCase() === item.name?.toLowerCase() && 
               (ti.variant || '') === (item.variant || '') && 
               (Number(ti.price) === Number(item.price))
        );

        if (existingItemIndex > -1) {
          targetOrder.items[existingItemIndex].quantity += (Number(item.quantity) || 1);
          targetOrder.items[existingItemIndex].total = targetOrder.items[existingItemIndex].quantity * targetOrder.items[existingItemIndex].price;
        } else {
          targetOrder.items.push({
            name: item.name,
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            total: Number(item.total) || (Number(item.price) * Number(item.quantity)),
            variant: item.variant || '',
            kotStatus: item.kotStatus || 'Served',
            notes: item.notes || `Merged from ${sourceOrder.tableNo}`
          });
        }
      }

      // Add discount if source had discount
      if (sourceOrder.discount > 0) {
        targetOrder.discount = (Number(targetOrder.discount) || 0) + Number(sourceOrder.discount);
      }

      // Mark source order as Cancelled/Merged and clear table
      sourceOrder.status = 'Cancelled';
      sourceOrder.notes = `Merged into ${targetTableNo}`;
      await sourceOrder.save();

      // Free the source table on Floor
      await updateTableStatusHelper(req, sourceOrder.tableNo, 'Available', null);
    }

    // Recalculate targetOrder totals
    const oldSubTotal = targetOrder.subtotal || 0;
    const oldTax = targetOrder.tax || 0;
    const existingTaxRate = (oldSubTotal > 0 && oldTax > 0) ? (oldTax / oldSubTotal) : 0;

    const newSubTotal = targetOrder.items.reduce((sum, item) => sum + (Number(item.total) || (Number(item.price) * Number(item.quantity))), 0);
    targetOrder.subtotal = Math.round(newSubTotal);
    targetOrder.tax = Math.round(targetOrder.subtotal * existingTaxRate);
    targetOrder.total = Math.max(0, Math.round(targetOrder.subtotal + targetOrder.tax - (Number(targetOrder.discount) || 0)));

    await targetOrder.save();

    // Update target table status on Floor
    await updateTableStatusHelper(req, targetTableNo, targetOrder.status, targetOrder._id);

    cache.clear('openOrders');
    emitSocketEvent(req, 'tableTransferred', { targetTableNo, sourceTableNos });
    emitSocketEvent(req, 'ordersUpdated', {});

    return res.json({ message: `Merged ${sourceTableNos.join(', ')} into ${targetTableNo}`, targetOrder });
  } catch (error) {
    console.error('Error merging tables:', error);
    res.status(500).json({ message: error.message || 'Server error while merging table bills' });
  }
};

// Settle Bill (Payment) - Saves bill to history (status: 'Paid')
export const settleBill = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { paymentMode, splitPayments, upiApp } = req.body;

    const order = await Bill.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    if (order.status === 'Paid') {
      return res.json(order);
    }

    // Set status to 'Paid' - this makes it appear in billing history
    order.status = 'Paid';
    order.paymentMode = paymentMode;
    if (paymentMode === 'UPI' && upiApp) {
      order.upiApp = upiApp;
    }

    if (paymentMode === 'Mixed' && splitPayments) {
      order.splitPayments = {
        cash: Number(splitPayments.cash) || 0,
        upi: Number(splitPayments.upi) || 0,
        card: Number(splitPayments.card) || 0
      };
    }
    
    // Explicitly update the updatedAt timestamp to ensure latest bills show first
    order.updatedAt = new Date();
    
    // Save the bill - it's now in billing history with fresh timestamp
    await order.save();
    
    // Automatically deduct inventory stock based on recipe maps
    deductStockForBillItems(req, order.items, 'POS Billing Counter').catch(err => console.error('Auto stock deduction error:', err));

    // Update VIP CRM Data
    updateCustomerFromBill(req, order).catch(err => console.error('Customer CRM update error:', err));

    // Clear cache when bill is settled (most important for dashboard)
    cache.clear('dailyStats');
    cache.clear('openOrders');
    
    emitSocketEvent(req, 'billSettled', { tableNo: order.tableNo, billNumber: order.billNumber, order, bill: order });
    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Paid', order });
    
    // Free up the table in DB in background
    if (order.billType === 'Dine-In') {
      updateTableStatusHelper(req, order.tableNo, 'Available', null).catch(err => console.error('Table status error:', err));
    }
    
    // Return the saved bill with all details
    res.json(order);
  } catch (error) {
    console.error('Error settling bill:', error);
    res.status(400).json({ message: error.message });
  }
};

// Get all bills (for history) with pagination support - Optimized for 150+ orders/day
// Get all bills (for history, delivery, pickup) with pagination support - Optimized for high performance
export const getBills = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const skip = (page - 1) * limit;
    const { search, billType, excludeBillType, orderSource, paymentMode, status, startDate, endDate } = req.query;

    // Build query
    const query = {};

    // Status filter
    if (status) {
      query.status = status.includes(',') ? { $in: status.split(',').map(s => s.trim()) } : status;
    } else {
      query.status = { $in: ['Paid', 'Cancelled', 'Deleted'] };
    }

    // Bill type filter (e.g. Delivery, Takeaway, or Dine-In,Takeaway)
    if (billType) {
      if (billType.includes(',')) {
        query.billType = { $in: billType.split(',').map(s => s.trim()) };
      } else {
        query.billType = billType.trim();
      }
    } else if (excludeBillType) {
      query.billType = { $ne: excludeBillType.trim() };
    }

    // Order source filter (e.g. Swiggy, Zomato, Direct)
    if (orderSource && orderSource !== 'all') {
      if (orderSource === 'Other') {
        query.orderSource = { $nin: ['Swiggy', 'Zomato', 'Direct'] };
      } else {
        query.orderSource = orderSource.trim();
      }
    }

    // Payment mode filter
    if (paymentMode && paymentMode !== 'all' && paymentMode !== 'All') {
      query.paymentMode = paymentMode.trim();
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search filter
    if (search && search.trim()) {
      const searchClean = search.trim().replace(/^#/, '');
      query.$or = [
        { billNumber: { $regex: searchClean, $options: 'i' } },
        { tableNo: { $regex: searchClean, $options: 'i' } },
        { customerName: { $regex: searchClean, $options: 'i' } },
        { customerPhone: { $regex: searchClean, $options: 'i' } }
      ];
    }

    // Run query and count concurrently in parallel for 2x faster execution
    const [bills, total] = await Promise.all([
      Bill.find(query)
        .select('billNumber tableNo billType paymentMode total orderSource items status customerName customerPhone createdAt updatedAt')
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bill.countDocuments(query)
    ]);

    const validBills = Array.isArray(bills) ? bills : [];

    res.json({
      bills: validBills,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalBills: total,
        hasMore: skip + validBills.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(200).json({
      bills: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalBills: 0,
        hasMore: false
      }
    });
  }
};


// Get a single bill by ID (with all details for invoice)
export const getBillById = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    res.json(bill);
  } catch (error) {
    console.error('Error fetching bill by ID:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete a bill with password verification
export const deleteBill = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const User = getTenantModel(req, 'User', UserDefault);
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete a bill' });
    }

    // Verify password against current logged-in user OR any Admin account
    let isValidPassword = false;
    if (req.user) {
      const currentUser = await User.findById(req.user.id || req.user._id);
      if (currentUser && (await currentUser.comparePassword(password))) {
        isValidPassword = true;
      }
    }

    if (!isValidPassword) {
      // Check if the provided password matches any Admin account (for manager override)
      const admins = await User.find({ role: 'Admin' });
      for (const admin of admins) {
        if (await admin.comparePassword(password)) {
          isValidPassword = true;
          break;
        }
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Incorrect Admin/User password. Deletion not authorized.' });
    }

    const deletedBill = await Bill.findByIdAndUpdate(id, { 
      status: 'Deleted',
      cancelReason: 'Manually deleted from History' 
    }, { new: true });
    if (!deletedBill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    
    // Clear cache when bill is deleted
    cache.clear('dailyStats');
    cache.clear('openOrders');
    
    // Free up the table in DB if it was a Dine-In
    if (deletedBill.billType === 'Dine-In') {
      await updateTableStatusHelper(req, deletedBill.tableNo, 'Available', null);
    }
    
    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all open/billed orders (optimized for performance with caching disabled for real-time)
export const getOpenOrders = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    // Cache checking disabled for real-time floor updates
    // const cacheKey = cache.getCacheKey('openOrders');
    // const cached = cache.get(cacheKey);
    // if (cached) {
    //   return res.json(cached);
    // }
    
    const orders = await Bill.find({
      status: { $in: ['Open', 'Billed'] }
    })
    .select('tableNo items total subtotal tax status billNumber billType orderSource createdAt')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

    // Auto-clean any legacy empty/zero-item bills in DB in the background
    Bill.updateMany(
      {
        status: { $in: ['Open', 'Billed'] },
        $or: [
          { items: { $size: 0 } },
          { 'items.quantity': { $lte: 0 }, 'items.printedQuantity': { $lte: 0 } }
        ]
      },
      {
        $set: { status: 'Cancelled', cancelReason: 'Auto-cleaned empty zero-item bill' }
      }
    ).catch(() => {});

    const dynamicTaxRate = await getDynamicTaxRate(req);

    const formattedOrders = orders
      .filter(order => {
        const validItems = (order.items || []).filter(i => (Number(i.quantity || 0) > 0 || (i.printedQuantity || 0) > 0));
        return validItems.length > 0;
      })
      .map(order => {
        const subtotal = (order.items || []).reduce((acc, i) => acc + (i.isCancelled ? 0 : (Number(i.price || 0) * Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0)))), 0);
        const taxRate = order.status === 'Open' ? dynamicTaxRate : ((order.tax !== undefined && order.tax !== null) ? Number(order.tax) : dynamicTaxRate);
        const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
        const totalWithTax = Math.round(subtotal + taxAmount);
        return {
          ...order,
          subtotal,
          tax: taxRate,
          total: totalWithTax
        };
      });

    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching open orders:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get daily statistics - Optimized with parallel aggregation for sub-50ms execution
export const getDailyStats = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const now = new Date();
    let today, tomorrow;
    
    if (req.query.startDate && req.query.endDate) {
      today = new Date(req.query.startDate);
      tomorrow = new Date(req.query.endDate);
    } else {
      today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    }

    if (isNaN(today.getTime()) || isNaN(tomorrow.getTime())) {
      throw new Error('Invalid date range');
    }

    const rangeMs = tomorrow.getTime() - today.getTime();
    const isSingleDay = rangeMs <= 86400000 + 1000;

    // Run ALL independent queries concurrently in parallel
    const [
      paidStatsRes,
      paymentStatsRes,
      topItemsRes,
      recentBillsRes,
      openKOTsRes,
      deliveryStatsRes,
      dineInStatsRes,
      takeawayStatsRes,
      cancelledOrdersRes,
      editedOrdersRes,
      timelineRes
    ] = await Promise.allSettled([
      // 1. Paid Stats
      Bill.aggregate([
        { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
        {
          $project: {
            total: { $ifNull: ['$total', 0] },
            discount: { $ifNull: ['$discount', 0] },
            tax: { $ifNull: ['$tax', 0] },
            items: { $ifNull: ['$items', []] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalBills: { $sum: 1 },
            totalDiscount: { $sum: '$discount' },
            totalTax: { $sum: '$tax' },
            avgOrderValue: { $avg: '$total' },
            totalItems: { $sum: { $size: '$items' } }
          }
        }
      ]),
      // 2. Payment Stats
      Bill.aggregate([
        { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid', paymentMode: { $exists: true, $ne: null } } },
        { $project: { paymentMode: 1, total: { $ifNull: ['$total', 0] } } },
        { $group: { _id: '$paymentMode', count: { $sum: 1 }, revenue: { $sum: '$total' } } }
      ]),
      // 3. Top Items
      Bill.aggregate([
        { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
        { $unwind: "$items" },
        { $group: { _id: "$items.name", quantity: { $sum: "$items.quantity" }, revenue: { $sum: "$items.total" } } },
        { $sort: { quantity: -1 } },
        { $limit: 10 }
      ]),
      // 4. Recent Bills
      Bill.find({ updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' })
        .select('billNumber tableNo billType paymentMode total orderSource items status createdAt updatedAt')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(6)
        .lean(),
      // 5. Open KOTs / Active Orders
      Bill.find({ status: { $in: ['Open', 'Billed'] } })
        .select('tableNo billType items status updatedAt createdAt')
        .sort({ updatedAt: -1 })
        .lean(),
      // 6. Delivery Count
      Bill.countDocuments({ updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Delivery' }),
      // 7. Dine-In Count
      Bill.countDocuments({ updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Dine-In' }),
      // 8. Takeaway Count
      Bill.countDocuments({ updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Takeaway' }),
      // 9. Cancelled Orders
      Bill.find({
        updatedAt: { $gte: today, $lt: tomorrow },
        $or: [
          { status: { $in: ['Cancelled', 'Deleted'] } },
          { 'kots.kotNumber': { $regex: '^CANCEL' } }
        ]
      })
      .select('tableNo billType cancelReason status updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .lean(),
      // 10. Edited Orders
      Bill.find({ updatedAt: { $gte: today, $lt: tomorrow }, isEdited: true })
        .select('tableNo billNumber billType editHistory status updatedAt createdAt')
        .sort({ updatedAt: -1 })
        .lean(),
      // 11. Timeline breakdown
      isSingleDay
        ? Bill.aggregate([
            { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
            { $group: { _id: { $hour: '$updatedAt' }, sales: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ])
        : Bill.aggregate([
            { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
                sales: { $sum: '$total' },
                orders: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ])
    ]);

    const paidStats = paidStatsRes.status === 'fulfilled' ? paidStatsRes.value : [];
    const paymentStats = paymentStatsRes.status === 'fulfilled' ? paymentStatsRes.value : [];
    const topItems = topItemsRes.status === 'fulfilled' ? topItemsRes.value : [];
    const recentBills = recentBillsRes.status === 'fulfilled' ? recentBillsRes.value : [];
    const openKOTs = openKOTsRes.status === 'fulfilled' ? openKOTsRes.value : [];
    const deliveryStats = deliveryStatsRes.status === 'fulfilled' ? deliveryStatsRes.value : 0;
    const dineInStats = dineInStatsRes.status === 'fulfilled' ? dineInStatsRes.value : 0;
    const takeawayStats = takeawayStatsRes.status === 'fulfilled' ? takeawayStatsRes.value : 0;
    const cancelledOrders = cancelledOrdersRes.status === 'fulfilled' ? cancelledOrdersRes.value : [];
    const editedOrders = editedOrdersRes.status === 'fulfilled' ? editedOrdersRes.value : [];
    const rawTimeline = timelineRes.status === 'fulfilled' ? timelineRes.value : [];

    let salesTimeline = [];
    if (isSingleDay) {
      const hourlyMap = {};
      rawTimeline.forEach(h => { hourlyMap[h._id] = h; });
      for (let hr = 0; hr < 24; hr++) {
        const entry = hourlyMap[hr] || { sales: 0, orders: 0 };
        salesTimeline.push({ time: `${hr.toString().padStart(2, '0')}:00`, sales: entry.sales, orders: entry.orders });
      }
    } else {
      const dailyMap = {};
      rawTimeline.forEach(d => { dailyMap[d._id] = d; });
      const cursor = new Date(today);
      while (cursor < tomorrow) {
        const dateStr = cursor.toISOString().split('T')[0];
        const entry = dailyMap[dateStr] || { sales: 0, orders: 0 };
        const dayLabel = `${cursor.getUTCDate().toString().padStart(2, '0')}/${(cursor.getUTCMonth() + 1).toString().padStart(2, '0')}`;
        salesTimeline.push({ time: dayLabel, sales: entry.sales, orders: entry.orders });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }


    const result = paidStats[0] || { 
      totalRevenue: 0, 
      totalBills: 0, 
      totalDiscount: 0, 
      totalTax: 0,
      avgOrderValue: 0,
      totalItems: 0
    };

    // Ensure paymentStats is an array and filter out null values
    const validPaymentStats = Array.isArray(paymentStats) 
      ? paymentStats.filter(p => p._id !== null && p._id !== undefined)
      : [];

    const response = {
      sales: Number(result.totalRevenue) || 0,
      orders: Number(result.totalBills) || 0,
      averageOrderValue: Math.round(Number(result.avgOrderValue) || 0),
      totalItems: Number(result.totalItems) || 0,
      totalDiscount: Number(result.totalDiscount) || 0,
      totalTax: Number(result.totalTax) || 0,
      paymentMethods: validPaymentStats,
      activeOrders: Number(activeOrders) || 0,
      deliveryOrders: Number(deliveryStats) || 0,
      dineInOrders: Number(dineInStats) || 0,
      takeawayOrders: Number(takeawayStats) || 0,
      topItems: topItems || [],
      recentBills: recentBills || [],
      openKOTs: openKOTs || [],
      cancelledOrders: cancelledOrders || [],
      editedOrders: editedOrders || [],
      hourlySales: salesTimeline
    };
    
    // Cache removed to ensure immediate reflection on dashboard
    // cache.set(cacheKey, response, 30000);
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    console.error('Error stack:', error.stack);
    
    // Always return default response to prevent dashboard failure
    // This ensures the dashboard can still render even if there's an error
    const defaultResponse = {
      sales: 0,
      orders: 0,
      averageOrderValue: 0,
      totalItems: 0,
      totalDiscount: 0,
      totalTax: 0,
      paymentMethods: [],
      activeOrders: 0,
      deliveryOrders: 0,
      topItems: [],
      recentBills: [],
      openKOTs: [],
      cancelledOrders: [],
      editedOrders: []
    };
    
    // Log the error but return 200 with default data so dashboard doesn't break
    // The frontend can handle empty/zero data gracefully
    res.status(200).json(defaultResponse);
  }
};

// Generate KOT for a bill (only for new/changed items)
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

      if (newQty > 0 || (newQty === 0 && noteChanged)) {
        const kotQty = newQty > 0 ? newQty : currentQty;
        if (kotQty > 0) {
          kotItems.push({
            name: item.name,
            quantity: kotQty,
            specialNote: currentNote,
            isNoteUpdateOnly: newQty === 0 && Boolean(noteChanged),
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
        }
      }
    }

    if (kotItems.length === 0 && !hadQuantityReductions) {
      return res.status(400).json({ message: 'No new items or changes to print KOT for.' });
    }

    let savedKOT = null;
    let kotPayload = null;

    if (kotItems.length > 0) {
      // Generate KOT number (e.g., "KOT-1" relative to this bill)
      const kotNumber = `KOT-${(bill.kots ? bill.kots.length : 0) + 1}`;
      const newKOT = {
        kotNumber,
        items: kotItems,
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

    const isUpdate = (bill.kots ? bill.kots.length : 0) > 1 || hadQuantityReductions;
    const reducedItems = itemChanges.filter(c => c.type === 'reduced');
    const addedItems = itemChanges.filter(c => c.type === 'added');

    let dynamicMessage = `KOT updated for Table ${bill.tableNo}`;
    if (reducedItems.length > 0) {
      const reducedText = reducedItems.map(c => `${c.name} reduced by ${c.reducedQty}x (Now ${c.currentQty}x)`).join(', ');
      dynamicMessage = `Table ${bill.tableNo}: ${reducedText}`;
    } else if (addedItems.length > 0) {
      const addedText = addedItems.map(c => `${c.name} +${c.delta}x (Now ${c.currentQty}x)`).join(', ');
      dynamicMessage = `Table ${bill.tableNo}: ${addedText}`;
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
    } else if (hadQuantityReductions) {
      emitSocketEvent(req, 'kotQuantityUpdated', { 
        tableNo: bill.tableNo, 
        orderId: bill._id, 
        isReduction: true, 
        changes: itemChanges,
        message: dynamicMessage 
      });
      emitNotification(req, 'Item Quantity Reduced', dynamicMessage, 'warning', ['Chef', 'Manager', 'Admin', 'Captain']);
    }

    emitSocketEvent(req, 'orderUpdated', { tableNo: bill.tableNo, status: bill.status, order: bill, total: bill.total });

    res.status(200).json({
      message: kotPayload ? 'KOT generated successfully' : 'KOT updated successfully',
      kot: kotPayload || { items: bill.items, tableNo: bill.tableNo, orderId: bill._id },
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
            .filter(item => item.quantity > 0 && !item.isCancelled);

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
export const reopenOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (bill.status === 'Paid') {
      return res.status(400).json({ message: 'Cannot reopen a paid order. Create a new bill instead.' });
    }

    bill.status = 'Open';
    // Clear the bill number so it's regenerated when they finalize? 
    // No, standard POS practice is to keep the same bill number and just update the amount.
    
    await bill.save();

    emitSocketEvent(req, 'orderUpdated', { tableNo: bill.tableNo, status: 'Open' });

    // Update Floor/Table status in DB in background
    if (bill.billType === 'Dine-In') {
      updateTableStatusHelper(req, bill.tableNo, 'Occupied', bill._id).catch(err => console.error('Table status error:', err));
    }

    res.status(200).json({
      message: 'Order reopened successfully',
      bill
    });
  } catch (error) {
    console.error('Error reopening order:', error);
    res.status(500).json({ message: 'Error reopening order', error: error.message });
  }
};

// Cancel an entire order
export const cancelOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { cancelReason } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (bill.status === 'Paid') {
      return res.status(400).json({ message: 'Cannot cancel an order that is already paid. Please process a refund instead.' });
    }

    if (bill.status === 'Cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    // Generate a cancellation KOT if any items were already printed to the kitchen
    const kotItems = [];
    for (const item of bill.items) {
      if (item.printedQuantity > 0) {
        kotItems.push({
          name: item.name,
          quantity: -(item.printedQuantity) // Negative quantity signals kitchen to stop cooking
        });
        item.printedQuantity = 0; // Reset printed quantity
      }
    }

    let newKOT = null;
    if (kotItems.length > 0) {
      newKOT = {
        kotNumber: `CANCEL-${(bill.kots ? bill.kots.length : 0) + 1}`,
        items: kotItems,
        createdAt: new Date()
      };
      bill.kots.push(newKOT);
    }

    bill.status = 'Cancelled';
    if (cancelReason) {
      bill.cancelReason = cancelReason;
    }
    await bill.save();

    emitSocketEvent(req, 'orderUpdated', { tableNo: bill.tableNo, status: 'Cancelled' });
    
    // Free up the table in DB in background
    if (bill.billType === 'Dine-In') {
      updateTableStatusHelper(req, bill.tableNo, 'Available', null).catch(err => console.error('Table status error:', err));
    }

    res.status(200).json({
      message: 'Order cancelled successfully',
      kot: newKOT
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: 'Error cancelling order', error: error.message });
  }
};

export const refundOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { refundReason } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.status !== 'Paid') return res.status(400).json({ message: 'Only paid bills can be refunded' });

    bill.status = 'Refunded';
    bill.cancelReason = refundReason || 'Customer requested refund';
    await bill.save();

    emitSocketEvent(req, 'orderUpdated', { tableNo: bill.tableNo, status: 'Refunded' });

    res.status(200).json({ message: 'Order refunded successfully', bill });
  } catch (error) {
    console.error('Error refunding order:', error);
    res.status(500).json({ message: 'Error refunding order', error: error.message });
  }
};

// =======================
// KDS Controller Methods
// =======================

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
      // Build a map of item cancellation status from order.items
      const itemCancelMap = {};
      (order.items || []).forEach(i => {
        if (i.name) {
          itemCancelMap[i.name] = {
            isCancelled: i.isCancelled || false,
            cancelledQuantity: i.cancelledQuantity || 0
          };
        }
      });

      order.kots.forEach(kot => {
        const processedItems = (kot.items || [])
          .filter(kItem => {
            const itemStatus = itemCancelMap[kItem.name];
            const isCancelled = kItem.status === 'Cancelled' || kItem.isCancelled || (itemStatus && itemStatus.isCancelled);
            const qty = Math.max(0, parseInt(kItem.quantity || 0, 10));
            return qty > 0 && !isCancelled;
          })
          .map(kItem => {
            const orderItem = (order.items || []).find(i => i.name === kItem.name || (kItem._id && i._id?.toString() === kItem._id?.toString()));
            const qty = Math.max(0, parseInt(kItem.quantity || 0, 10));
            let unitStatuses = kItem.unitStatuses;
            if (!unitStatuses || !Array.isArray(unitStatuses) || unitStatuses.length !== qty) {
              unitStatuses = Array.from({ length: qty }, () => kItem.status || 'Pending');
            }

            const preparedQty = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
            const preparingQty = unitStatuses.filter(s => s === 'Preparing').length;
            const pendingQty = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

            const reducedQty = Math.max(0, parseInt(orderItem?.reducedQuantity || orderItem?.cancelledQuantity || kItem.reducedQuantity || kItem.cancelledQuantity || 0, 10));

            return {
              ...kItem,
              quantity: qty,
              reducedQuantity: reducedQty,
              specialNote: kItem.specialNote || orderItem?.specialNote || '',
              isCancelled: false,
              status: kItem.status || 'Pending',
              cancelledQuantity: kItem.cancelledQuantity || 0,
              unitStatuses,
              preparedQuantity: preparedQty,
              preparingQuantity: preparingQty,
              pendingQuantity: pendingQty
            };
          });

        // Include KOTs that have active items needing kitchen preparation (Pending or Preparing)
        const hasActiveKitchenItems = processedItems.some(item => (item.status === 'Pending' || item.status === 'Preparing' || (item.pendingQuantity > 0 || item.preparingQuantity > 0)));
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
export const getEditedBills = async (req, res) => {
  try {
    const TenantBill = getTenantModel(req, 'Bill', BillDefault);
    
    // Find all bills that have been edited, sorted by the most recently updated
    const editedBills = await TenantBill.find({
      $or: [
        { isEdited: true },
        { 'editHistory.0': { $exists: true } }
      ]
    })
    .sort({ updatedAt: -1, createdAt: -1 })
    .select('billNumber tableNo status customerName customerPhone total items editHistory updatedAt createdAt isEdited')
    .lean();

    // Filter out any false-positive historical entries where items were identical before and after
    const genuinelyEdited = (editedBills || []).filter(b => {
      if (!b.editHistory || b.editHistory.length === 0) return false;
      return b.editHistory.some(e => {
        const prevItems = (e.previousState?.items || []).filter(i => (i.quantity || 0) > 0).map(i => `${(i.name || '').trim()}:${i.quantity}`).sort().join(',');
        const newItems = (e.newState?.items || []).filter(i => (i.quantity || 0) > 0).map(i => `${(i.name || '').trim()}:${i.quantity}`).sort().join(',');
        return prevItems !== newItems || Math.abs((e.previousState?.total || 0) - (e.newState?.total || 0)) > 0.01;
      });
    });
    
    res.json(genuinelyEdited);
  } catch (error) {
    console.error('Error fetching edited bills:', error);
    res.status(500).json({ message: 'Server error while fetching edited bills' });
  }
};


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

    // ⚡ Dismiss the cancellation request notification from all Admin/Captain notification panels
    emitDismissNotification(req, {
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
export const getActiveNotifications = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const Settings = getTenantModel(req, 'Settings', SettingsDefault);
    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestDefault);
    const settings = await Settings.findOne().lean();
    const shopName = settings?.restaurantName || 'Restaurant';

    const notifications = [];
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // 1. Query open and billed orders that have pending cancellation requests (for Admin, Manager, Captain)
    const activeCancelBills = await Bill.find({
      status: { $in: ['Open', 'Billed'] },
      'items.cancellationRequested': true
    }).select('tableNo items createdAt updatedAt').lean();

    activeCancelBills.forEach(bill => {
      const cleanTable = (bill.tableNo || '').replace('Table ', '');
      if (Array.isArray(bill.items)) {
        bill.items.forEach(item => {
          if (item.cancellationRequested) {
            notifications.push({
              id: `cancel-${bill._id}-${item._id}`,
              type: 'error',
              title: `${shopName} | Table ${cleanTable} Cancel Req`,
              message: `${item.cancellationRequestedQty || item.quantity}x ${item.name}`,
              time: item.updatedAt || bill.updatedAt || bill.createdAt || new Date(),
              timestamp: new Date(item.updatedAt || bill.updatedAt || bill.createdAt || Date.now()),
              targetRoles: ['Admin', 'Manager', 'Captain'],
              data: {
                orderId: bill._id,
                itemId: item._id,
                type: 'cancel_item_request',
                itemName: item.name,
                cancelQty: item.cancellationRequestedQty || item.quantity,
                tableNo: bill.tableNo
              }
            });
          }
        });
      }
    });

    // 2. Query recent Service Requests (Call Waiter, Need Water, Pay the Bill) from last 48 hours
    const serviceRequests = await ServiceRequest.find({
      createdAt: { $gte: twoDaysAgo }
    }).sort({ createdAt: -1 }).limit(50).lean();

    serviceRequests.forEach(reqItem => {
      const cleanTable = (reqItem.tableNumber || '').replace('Table ', '');
      const reqType = reqItem.requestType || 'Service';
      const isPayBill = reqType === 'Pay the Bill';
      
      notifications.push({
        id: `service-${reqItem._id}`,
        type: isPayBill ? 'warning' : 'info',
        title: `Table ${cleanTable} Service`,
        message: reqType,
        time: reqItem.createdAt || new Date(),
        timestamp: new Date(reqItem.createdAt || Date.now()),
        targetRoles: isPayBill 
          ? ['Cashier', 'Captain', 'Manager', 'Admin'] 
          : ['Captain', 'Manager', 'Admin'],
        data: {
          serviceRequestId: reqItem._id,
          type: 'service_request',
          requestType: reqType,
          tableNo: reqItem.tableNumber,
          status: reqItem.status
        }
      });
    });

    // 3. Query recent KOT orders & item updates from open/cooking bills (for Chef, KDS, Manager, Admin)
    const recentBills = await Bill.find({
      createdAt: { $gte: twoDaysAgo },
      status: { $in: ['Open', 'Hold', 'Billed'] }
    }).select('billNumber tableNo billType items createdAt updatedAt').sort({ updatedAt: -1 }).limit(30).lean();

    recentBills.forEach(bill => {
      const cleanTable = (bill.tableNo || '').replace('Table ', '');
      const hasCookingOrReady = Array.isArray(bill.items) && bill.items.some(i => i.kdsStatus === 'Cooking' || i.kdsStatus === 'Ready');
      
      if (hasCookingOrReady || bill.status === 'Open') {
        const totalItemsCount = (bill.items || []).filter(i => !i.isCancelled).length;
        if (totalItemsCount > 0) {
          notifications.push({
            id: `kot-order-${bill._id}`,
            type: 'info',
            title: `Table ${cleanTable} Order Updated`,
            message: `${totalItemsCount} items • ${bill.billType || 'Dine-In'}`,
            time: bill.updatedAt || bill.createdAt || new Date(),
            timestamp: new Date(bill.updatedAt || bill.createdAt || Date.now()),
            targetRoles: ['Chef', 'Manager', 'Admin', 'Captain'],
            data: {
              orderId: bill._id,
              type: 'kot_update',
              tableNo: bill.tableNo,
              billNumber: bill.billNumber
            }
          });
        }
      }
    });

    // Sort all notifications newest first
    const sorted = notifications.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.time || 0);
      const timeB = new Date(b.timestamp || b.time || 0);
      return timeB - timeA;
    });

    res.json(sorted);
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    res.status(500).json({ message: error.message });
  }
};

