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

const toValidObjectId = (val) => {
  if (!val) return undefined;
  const s = String(val).trim();
  if (mongoose.Types.ObjectId.isValid(s) && s.length === 24 && /^[0-9a-fA-F]{24}$/.test(s)) {
    return s;
  }
  return undefined;
};

export const generateUniqueBillNumber = async (BillModel) => {
  const recentBills = await BillModel.find(
    { billNumber: /^MS\d+$/ },
    { billNumber: 1 }
  )
    .sort({ billNumber: -1, createdAt: -1 })
    .limit(50)
    .lean();

  let maxNum = 0;
  if (recentBills && recentBills.length > 0) {
    for (const b of recentBills) {
      if (b.billNumber) {
        const num = parseInt(b.billNumber.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `MS${(maxNum + 1).toString().padStart(4, '0')}`;
};

export const getRestaurantSnapshot = async (req, clientDetails) => {
  try {
    let settings = null;
    const tenantDb = req?.tenantDb || req?.headers?.['x-tenant-db'] || req?.headers?.['X-Tenant-DB'] || req?.user?.db || 'default';
    const cacheKey = cache.getCacheKey('restaurantSettings', tenantDb);

    // 0ms Cache Fast Path: Try reading from Node memory first
    settings = cache.get(cacheKey);

    if (!settings) {
      const Setting = getTenantModel(req, 'Setting', SettingDefault);
      if (Setting) {
        const doc = await Setting.findOne({ key: 'restaurantSettings' }).maxTimeMS(300).lean().catch(() => null);
        if (doc && doc.value) {
          settings = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
          cache.set(cacheKey, settings, 5 * 60 * 1000); // Cache for 5 minutes
        }
      }
    }

    const c = (clientDetails && typeof clientDetails === 'object') ? clientDetails : {};
    const s = (settings && typeof settings === 'object') ? settings : {};

    const name = (c.restaurantName || s.restaurantName || '').trim();
    const type = (c.restaurantType || s.restaurantType || '').trim();
    const addr = (c.address !== undefined ? c.address : (s.address || '')).trim();
    const ph = (c.phone !== undefined ? c.phone : (s.phone || '')).trim();
    const em = (c.email !== undefined ? c.email : (s.email || '')).trim();
    const gst = (c.gstin !== undefined ? c.gstin : (s.gstin || '')).trim();
    const fss = (c.fssai !== undefined ? c.fssai : (s.fssai || '')).trim();
    const rawLogo = c.logo !== undefined ? c.logo : (s.logo || '');
    const logo = rawLogo === '[logo_stored]' ? '' : rawLogo;
    const upi = (c.upiId !== undefined ? c.upiId : (s.upiId || '')).trim();
    const enableQr = c.enableQrPayment !== undefined ? c.enableQrPayment : (s.enableQrPayment !== undefined ? s.enableQrPayment : true);
    const footer = (c.footerMessage !== undefined ? c.footerMessage : (s.footerMessage || '')).trim();
    const tag = (c.tagline !== undefined ? c.tagline : (s.tagline || '')).trim();
    const printFmt = c.printFormat || s.printFormat || '80mm';
    const taxSet = {
      enableCgst: c.enableCgst !== undefined ? c.enableCgst : (s.enableCgst !== undefined ? s.enableCgst : true),
      enableSgst: c.enableSgst !== undefined ? c.enableSgst : (s.enableSgst !== undefined ? s.enableSgst : true),
      enableGst: c.enableGst !== undefined ? c.enableGst : (s.enableGst !== undefined ? s.enableGst : false),
      cgstRate: c.cgstRate !== undefined ? Number(c.cgstRate) : (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5),
      sgstRate: c.sgstRate !== undefined ? Number(c.sgstRate) : (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5),
      gstRate: c.gstRate !== undefined ? Number(c.gstRate) : (s.gstRate !== undefined ? Number(s.gstRate) : 5)
    };

    return {
      restaurantName: name,
      restaurantType: type,
      address: addr,
      phone: ph,
      email: em,
      gstin: gst,
      fssai: fss,
      logo: logo,
      upiId: upi,
      enableQrPayment: enableQr,
      footerMessage: footer,
      tagline: tag,
      printFormat: printFmt,
      taxSettings: taxSet
    };
  } catch (err) {
    console.error('[getRestaurantSnapshot] Error capturing snapshot:', err);
    return clientDetails || {};
  }
};

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
      const dVal = order.discountValue || 0;
      let calculatedDiscount = 0;
      if (order.discountType === 'percentage') {
        if (order.applicableTo === 'category' && order.targetCategory) {
          const targetCat = String(order.targetCategory).trim().toLowerCase();
          const eligibleSubtotal = (order.items || []).reduce((acc, i) => {
            if (i.isCancelled) return acc;
            const itemCat = typeof i.category === 'object' && i.category !== null ? i.category.name : i.category;
            if (itemCat && String(itemCat).trim().toLowerCase() === targetCat) {
              const activeQty = Math.max(0, Number(i.quantity || 0) - (i.cancelledQuantity || 0));
              return acc + (Number(i.price || 0) * activeQty);
            }
            return acc;
          }, 0);
          calculatedDiscount = (eligibleSubtotal * dVal) / 100;
        } else {
          calculatedDiscount = (subtotal * dVal) / 100;
        }
      } else if (order.discountType === 'complimentary') {
        calculatedDiscount = subtotal;
      } else {
        calculatedDiscount = dVal;
      }
      const taxable = Math.max(0, subtotal - calculatedDiscount);
      const taxRate = dynamicTaxRate;
      const taxAmount = Number(((taxable * taxRate) / 100).toFixed(2));
      const dCharge = Number(order.deliveryCharge) || 0;
      const cCharge = Number(order.containerCharge) || 0;
      order.tax = taxRate;
      order.subtotal = subtotal;
      order.discount = calculatedDiscount;
      order.deliveryCharge = dCharge;
      order.containerCharge = cCharge;
      order.total = Math.round(taxable + taxAmount + dCharge + cCharge);
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
      discount,
      discountType,
      discountValue,
      discountName,
      applicableTo,
      targetCategory,
      tax,
      deliveryCharge,
      containerCharge,
      restaurantDetails
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
        if (existingOrder.status === 'Paid') {
          return res.status(400).json({ message: 'Audit Security: Cannot modify an already paid and settled bill' });
        }
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
            updateTableStatusHelper(req, existingOrder.tableNo, 'Available', null).catch(() => { });
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
        const validId = toValidObjectId(item._id);
        return {
          ...(validId && { _id: validId }),
          name: item.name,
          category: item.category,
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
          updateTableStatusHelper(req, existingOrder.tableNo, 'Available', null).catch(() => { });
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
      if (order.status === 'Paid') {
        return res.status(400).json({ message: 'Audit Security: Cannot modify an already paid and settled bill' });
      }

      if (!order.restaurantDetails || !order.restaurantDetails.restaurantName) {
        order.restaurantDetails = await getRestaurantSnapshot(req, restaurantDetails);
      }

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

          const validResolvedId = toValidObjectId(existingItem._id) || toValidObjectId(newItem._id);

          return {
            ...(validResolvedId && { _id: validResolvedId }),
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
      const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : (order.discountValue || 0);
      const dName = discountName !== undefined ? discountName : (order.discountName || '');
      const dApplicableTo = applicableTo || order.applicableTo || 'all';
      const dTargetCategory = targetCategory !== undefined ? targetCategory : (order.targetCategory || '');

      let calculatedDiscount = 0;
      if (dType === 'percentage') {
        if (dApplicableTo === 'category' && dTargetCategory) {
          const targetCat = String(dTargetCategory).trim().toLowerCase();
          const eligibleSubtotal = updatedItems.reduce((sum, item) => {
            if (item.isCancelled) return sum;
            const itemCat = typeof item.category === 'object' && item.category !== null ? item.category.name : item.category;
            if (itemCat && String(itemCat).trim().toLowerCase() === targetCat) {
              const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
              return sum + (Number(item.price || 0) * activeQty);
            }
            return sum;
          }, 0);
          calculatedDiscount = (eligibleSubtotal * dValue) / 100;
        } else {
          calculatedDiscount = (subtotal * dValue) / 100;
        }
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
      const dCharge = deliveryCharge !== undefined ? (Number(deliveryCharge) || 0) : (Number(order.deliveryCharge) || 0);
      const cCharge = containerCharge !== undefined ? (Number(containerCharge) || 0) : (Number(order.containerCharge) || 0);
      const calculatedTotal = Math.round(taxableAmount + calculatedTax + dCharge + cCharge);

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
      const amountActuallyChanged = Math.abs((order.total || 0) - calculatedTotal) > 0.01 ||
        Math.abs((order.deliveryCharge || 0) - dCharge) > 0.01 ||
        Math.abs((order.containerCharge || 0) - cCharge) > 0.01 ||
        Math.abs((order.discount || 0) - calculatedDiscount) > 0.01;

      // An order is recorded in editHistory if it was ALREADY BILLED (locked) AND items OR charges/discounts changed!
      if (isAlreadyBilled && (itemsActuallyChanged || amountActuallyChanged)) {
        const previousState = {
          items: (order.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal: order.subtotal || 0,
          totalDiscount: order.discount || 0,
          totalTax: ((Math.max(0, (order.subtotal || 0) - (order.discount || 0))) * (order.tax || 0)) / 100,
          deliveryCharge: order.deliveryCharge || 0,
          containerCharge: order.containerCharge || 0,
          total: order.total || 0,
          discountType: order.discountType || 'flat',
          discountValue: order.discountValue || 0
        };

        const newState = {
          items: updatedItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal: subtotal,
          totalDiscount: calculatedDiscount,
          totalTax: calculatedTax,
          deliveryCharge: dCharge,
          containerCharge: cCharge,
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
        syncCustomer(req, order.customerPhone, order.customerName, billType || order.billType).catch(() => { });
      }
      order.kitchenNotes = kitchenNotes;
      order.billType = billType || order.billType;
      order.discountType = dType;
      order.discountValue = dValue;
      order.discountName = dName;
      order.applicableTo = dApplicableTo;
      order.targetCategory = dTargetCategory;
      order.discount = calculatedDiscount;
      order.deliveryCharge = dCharge;
      order.containerCharge = cCharge;

      if (!order.queueNumber) {
        try {
          const activeCount = await Bill.countDocuments({ status: { $in: ['Open', 'Billed'] } });
          const qNo = activeCount + 1;
          order.queueNumber = qNo;
          order.tokenNo = qNo;
        } catch (e) { }
      }

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
      if (order.status !== 'Billed' && order.status !== 'Paid') {
        order.status = 'Open';
      }
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
            freshOrder.deliveryCharge = dCharge;
            freshOrder.containerCharge = cCharge;
            freshOrder.total = calculatedTotal;
            if (freshOrder.status !== 'Billed' && freshOrder.status !== 'Paid') {
              freshOrder.status = 'Open';
            }
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
              deliveryCharge: dCharge,
              containerCharge: cCharge,
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
      const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : 0;
      const dName = discountName || '';
      const dApplicableTo = applicableTo || 'all';
      const dTargetCategory = targetCategory || '';

      let calculatedDiscount = 0;
      if (dType === 'percentage') {
        if (dApplicableTo === 'category' && dTargetCategory) {
          const targetCat = String(dTargetCategory).trim().toLowerCase();
          const eligibleSubtotal = sanitizedItems.reduce((sum, item) => {
            if (item.isCancelled) return sum;
            const itemCat = typeof item.category === 'object' && item.category !== null ? item.category.name : item.category;
            if (itemCat && String(itemCat).trim().toLowerCase() === targetCat) {
              const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
              return sum + (Number(item.price || 0) * activeQty);
            }
            return sum;
          }, 0);
          calculatedDiscount = (eligibleSubtotal * dValue) / 100;
        } else {
          calculatedDiscount = (subtotal * dValue) / 100;
        }
      } else if (dType === 'complimentary') {
        calculatedDiscount = subtotal;
      } else {
        calculatedDiscount = dValue;
      }

      const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
      const tRate = tax !== undefined ? Number(tax) : 0;
      const calculatedTax = (taxableAmount * tRate) / 100;
      const dChargeNew = Number(deliveryCharge) || 0;
      const cChargeNew = Number(containerCharge) || 0;
      const calculatedTotal = Math.round(taxableAmount + calculatedTax + dChargeNew + cChargeNew);

      let nextQueueNo = 1;
      try {
        const activeCount = await Bill.countDocuments({ status: { $in: ['Open', 'Billed'] } }).maxTimeMS(200).catch(() => 0);
        nextQueueNo = activeCount + 1;
      } catch (e) { }

      const restSnapshot = await getRestaurantSnapshot(req, restaurantDetails);
      const orderData = {
        tableNo,
        items: sanitizedItems,
        restaurantDetails: restSnapshot,
        subtotal,
        discount: calculatedDiscount,
        discountType: dType,
        discountValue: dValue,
        discountName: dName,
        applicableTo: dApplicableTo,
        targetCategory: dTargetCategory,
        tax: tRate,
        deliveryCharge: dChargeNew,
        containerCharge: cChargeNew,
        total: calculatedTotal,
        status: 'Open',
        billType: billType || 'Dine-In',
        customerName,
        customerPhone,
        kitchenNotes,
        queueNumber: nextQueueNo,
        tokenNo: nextQueueNo
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
        emitNotification(req, 'Order Updated', `Order for Table ${tableNo} was updated`, 'info', ['Chef', 'Manager', 'Admin', 'Captain']);
      } else {
        emitNotification(req, 'New Order Placed', `New order placed for Table ${tableNo}`, 'success', ['Chef', 'Manager', 'Admin', 'Captain']);
      }
    }

    // Update Floor/Table status in DB in background
    if (order.status === 'Open' && order.billType === 'Dine-In') {
      updateTableStatusHelper(req, order.tableNo, 'Occupied', order._id).catch(err => console.error('Table status update error:', err));
    }
    // Immediate CRM update in background
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
    const { discount, discountType, discountValue, discountName, applicableTo, targetCategory, tax, taxBreakdown, orderSource, customerName, customerPhone, deliveryCharge, containerCharge, restaurantDetails } = req.body;

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
    if (order.status === 'Paid') return res.status(400).json({ message: 'Audit Security: Cannot modify an already paid and settled bill' });

    if (!order.billedAt) {
      order.billedAt = new Date();
    }
    if (!order.restaurantDetails || !order.restaurantDetails.restaurantName) {
      order.restaurantDetails = await getRestaurantSnapshot(req, restaurantDetails);
    }
    const isExistingBilled = !!(order.billNumber || order.status === 'Billed');
    const prevSubtotal = order.subtotal || 0;
    const prevTotal = order.total || 0;
    const prevDiscount = order.discount || 0;
    const prevDeliveryCharge = order.deliveryCharge || 0;
    const prevContainerCharge = order.containerCharge || 0;
    const prevItems = (order.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total }));

    if (deliveryCharge !== undefined) order.deliveryCharge = Number(deliveryCharge) || 0;
    if (containerCharge !== undefined) order.containerCharge = Number(containerCharge) || 0;
    if (orderSource) order.orderSource = orderSource;
    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType).catch(() => { });
    }
    if (discount !== undefined) order.discount = Number(discount) || 0;
    if (discountType) order.discountType = discountType;
    if (discountValue !== undefined) order.discountValue = Number(discountValue) || 0;
    if (discountName !== undefined) order.discountName = discountName;
    if (applicableTo !== undefined) order.applicableTo = applicableTo;
    if (targetCategory !== undefined) order.targetCategory = targetCategory;
    if (tax !== undefined) order.tax = Number(tax) || 0;
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

    const amountChanged = Math.abs(prevTotal - order.total) > 0.01 ||
      Math.abs(prevDeliveryCharge - (Number(order.deliveryCharge) || 0)) > 0.01 ||
      Math.abs(prevContainerCharge - (Number(order.containerCharge) || 0)) > 0.01 ||
      Math.abs(prevDiscount - (Number(order.discount) || 0)) > 0.01;

    let billNumber = order.billNumber;
    if (!billNumber) {
      billNumber = await generateUniqueBillNumber(Bill);
    }

    if (isExistingBilled && amountChanged && billNumber) {
      order.editHistory = order.editHistory || [];
      order.editHistory.push({
        editedAt: new Date(),
        previousState: {
          items: prevItems,
          subtotal: prevSubtotal,
          totalDiscount: prevDiscount,
          totalTax: ((Math.max(0, prevSubtotal - prevDiscount)) * (order.tax || 0)) / 100,
          deliveryCharge: prevDeliveryCharge,
          containerCharge: prevContainerCharge,
          total: prevTotal,
          discountType: order.discountType || 'flat',
          discountValue: order.discountValue || 0
        },
        newState: {
          items: (order.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal: order.subtotal,
          totalDiscount: order.discount,
          totalTax: taxAmount,
          deliveryCharge: order.deliveryCharge || 0,
          containerCharge: order.containerCharge || 0,
          total: order.total,
          discountType: order.discountType || 'flat',
          discountValue: order.discountValue || 0
        }
      });
      order.isEdited = true;
    }

    order.status = 'Billed';
    order.billNumber = billNumber;

    let saveSuccess = false;
    let attempts = 0;
    while (!saveSuccess && attempts < 5) {
      attempts++;
      try {
        await order.save();
        saveSuccess = true;
      } catch (saveErr) {
        const isDupKey = saveErr.code === 11000 || saveErr.message?.includes('E11000') || saveErr.message?.includes('duplicate key');
        if (isDupKey && attempts < 5) {
          console.warn(`[generateBill] Duplicate billNumber ${order.billNumber} detected (attempt ${attempts}), regenerating...`);
          billNumber = await generateUniqueBillNumber(Bill);
          order.billNumber = billNumber;
          continue;
        }

        if (saveErr.name === 'VersionError' || saveErr.message?.includes('No matching document found')) {
          console.warn('[generateBill] VersionError caught, re-fetching fresh document...');
          const freshOrder = await Bill.findById(order._id);
          if (!freshOrder) return res.status(404).json({ message: 'Order not found after retry' });
          freshOrder.status = 'Billed';
          freshOrder.billNumber = billNumber;
          freshOrder.discount = order.discount;
          freshOrder.discountType = order.discountType;
          freshOrder.discountValue = order.discountValue;
          freshOrder.tax = order.tax;
          freshOrder.deliveryCharge = order.deliveryCharge;
          freshOrder.containerCharge = order.containerCharge;
          if (taxBreakdown) freshOrder.taxBreakdown = taxBreakdown;
          freshOrder.total = order.total;
          if (order.restaurantDetails && !freshOrder.restaurantDetails) {
            freshOrder.restaurantDetails = order.restaurantDetails;
          }
          if (order.billedAt && !freshOrder.billedAt) {
            freshOrder.billedAt = order.billedAt;
          }
          try {
            await freshOrder.save();
            order = freshOrder;
            saveSuccess = true;
          } catch (freshSaveErr) {
            const freshDup = freshSaveErr.code === 11000 || freshSaveErr.message?.includes('E11000') || freshSaveErr.message?.includes('duplicate key');
            if (freshDup && attempts < 5) {
              billNumber = await generateUniqueBillNumber(Bill);
              order.billNumber = billNumber;
              continue;
            }
            throw freshSaveErr;
          }
        } else {
          throw saveErr;
        }
      }
    }

    // Clear cache when bill is generated
    cache.clear('dailyStats');
    cache.clear('openOrders');

    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Billed', order });
    if (!isExistingBilled) {
      emitNotification(req, 'Bill Saved & Printed', `Bill #${billNumber} saved and printed for Table ${order.tableNo}`, 'success', ['Chef', 'Manager', 'Admin', 'Captain']);
    }

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
    const { paymentMode, splitPayments, upiApp, amountPaid, changeAmount, discount, discountType, discountValue, discountName, applicableTo, targetCategory, tax, taxBreakdown, total, subtotal, orderSource, customerName, customerPhone, deliveryCharge, containerCharge, restaurantDetails } = req.body;

    let order = null;
    if (id && id !== 'new' && mongoose.Types.ObjectId.isValid(id)) {
      order = await Bill.findById(id);
    }
    if (!order && id && id !== 'new') {
      order = await Bill.findOne({
        $or: [
          { billNumber: id },
          { tableNo: getTableMatchCondition(id), status: { $in: ['Open', 'Billed'] } }
        ]
      }).sort({ updatedAt: -1, createdAt: -1 });
    }
    if (!order) {
      // Direct settlement support: if order does not exist yet, create and settle in one atomic step
      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
        const tableNoToUse = req.body.tableNo || (id && id !== 'new' ? id : 'Walk-In');
        const restSnapshot = await getRestaurantSnapshot(req, restaurantDetails);
        order = new Bill({
          tableNo: tableNoToUse,
          items: req.body.items,
          billType: req.body.billType || 'Takeaway',
          status: 'Open',
          restaurantDetails: restSnapshot,
          billedAt: new Date(),
          settledAt: new Date()
        });
      } else {
        return res.status(404).json({ message: 'Order not found' });
      }
    }

    if (order.status === 'Paid') {
      return res.json(order);
    }

    if (!order.settledAt) {
      order.settledAt = new Date();
    }
    if (!order.billedAt) {
      order.billedAt = order.createdAt || new Date();
    }
    if (!order.restaurantDetails || !order.restaurantDetails.restaurantName) {
      order.restaurantDetails = await getRestaurantSnapshot(req, restaurantDetails);
    }

    if (req.body.items && Array.isArray(req.body.items) && (!order.items || order.items.length === 0)) {
      order.items = req.body.items;
    }
    if (req.body.billType) {
      order.billType = req.body.billType;
    }

    if (orderSource) order.orderSource = orderSource;
    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType).catch(() => { });
    }

    if (deliveryCharge !== undefined) order.deliveryCharge = Number(deliveryCharge) || 0;
    if (containerCharge !== undefined) order.containerCharge = Number(containerCharge) || 0;

    // Apply optional pricing/discount adjustments if sent directly
    if (discount !== undefined) order.discount = Number(discount) || 0;
    if (discountType) order.discountType = discountType;
    if (discountValue !== undefined) order.discountValue = Number(discountValue) || 0;
    if (discountName !== undefined) order.discountName = discountName;
    if (applicableTo !== undefined) order.applicableTo = applicableTo;
    if (targetCategory !== undefined) order.targetCategory = targetCategory;
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
    if (upiApp) {
      order.upiApp = upiApp;
    }

    if (amountPaid !== undefined) {
      order.amountPaid = Number(amountPaid) || 0;
      order.changeAmount = changeAmount !== undefined ? Number(changeAmount) || 0 : Math.max(0, (Number(amountPaid) || 0) - (order.total || 0));
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
      order.billNumber = await generateUniqueBillNumber(Bill);
    }

    // Save the bill with version retry protection & duplicate key retry protection
    let saveSuccess = false;
    let attempts = 0;
    while (!saveSuccess && attempts < 5) {
      attempts++;
      try {
        await order.save();
        saveSuccess = true;
      } catch (saveErr) {
        const isDupKey = saveErr.code === 11000 || saveErr.message?.includes('E11000') || saveErr.message?.includes('duplicate key');
        if (isDupKey && attempts < 5) {
          console.warn(`[settleBill] Duplicate billNumber ${order.billNumber} detected (attempt ${attempts}), regenerating...`);
          order.billNumber = await generateUniqueBillNumber(Bill);
          continue;
        }

        if (saveErr.name === 'VersionError' || saveErr.message?.includes('No matching document found')) {
          console.warn('[settleBill] VersionError caught, retrying on fresh document...');
          const freshOrder = await Bill.findById(order._id);
          if (freshOrder) {
            freshOrder.status = 'Paid';
            freshOrder.paymentMode = paymentMode;
            if (upiApp) freshOrder.upiApp = upiApp;
            if (amountPaid !== undefined) {
              freshOrder.amountPaid = Number(amountPaid) || 0;
              freshOrder.changeAmount = changeAmount !== undefined ? Number(changeAmount) || 0 : Math.max(0, (Number(amountPaid) || 0) - (freshOrder.total || 0));
            }
            if (paymentMode === 'Mixed' && splitPayments) {
              freshOrder.splitPayments = {
                cash: Number(splitPayments.cash) || 0,
                upi: Number(splitPayments.upi) || 0,
                card: Number(splitPayments.card) || 0
              };
            }
            freshOrder.updatedAt = new Date();
            if (!freshOrder.billNumber) freshOrder.billNumber = order.billNumber;
            if (order.restaurantDetails && !freshOrder.restaurantDetails) {
              freshOrder.restaurantDetails = order.restaurantDetails;
            }
            if (order.settledAt && !freshOrder.settledAt) {
              freshOrder.settledAt = order.settledAt;
            }
            if (order.billedAt && !freshOrder.billedAt) {
              freshOrder.billedAt = order.billedAt;
            }
            try {
              await freshOrder.save();
              order = freshOrder;
              saveSuccess = true;
            } catch (freshSaveErr) {
              const freshDup = freshSaveErr.code === 11000 || freshSaveErr.message?.includes('E11000') || freshSaveErr.message?.includes('duplicate key');
              if (freshDup && attempts < 5) {
                order.billNumber = await generateUniqueBillNumber(Bill);
                continue;
              }
              throw freshSaveErr;
            }
          }
        } else {
          throw saveErr;
        }
      }
    }

    // Clear cache when bill is settled (most important for dashboard)
    cache.clear('dailyStats');
    cache.clear('openOrders');

    // ⚡ INSTANT NOTIFICATION & SOCKET BROADCAST (0ms delay)
    emitSocketEvent(req, 'billSettled', { tableNo: order.tableNo, billNumber: order.billNumber, order, bill: order });
    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Paid', order });

    const cleanTable = (order.tableNo || '').replace(/^Table\s*/i, '');
    const billNumDisplay = order.billNumber ? `#${order.billNumber}` : '';
    const notifTitle = `Bill ${billNumDisplay} Settled`.trim();
    const notifMessage = order.billType === 'Dine-In'
      ? `Bill ${billNumDisplay} of ₹${order.total || 0} for Table ${cleanTable} settled via ${order.paymentMode || 'Cash'}`
      : `Bill ${billNumDisplay} of ₹${order.total || 0} settled via ${order.paymentMode || 'Cash'} (${order.billType || 'Takeaway'})`;

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
        billType: order.billType
      }
    );

    // Automatically deduct inventory stock & update CRM in background
    deductStockForBillItems(req, order.items, 'POS Billing Counter').catch(err => console.error('Auto stock deduction error:', err));
    updateCustomerFromBill(req, order).catch(err => console.error('Customer CRM update error:', err));

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
      .select('tableNo items total subtotal tax discount discountType discountValue discountName applicableTo targetCategory deliveryCharge containerCharge customerName customerPhone status billNumber billType orderSource queueNumber tokenNo createdAt')
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
      }).catch(() => { });


    const dynamicTaxRate = await getDynamicTaxRate(req);

    const formattedOrders = orders
      .filter(order => {
        const validItems = (order.items || []).filter(i => (Number(i.quantity || 0) > 0 || (i.printedQuantity || 0) > 0));
        return validItems.length > 0;
      })
      .map(order => {
        const subtotal = (order.items || []).reduce((acc, i) => acc + (i.isCancelled ? 0 : (Number(i.price || 0) * Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0)))), 0);
        const disc = Number(order.discount) || 0;
        const taxable = Math.max(0, subtotal - disc);
        const taxRate = order.status === 'Open' ? dynamicTaxRate : ((order.tax !== undefined && order.tax !== null) ? Number(order.tax) : dynamicTaxRate);
        const taxAmount = Number(((taxable * taxRate) / 100).toFixed(2));
        const dCharge = Number(order.deliveryCharge) || 0;
        const cCharge = Number(order.containerCharge) || 0;
        const computedTotal = Math.round(taxable + taxAmount + dCharge + cCharge);
        const finalTotal = (order.total !== undefined && Number(order.total) > 0) ? Number(order.total) : computedTotal;
        return {
          ...order,
          subtotal,
          tax: taxRate,
          deliveryCharge: dCharge,
          containerCharge: cCharge,
          total: finalTotal
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
      syncCustomer(req, order.customerPhone, order.customerName, order.billType || billType).catch(() => { });
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
