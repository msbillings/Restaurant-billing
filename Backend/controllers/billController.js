import BillDefault from '../models/Bill.js';
import UserDefault from '../models/User.js';
import SettingDefault from '../models/Setting.js';
import cache from '../utils/cache.js';
import { deductStockForBillItems } from './inventoryController.js';
import { updateTableStatusHelper } from './floorController.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';
import { updateCustomerFromBill, syncCustomer } from './customerController.js';
import { emitNotification } from '../utils/notificationHelper.js';
import { printKOTToPrinters } from '../services/printerService.js';

const emitSocketEvent = (req, eventName, data) => {
  try {
    const io = req.app?.locals?.io;
    if (io) {
      const tenantDb = req.tenantDb || req.headers['x-tenant-db'] || req.user?.db;
      if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
        io.to(tenantDb).emit(eventName, data);
      }
      io.emit(eventName, data);
    }
  } catch (err) {
    console.error('Socket emit error:', err);
  }
};

// Helper to get case-insensitive clean regex match for table variations (e.g. "Table 1" vs "Ground Floor - Table 1")
const getTableMatchCondition = (tblStr) => {
  if (!tblStr) return tblStr;
  const trimmed = tblStr.trim();
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    const floorPart = parts[0].trim();
    const tablePart = parts.slice(1).join(' - ').trim();
    const escapedFloor = floorPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedTable = tablePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match exact "First Floor - Table 4" so tables on different floors never mix orders
    return { $regex: new RegExp(`^${escapedFloor}\\s*-\\s*${escapedTable}$`, 'i') };
  }
  const escapedClean = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $regex: new RegExp(`^${escapedClean}$`, 'i') };
};

// Helper to dynamically get active tax rate from restaurantSettings in DB
const getDynamicTaxRate = async (req) => {
  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' });
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
    }).lean();

    if (order) {
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
        const taxRate = (order.tax !== undefined && order.tax !== null && order.tax > 0) ? order.tax : dynamicTaxRate;
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
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required and must not be empty' });
    }

    // Sanitize items and calculate item totals
    const sanitizedItems = items.map(item => {
      const isCancelled = item.isCancelled || false;
      const cancelledQty = item.cancelledQuantity || 0;
      const activeQty = isCancelled ? 0 : Math.max(0, Number(item.quantity || 0) - cancelledQty);
      return {
        name: item.name,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 0),
        total: Number(item.price || 0) * activeQty,
        specialNote: item.specialNote || '',
        status: item.status || 'Pending',
        isCancelled: isCancelled,
        cancelledQuantity: cancelledQty,
        cancellationRequested: item.cancellationRequested || false,
        cancellationRequestedQty: item.cancellationRequestedQty || 0,
        cancellationRejected: item.cancellationRejected || false
      };
    });

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
        const existingItem = order.items.find(i => i.name === newItem.name);
        if (existingItem) {
          const isCancelled = existingItem.isCancelled || newItem.isCancelled || false;
          const cancelledQty = Math.max(existingItem.cancelledQuantity || 0, newItem.cancelledQuantity || 0);
          const activeQty = isCancelled ? 0 : Math.max(0, Number(newItem.quantity || 0) - cancelledQty);
          return { 
            ...newItem, 
            printedQuantity: existingItem.printedQuantity !== undefined ? existingItem.printedQuantity : newItem.printedQuantity,
            specialNote: newItem.specialNote || existingItem.specialNote || '',
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

      // Preserve items that were already printed or cancelled but removed from request
      order.items.forEach(oldItem => {
        if (oldItem.printedQuantity > 0 || oldItem.isCancelled) {
          const stillExists = updatedItems.find(i => i.name === oldItem.name);
          if (!stillExists) {
            updatedItems.push({
              name: oldItem.name,
              price: oldItem.price,
              quantity: oldItem.quantity || 0,
              total: 0,
              printedQuantity: oldItem.printedQuantity || 0,
              specialNote: oldItem.specialNote || '',
              isCancelled: oldItem.isCancelled || false,
              cancelledQuantity: oldItem.cancelledQuantity || 0
            });
          }
        }
      });

      const subtotal = updatedItems.reduce((sum, item) => {
        if (item.isCancelled) return sum;
        const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
        return sum + (Number(item.price || 0) * activeQty);
      }, 0);

      // Update existing order
      const previousState = {
        items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
        subtotal: order.subtotal,
        totalDiscount: order.discount || 0,
        totalTax: order.tax || 0,
        total: order.total,
        discountType: order.discountType || 'flat',
        discountValue: order.discountValue || 0
      };

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
      const dynamicTaxRate = await getDynamicTaxRate(req);
      const tRate = (tax !== undefined && tax !== null && tax > 0) ? Number(tax) : (order.tax && order.tax > 0 ? order.tax : dynamicTaxRate);
      const calculatedTax = (taxableAmount * tRate) / 100;
      const calculatedTotal = Math.round(taxableAmount + calculatedTax);

      const newState = {
        items: updatedItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
        subtotal: subtotal,
        totalDiscount: calculatedDiscount,
        totalTax: calculatedTax,
        total: calculatedTotal,
        discountType: dType,
        discountValue: dValue
      };

      const hasChanged = JSON.stringify(previousState) !== JSON.stringify(newState);
      if (hasChanged) {
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
      
      order.subtotal = subtotal;
      order.tax = tRate;
      order.taxBreakdown = {
        cgst: Number(((subtotal * (tRate / 2)) / 100).toFixed(2)),
        sgst: Number(((subtotal * (tRate / 2)) / 100).toFixed(2)),
        igst: 0
      };
      order.total = calculatedTotal;
      order.status = 'Open';
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
    
    emitSocketEvent(req, 'orderUpdated', { tableNo, status: order.status });

    if (id) {
      emitNotification(req, 'Order Updated', `Order updated for Table ${tableNo}`, 'info', ['Chef', 'Manager', 'Admin', 'Captain']);
    } else {
      emitNotification(req, 'New Order Placed', `Order placed for Table ${tableNo} (${order.billType})`, 'success', ['Chef', 'Manager', 'Admin', 'Captain']);
    }
    
    // Update Floor/Table status in DB
    if (order.status === 'Open' && order.billType === 'Dine-In') {
      await updateTableStatusHelper(req, order.tableNo, 'Occupied', order._id);
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

    // Always fetch a fresh document directly from DB to avoid stale __v VersionError
    let order = await Bill.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Open') return res.status(400).json({ message: 'Order already billed or paid' });

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
    
    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Billed' });
    
    // Update Floor/Table status in DB
    if (order.billType === 'Dine-In') {
      await updateTableStatusHelper(req, order.tableNo, 'Billed', order._id);
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
    
    emitSocketEvent(req, 'billSettled', { tableNo: order.tableNo, billNumber: order.billNumber });
    
    // Free up the table in DB
    if (order.billType === 'Dine-In') {
      await updateTableStatusHelper(req, order.tableNo, 'Available', null);
    }
    
    // Return the saved bill with all details
    res.json(order);
  } catch (error) {
    console.error('Error settling bill:', error);
    res.status(400).json({ message: error.message });
  }
};

// Get all bills (for history) with pagination support - Optimized for 150+ orders/day
export const getBills = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Default 20 per page, max 100 for performance
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    // Build query with search
    const query = { status: { $in: ['Paid', 'Cancelled', 'Deleted'] } };
    if (search) {
      query.billNumber = { $regex: search, $options: 'i' };
    }

    let bills = [];
    let total = 0;

    try {
      // Use lean() for better performance with large datasets
      // Sort by updatedAt descending (newest first) - Latest paid bills appear first
      // Using updatedAt ensures bills that were just paid/completed show at the top
      // This ensures whatever billing was done most recently appears first
      bills = await Bill.find(query)
        .select('billNumber tableNo billType paymentMode total orderSource items status createdAt updatedAt') // Include status, orderSource and items for delivery filtering
        .sort({ updatedAt: -1, createdAt: -1 }) // Sort by updatedAt first (when paid), then createdAt as tiebreaker
        .skip(skip)
        .limit(limit)
        .lean(); // Use lean for faster queries
    } catch (error) {
      console.error('Error fetching bills list:', error);
      bills = [];
    }

    try {
      // Use estimatedDocumentCount for better performance on large collections
      total = await Bill.countDocuments(query);
    } catch (error) {
      console.error('Error counting bills:', error);
      total = bills.length; // Fallback to bills array length
    }
    
    // Ensure bills is an array
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
    console.error('Error stack:', error.stack);
    
    // Always return default response to prevent frontend failure
    const defaultResponse = {
      bills: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalBills: 0,
        hasMore: false
      }
    };
    
    // Return 200 with default data so bill history page doesn't break
    res.status(200).json(defaultResponse);
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

    const dynamicTaxRate = await getDynamicTaxRate(req);

    const formattedOrders = orders.map(order => {
      if (order.status === 'Open') {
        const subtotal = order.subtotal || (order.items || []).reduce((acc, i) => acc + (i.isCancelled ? 0 : (i.price * (i.quantity - (i.cancelledQuantity || 0)))), 0);
        const taxRate = (order.tax !== undefined && order.tax !== null && order.tax > 0) ? order.tax : dynamicTaxRate;
        const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
        const totalWithTax = Math.round(subtotal + taxAmount);
        return {
          ...order,
          subtotal,
          tax: taxRate,
          total: totalWithTax
        };
      }
      return order;
    });

    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching open orders:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get daily statistics - Optimized with caching for 150+ orders/day
export const getDailyStats = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    // Use UTC dates to avoid timezone issues in production
    // MongoDB stores dates in UTC, so we need to query in UTC
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

    
    // Ensure dates are valid
    if (isNaN(today.getTime()) || isNaN(tomorrow.getTime())) {
      throw new Error('Invalid date range');
    }
    
    const cacheKey = cache.getCacheKey('dailyStats', today.toISOString().split('T')[0]);
    
    // Cache checking disabled
    // const cached = cache.get(cacheKey);
    // if (cached) {
    //   return res.json(cached);
    // }

    // Optimized: Single aggregation pipeline for better performance
    // Handle each query separately to catch individual errors
    let paidStats = [];
    let paymentStats = [];
    let activeOrders = 0;
    let deliveryStats = 0;
    let topItems = [];
    let recentBills = [];

    try {
      // Get paid bills stats
      paidStats = await Bill.aggregate([
        {
          $match: {
            updatedAt: { $gte: today, $lt: tomorrow },
            status: 'Paid'
          }
        },
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
      ]);
    } catch (error) {
      console.error('Error in paidStats aggregation:', error);
      paidStats = [];
    }

    try {
      // Get payment method breakdown
      paymentStats = await Bill.aggregate([
        {
          $match: {
            updatedAt: { $gte: today, $lt: tomorrow },
            status: 'Paid',
            paymentMode: { $exists: true, $ne: null }
          }
        },
        {
          $project: {
            paymentMode: 1,
            total: { $ifNull: ['$total', 0] }
          }
        },
        {
          $group: {
            _id: '$paymentMode',
            count: { $sum: 1 },
            revenue: { $sum: '$total' }
          }
        }
      ]);
    } catch (error) {
      console.error('Error in paymentStats aggregation:', error);
      paymentStats = [];
    }

    try {
      topItems = await Bill.aggregate([
        {
          $match: {
            updatedAt: { $gte: today, $lt: tomorrow },
            status: 'Paid'
          }
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            quantity: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.total" }
          }
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 }
      ]);
    } catch (error) {
      console.error('Error in topItems aggregation:', error);
      topItems = [];
    }

    try {
      recentBills = await Bill.find({
        updatedAt: { $gte: today, $lt: tomorrow },
        status: 'Paid'
      })
      .select('billNumber tableNo billType paymentMode total orderSource items status createdAt updatedAt')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(6)
      .lean();
    } catch (error) {
      console.error('Error fetching recent bills:', error);
      recentBills = [];
    }

    let openKOTs = [];
    try {
      openKOTs = await Bill.find({
        status: { $in: ['Open', 'Billed'] }
      })
      .select('tableNo billType items status updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .lean();

      activeOrders = openKOTs.length;
    } catch (error) {
      console.error('Error fetching open KOTs:', error);
      activeOrders = 0;
      openKOTs = [];
    }

    try {
      // Get delivery orders count (paid delivery orders today)
      // Only count orders with billType === 'Delivery'
      deliveryStats = await Bill.countDocuments({
        updatedAt: { $gte: today, $lt: tomorrow },
        status: 'Paid',
        billType: 'Delivery'
      });
    } catch (error) {
      console.error('Error counting delivery orders:', error);
      deliveryStats = 0;
    }

    let dineInStats = 0;
    let takeawayStats = 0;

    try {
      // Get dine-in orders count
      dineInStats = await Bill.countDocuments({
        updatedAt: { $gte: today, $lt: tomorrow },
        status: 'Paid',
        billType: 'Dine-In'
      });
    } catch (error) {
      console.error('Error counting dine-in orders:', error);
      dineInStats = 0;
    }

    try {
      // Get takeaway orders count
      takeawayStats = await Bill.countDocuments({
        updatedAt: { $gte: today, $lt: tomorrow },
        status: 'Paid',
        billType: 'Takeaway'
      });
    } catch (error) {
      console.error('Error counting takeaway orders:', error);
      takeawayStats = 0;
    }

    let cancelledOrders = [];
    try {
      cancelledOrders = await Bill.find({
        updatedAt: { $gte: today, $lt: tomorrow },
        $or: [
          { status: { $in: ['Cancelled', 'Deleted'] } },
          { 'kots.kotNumber': { $regex: '^CANCEL' } }
        ]
      })
      .select('tableNo billType cancelReason status updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .lean();
    } catch (error) {
      console.error('Error fetching cancelled orders:', error);
      cancelledOrders = [];
    }

    let editedOrders = [];
    try {
      editedOrders = await Bill.find({
        updatedAt: { $gte: today, $lt: tomorrow },
        isEdited: true
      })
      .select('tableNo billNumber billType editHistory status updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .lean();
    } catch (error) {
      console.error('Error fetching edited orders:', error);
      editedOrders = [];
    }

    // Smart sales breakdown for the Sales Overview chart (REAL data)
    // For single day → hourly breakdown, for multi-day → daily breakdown
    const rangeMs = tomorrow.getTime() - today.getTime();
    const isSingleDay = rangeMs <= 86400000 + 1000; // 24 hours + 1s tolerance

    let salesTimeline = [];
    try {
      if (isSingleDay) {
        // HOURLY breakdown for Today
        const hourlyBreakdown = await Bill.aggregate([
          { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
          { $group: { _id: { $hour: '$updatedAt' }, sales: { $sum: '$total' }, orders: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]);
        const hourlyMap = {};
        hourlyBreakdown.forEach(h => { hourlyMap[h._id] = h; });
        for (let hr = 0; hr < 24; hr++) {
          const entry = hourlyMap[hr] || { sales: 0, orders: 0 };
          salesTimeline.push({ time: `${hr.toString().padStart(2, '0')}:00`, sales: entry.sales, orders: entry.orders });
        }
      } else {
        // DAILY breakdown for multi-day ranges
        const dailyBreakdown = await Bill.aggregate([
          { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
              sales: { $sum: '$total' },
              orders: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);
        // Build a map of existing data
        const dailyMap = {};
        dailyBreakdown.forEach(d => { dailyMap[d._id] = d; });
        // Fill in all days in the range (including days with 0 sales)
        const cursor = new Date(today);
        while (cursor < tomorrow) {
          const dateStr = cursor.toISOString().split('T')[0];
          const entry = dailyMap[dateStr] || { sales: 0, orders: 0 };
          // Format label based on range length
          const dayLabel = `${cursor.getUTCDate().toString().padStart(2, '0')}/${(cursor.getUTCMonth() + 1).toString().padStart(2, '0')}`;
          salesTimeline.push({ time: dayLabel, sales: entry.sales, orders: entry.orders });
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }
    } catch (error) {
      console.error('Error in sales timeline aggregation:', error);
      salesTimeline = [];
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

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Calculate delta and update printed quantities
    const kotItems = [];

    // We trust the backend's `items` array which was just saved by saveOrder
    // Wait, the frontend should just call saveOrder, then call generateKOT.
    // generateKOT will look at bill.items, compare quantity with printedQuantity
    
    for (const item of bill.items) {
      const newQty = item.quantity - (item.printedQuantity || 0);
      if (newQty !== 0) {
        kotItems.push({
          name: item.name,
          quantity: newQty, // Can be negative for cancellations
          specialNote: item.specialNote || ''
        });
        // Update printed quantity
        item.printedQuantity = item.quantity;
      }
    }

    if (kotItems.length === 0) {
      return res.status(400).json({ message: 'No new items to print KOT for.' });
    }

    // Generate KOT number (e.g., "KOT-1" relative to this bill)
    const kotNumber = `KOT-${(bill.kots ? bill.kots.length : 0) + 1}`;
    
    const newKOT = {
      kotNumber,
      items: kotItems,
      createdAt: new Date()
    };

    bill.kots.push(newKOT);
    await bill.save();

    emitSocketEvent(req, 'newKOT', { tableNo: bill.tableNo, kot: newKOT });

    // Trigger physical network thermal printing to configured IP printers
    printKOTToPrinters(req, bill, kotNumber, kotItems).catch(err => {
      console.error('[KOT Print Error]:', err.message);
    });

    res.status(200).json({
      message: 'KOT generated successfully',
      kot: newKOT,
      bill: bill
    });
  } catch (error) {
    console.error('Error generating KOT:', error);
    res.status(500).json({ message: 'Error generating KOT', error: error.message });
  }
};

// Get all KOTs generated today (or specific date) across all bills
export const getTodayKOTs = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { date, search } = req.query;

    let targetDate = new Date();
    if (date) {
      if (typeof date === 'string' && date.includes('-')) {
        const parts = date.split('-');
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else if (parts[2].length === 4) {
          // DD-MM-YYYY
          targetDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        } else {
          targetDate = new Date(date);
        }
      } else {
        targetDate = new Date(date);
      }
    }
    if (isNaN(targetDate.getTime())) {
      targetDate = new Date();
    }
    
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find all bills from target date that have KOTs
    const bills = await Bill.find({
      $or: [
        { createdAt: { $gte: targetDate, $lt: nextDay } },
        { updatedAt: { $gte: targetDate, $lt: nextDay } },
        { 'kots.createdAt': { $gte: targetDate, $lt: nextDay } }
      ],
      'kots.0': { $exists: true }
    })
    .select('tableNo billType kots status items')
    .sort({ updatedAt: -1 })
    .lean();

    // Flatten KOTs into a single array
    let allKOTs = [];
    bills.forEach(bill => {
      const itemCancelMap = {};
      (bill.items || []).forEach(i => {
        if (i.name) {
          itemCancelMap[i.name] = {
            isCancelled: i.isCancelled || false,
            cancelledQuantity: i.cancelledQuantity || 0
          };
        }
      });

      if (bill.kots) {
        bill.kots.forEach(kot => {
          const processedItems = (kot.items || []).map(kItem => {
            const itemStatus = itemCancelMap[kItem.name];
            const isCancelled = kItem.status === 'Cancelled' || kItem.isCancelled || (itemStatus && itemStatus.isCancelled);
            return {
              ...kItem,
              isCancelled: isCancelled,
              status: isCancelled ? 'Cancelled' : kItem.status,
              cancelledQuantity: isCancelled ? (itemStatus?.cancelledQuantity || kItem.quantity) : (kItem.cancelledQuantity || 0)
            };
          });

          allKOTs.push({
            ...kot,
            items: processedItems,
            billId: bill._id,
            tableNo: bill.tableNo,
            billType: bill.billType,
            billStatus: bill.status
          });
        });
      }
    });

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      allKOTs = allKOTs.filter(kot => 
        (kot.kotNumber && kot.kotNumber.toLowerCase().includes(searchLower)) ||
        (kot.tableNo && kot.tableNo.toLowerCase().includes(searchLower))
      );
    }

    // Sort by KOT creation time descending
    allKOTs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json(allKOTs);
  } catch (error) {
    console.error('Error fetching today KOTs:', error);
    res.status(500).json({ message: 'Error fetching KOTs', error: error.message });
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

    // Update Floor/Table status in DB
    if (bill.billType === 'Dine-In') {
      await updateTableStatusHelper(req, bill.tableNo, 'Occupied', bill._id);
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
    
    // Free up the table in DB
    if (bill.billType === 'Dine-In') {
      await updateTableStatusHelper(req, bill.tableNo, 'Available', null);
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
        const processedItems = (kot.items || []).map(kItem => {
          const itemStatus = itemCancelMap[kItem.name];
          const isCancelled = kItem.status === 'Cancelled' || kItem.isCancelled || (itemStatus && itemStatus.isCancelled);
          return {
            ...kItem,
            isCancelled: isCancelled,
            status: isCancelled ? 'Cancelled' : kItem.status,
            cancelledQuantity: isCancelled ? (itemStatus?.cancelledQuantity || kItem.quantity) : (kItem.cancelledQuantity || 0)
          };
        });

        // Include KOTs that have active items needing kitchen preparation (Pending or Preparing)
        const hasActiveKitchenItems = processedItems.some(item => (item.status === 'Pending' || item.status === 'Preparing') && !item.isCancelled);
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
    const { orderId, kotId, itemId, status } = req.body;

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

    item.status = status;

    // Sync status to bill.items
    if (order.items && Array.isArray(order.items)) {
      const orderItem = order.items.find(i => i._id?.toString() === itemId?.toString() || i.name === item.name);
      if (orderItem) {
        orderItem.status = status;
        order.markModified('items');
      }
    }

    order.markModified('kots');
    await order.save();

    emitSocketEvent(req, 'kotUpdated', { 
      orderId, 
      kotId, 
      itemId, 
      status, 
      tableNo: order.tableNo, 
      itemName: item.name 
    });
    
    if (status === 'Preparing') {
      const cleanTable = order.tableNo.replace('Table ', '');
      emitNotification(req, 'KOT Accepted', `Chef accepted KOT for Table ${cleanTable} - ${item.name}`, 'info', ['Captain', 'Manager', 'Admin']);
    } else if (status === 'Ready') {
      const cleanTable = order.tableNo.replace('Table ', '');
      emitNotification(req, 'Food Ready', `${item.name} is ready for Table ${cleanTable}`, 'success', ['Captain', 'Manager', 'Admin']);
    }

    res.json({ message: 'Item status updated successfully', kot });
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
    .sort({ updatedAt: -1 })
    .select('billNumber tableNo status customerName customerPhone total items editHistory updatedAt createdAt isEdited');
    
    res.json(editedBills);
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

    res.status(200).json({ message: `Cancellation ${action}ed successfully`, bill });
  } catch (error) {
    console.error('Error resolving item cancel:', error);
    res.status(500).json({ message: 'Server error while resolving item cancellation' });
  }
};

