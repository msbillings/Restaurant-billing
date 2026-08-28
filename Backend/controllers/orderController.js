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
import { syncOrderKotsWithItems } from './kotController.js';

import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const getActiveOrder = asyncHandler(async (req, res, next) => {
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
});

// Helper to keep KOTs and order.items unit statuses / quantities in 100% sync


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
      if (customerName !== undefined) order.customerName = customerName;
      if (customerPhone !== undefined) order.customerPhone = customerPhone;
      if (order.customerPhone) {
        syncCustomer(req, order.customerPhone, order.customerName, billType || order.billType).catch(() => {});
      }
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
            if (customerName !== undefined) freshOrder.customerName = customerName;
            if (customerPhone !== undefined) freshOrder.customerPhone = customerPhone;
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
    const { discount, discountType, discountValue, tax, taxBreakdown, orderSource, customerName, customerPhone } = req.body;

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
      if (orderSource) order.orderSource = orderSource;
      if (customerName) order.customerName = customerName;
      if (customerPhone) order.customerPhone = customerPhone;
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
    if (orderSource) order.orderSource = orderSource;
    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType).catch(() => {});
    }
    order.discount = Number(discount) || 0;
    order.discountType = discountType || 'flat';
    order.discountValue = Number(discountValue) || 0;
    order.tax = Number(tax) || 0;
    if (taxBreakdown) {
      order.taxBreakdown = taxBreakdown;
    }
    // Ensure subtotal is valid and recomputed from active items if missing/0
    if (!order.subtotal || order.subtotal <= 0) {
      order.subtotal = (order.items || []).reduce((acc, i) => 
        acc + (i.isCancelled ? 0 : (Number(i.price || 0) * Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0)))), 0);
    }

    // Calculate final total with delivery & container charges
    const taxableAmount = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
    const taxAmount = (taxableAmount * (order.tax || 0)) / 100;
    const computedTotal = Math.round(taxableAmount + taxAmount + (Number(order.deliveryCharge) || 0) + (Number(order.containerCharge) || 0));
    order.total = (req.body.total !== undefined && Number(req.body.total) > 0) ? Number(req.body.total) : computedTotal;

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


export const settleBill = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { paymentMode, splitPayments, upiApp, discount, discountType, discountValue, tax, taxBreakdown, total, subtotal, orderSource, customerName, customerPhone } = req.body;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Bill.findById(id);
    }
    if (!order) {
      order = await Bill.findOne({
        $or: [
          { billNumber: id },
          { tableNo: getTableMatchCondition(id), status: { $in: ['Open', 'Billed'] } }
        ]
      }).sort({ updatedAt: -1, createdAt: -1 });
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    if (order.status === 'Paid') {
      return res.json(order);
    }

    if (orderSource) order.orderSource = orderSource;
    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType).catch(() => {});
    }

    // Apply optional pricing/discount adjustments if sent directly
    if (discount !== undefined) order.discount = Number(discount) || 0;
    if (discountType) order.discountType = discountType;
    if (discountValue !== undefined) order.discountValue = Number(discountValue) || 0;
    if (tax !== undefined) order.tax = Number(tax) || 0;
    if (taxBreakdown) order.taxBreakdown = taxBreakdown;
    if (total !== undefined && Number(total) > 0) order.total = Number(total);
    if (subtotal !== undefined && Number(subtotal) > 0) order.subtotal = Number(subtotal);

    // Safeguard against zero total/subtotal
    if (!order.subtotal || order.subtotal <= 0) {
      order.subtotal = (order.items || []).reduce((acc, i) => 
        acc + (i.isCancelled ? 0 : (Number(i.price || 0) * Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0)))), 0);
    }
    if (!order.total || order.total <= 0) {
      const taxable = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
      const taxAmt = (taxable * (order.tax || 0)) / 100;
      order.total = Math.round(taxable + taxAmt + (Number(order.deliveryCharge) || 0) + (Number(order.containerCharge) || 0));
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
    
    // Ensure billNumber exists if not previously generated (Ultra-fast indexed lookup)
    if (!order.billNumber) {
      let nextNum = 1;
      const latestBill = await Bill.findOne({ billNumber: /^MS\d+$/ })
        .sort({ createdAt: -1 })
        .select('billNumber')
        .lean();

      if (latestBill && latestBill.billNumber) {
        const currentNum = parseInt(latestBill.billNumber.replace('MS', ''), 10);
        if (!isNaN(currentNum)) {
          nextNum = currentNum + 1;
        }
      }
      order.billNumber = `MS${nextNum.toString().padStart(4, '0')}`;
    }

    // Save the bill with version retry protection
    try {
      await order.save();
    } catch (saveErr) {
      if (saveErr.name === 'VersionError' || saveErr.message?.includes('No matching document found')) {
        console.warn('[settleBill] VersionError caught, retrying on fresh document...');
        const freshOrder = await Bill.findById(order._id);
        if (freshOrder) {
          freshOrder.status = 'Paid';
          freshOrder.paymentMode = paymentMode;
          if (paymentMode === 'UPI' && upiApp) freshOrder.upiApp = upiApp;
          if (paymentMode === 'Mixed' && splitPayments) {
            freshOrder.splitPayments = {
              cash: Number(splitPayments.cash) || 0,
              upi: Number(splitPayments.upi) || 0,
              card: Number(splitPayments.card) || 0
            };
          }
          freshOrder.updatedAt = new Date();
          if (!freshOrder.billNumber) freshOrder.billNumber = order.billNumber;
          await freshOrder.save();
          order = freshOrder;
        }
      } else {
        throw saveErr;
      }
    }
    
    // Automatically deduct inventory stock based on recipe maps
    deductStockForBillItems(req, order.items, 'POS Billing Counter').catch(err => console.error('Auto stock deduction error:', err));

    // Update VIP CRM Data
    updateCustomerFromBill(req, order).catch(err => console.error('Customer CRM update error:', err));

    // Clear cache when bill is settled (most important for dashboard)
    cache.clear('dailyStats');
    cache.clear('openOrders');
    
    emitSocketEvent(req, 'billSettled', { tableNo: order.tableNo, billNumber: order.billNumber, order, bill: order });
    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Paid', order });

    // Fetch shop name instantly from memory cache
    const shopName = await getTenantShopName(req);

    const cleanTable = (order.tableNo || '').replace(/^Table\s*/i, '');
    const billNumDisplay = order.billNumber ? `#${order.billNumber}` : '';
    const notifTitle = shopName 
      ? `${shopName} | Bill ${billNumDisplay} Settled`.trim()
      : `Bill ${billNumDisplay} Settled`.trim();

    const notifMessage = order.billType === 'Dine-In'
      ? `Bill ${billNumDisplay} of ₹${order.total || 0} for Table ${cleanTable} settled via ${order.paymentMode || 'Cash'}`
      : `Bill ${billNumDisplay} of ₹${order.total || 0} settled via ${order.paymentMode || 'Cash'} (${order.billType || 'Takeaway'})`;

    // ⚡ INSTANT NOTIFICATION BROADCAST (0ms socket emit)
    emitNotification(
      req,
      notifTitle,
      notifMessage,
      'success',
      ['Admin', 'Manager', 'Cashier', 'Captain'],
      {
        orderId: order._id,
        billNumber: order.billNumber,
        type: 'bill_settled',
        tableNo: order.tableNo,
        total: order.total,
        paymentMode: order.paymentMode,
        billType: order.billType,
        shopName
      }
    );
    
    // Free up the table in DB in background
    if (order.billType === 'Dine-In') {
      updateTableStatusHelper(req, order.tableNo, 'Available', null).catch(err => console.error('Table status error:', err));
    }
    
    // Return the saved bill with all details immediately
    res.json(order);
  } catch (error) {
    console.error('Error settling bill:', error);
    res.status(400).json({ message: error.message });
  }
};

// Get all bills (for history) with pagination support - Optimized for 150+ orders/day
// Get all bills (for history, delivery, pickup) with pagination support - Optimized for high performance


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

    // Auto-clean ONLY bills that are completely empty (no items at all, or all items have qty=0 AND printedQty=0 AND are not KOT-printed).
    // IMPORTANT: Do NOT use cross-array conditions — they incorrectly match orders with a mix of cancelled + active items.
    Bill.find({ status: { $in: ['Open', 'Billed'] } })
      .select('_id items kots')
      .lean()
      .then(async (openBills) => {
        const emptyBillIds = openBills
          .filter(b => {
            if (!b.items || b.items.length === 0) return true;
            // Only cancel if ALL items are zero AND no KOTs were ever fired
            const hasKots = b.kots && b.kots.length > 0;
            if (hasKots) return false; // Has KOT history — never auto-cancel
            const hasAnyActiveItem = b.items.some(i =>
              Number(i.quantity || 0) > 0 || (i.printedQuantity || 0) > 0
            );
            return !hasAnyActiveItem;
          })
          .map(b => b._id);
        if (emptyBillIds.length > 0) {
          await Bill.updateMany(
            { _id: { $in: emptyBillIds } },
            { $set: { status: 'Cancelled', cancelReason: 'Auto-cleaned empty zero-item bill' } }
          );
        }
      }).catch(() => {});


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

// Update customer details directly on a bill/order
export const updateBillCustomer = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { customerName, customerPhone, billType } = req.body;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Bill.findById(id);
    }
    if (!order) {
      order = await Bill.findOne({
        tableNo: getTableMatchCondition(id),
        status: { $in: ['Open', 'Billed'] }
      });
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.customerName = customerName || 'Guest';
    order.customerPhone = customerPhone || '';
    await order.save();

    cache.clear('dailyStats');
    cache.clear('openOrders');

    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType || billType).catch(() => {});
    }

    emitSocketEvent(req, 'orderUpdated', { 
      tableNo: order.tableNo, 
      orderId: order._id, 
      customerName: order.customerName, 
      customerPhone: order.customerPhone 
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error('Error updating bill customer:', err);
    res.status(500).json({ message: err.message });
  }
};