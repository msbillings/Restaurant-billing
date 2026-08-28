import express from 'express';
import os from 'os';
const router = express.Router();
import MenuDefault from '../models/Menu.js';
import CategoryDefault from '../models/Category.js';
import BillDefault from '../models/Bill.js';
import ServiceRequestDefault from '../models/ServiceRequest.js';
import SettingDefault from '../models/Setting.js';
import ReservationDefault from '../models/Reservation.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { updateTableStatusHelper } from '../controllers/floorController.js';
import { printKOTToPrinters } from '../services/printerService.js';
import { emitNotification, emitDismissNotification, getTenantDbFromReq } from '../utils/notificationHelper.js';

// Helper to get indexed clean match for table/space variations (e.g. "Ground Floor - Cabin 1" vs "Ground Floor - Table 1" vs "Table 1")
export const getTableMatchCondition = (tblStr) => {
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

// In-memory cache for public menu per tenant with 30s TTL
export const publicMenuCache = new Map();
// In-memory cache for dynamic restaurant settings (tax rates, shop name) per tenant with 60s TTL
export const dynamicSettingsCache = new Map();

export const clearPublicMenuCache = (tenantKey) => {
  if (tenantKey) {
    publicMenuCache.delete(tenantKey);
    dynamicSettingsCache.delete(tenantKey);
  } else {
    publicMenuCache.clear();
    dynamicSettingsCache.clear();
  }
};

// Helper to dynamically load tax rates & settings with in-memory caching (60s TTL)
export const getCachedDynamicSettings = async (req) => {
  const tenantKey = getTenantDbFromReq(req) || req.query?.tenant || 'default';
  const cached = dynamicSettingsCache.get(tenantKey);
  if (cached && (Date.now() - cached.timestamp < 60000)) {
    return cached.data;
  }

  let taxRate = 0;
  let cgstRate = 0;
  let sgstRate = 0;
  let restaurantName = 'Savoria';

  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
    let s = {};
    if (settingsDoc?.value) {
      s = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
    }
    
    if (s.enableCgst) {
      cgstRate = Number(s.cgstRate || 0);
    }
    if (s.enableSgst) {
      sgstRate = Number(s.sgstRate || 0);
    }
    if (s.enableGst) {
      taxRate = Number(s.gstRate || 0);
      cgstRate = 0;
      sgstRate = 0;
    } else {
      taxRate = cgstRate + sgstRate;
    }
    if (s.restaurantName) {
      restaurantName = s.restaurantName;
    }
  } catch (e) {
    console.error("Error reading dynamic settings:", e);
  }

  const data = { taxRate, cgstRate, sgstRate, restaurantName };
  dynamicSettingsCache.set(tenantKey, { data, timestamp: Date.now() });
  return data;
};

// Fast helper to query active bill with exact indexed matches first before regex fallback
export const findActiveBillForTable = async (Bill, tableNo) => {
  if (!tableNo) return null;
  const trimmed = tableNo.trim();
  const directMatches = [trimmed];

  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    directMatches.push(parts.slice(1).join(' - ').trim()); // without floor prefix
  } else {
    directMatches.push(`Ground Floor - ${trimmed}`);
    directMatches.push(`First Floor - ${trimmed}`);
  }

  // 1. Fast indexed exact match first (0ms latency)
  let bill = await Bill.findOne({ 
    tableNo: { $in: directMatches }, 
    status: { $in: ['Open', 'open', 'Billed', 'Pending', 'Occupied'] } 
  }).sort({ createdAt: -1 });

  // 2. Fallback to regex pattern if not found by exact string
  if (!bill) {
    const tableRegex = getTableMatchCondition(tableNo);
    bill = await Bill.findOne({ 
      tableNo: tableRegex, 
      status: { $in: ['Open', 'open', 'Billed', 'Pending', 'Occupied'] } 
    }).sort({ createdAt: -1 });
  }

  return bill;
};

// Unified formatter for public bill payloads (used by /order, /order-status)
export const formatPublicBillPayload = (bill, taxSettings) => {
  if (!bill) return null;

  const { taxRate = 0, cgstRate = 0, sgstRate = 0 } = taxSettings || {};
  const allKots = bill.kots || [];

  const processedItems = (bill.items || []).map(item => {
    let prepMins = item.prepTimeMinutes || 0;
    let prepStart = item.prepStartTime || null;
    let kdsStatus = item.status || 'Pending';
    const qty = Number(item.quantity || 1);
    let unitStatuses = item.unitStatuses;

    if (allKots && Array.isArray(allKots) && allKots.length > 0) {
      for (let i = allKots.length - 1; i >= 0; i--) {
        const k = allKots[i];
        const matchingKi = (k.items || []).find(ki => 
          (ki._id && item._id && ki._id.toString() === item._id.toString()) ||
          (ki.name && item.name && ki.name.trim().toLowerCase() === item.name.trim().toLowerCase())
        );
        if (matchingKi) {
          if (matchingKi.status) {
            kdsStatus = matchingKi.status;
          }
          if (matchingKi.unitStatuses && Array.isArray(matchingKi.unitStatuses)) {
            unitStatuses = matchingKi.unitStatuses;
          }
          if (matchingKi.prepTimeMinutes) {
            prepMins = matchingKi.prepTimeMinutes;
            prepStart = matchingKi.prepStartTime;
          }
          break;
        }
      }
    }

    if (kdsStatus === 'Prepared') kdsStatus = 'Ready';

    const safeQty = Math.max(0, parseInt(qty || 0, 10) || 1);
    if (!unitStatuses || !Array.isArray(unitStatuses) || unitStatuses.length !== safeQty) {
      unitStatuses = Array.from({ length: safeQty }, () => kdsStatus);
    }

    const preparedQty = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
    const preparingQty = unitStatuses.filter(s => s === 'Preparing').length;
    const pendingQty = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

    const itemObj = item.toObject ? item.toObject() : item;
    return {
      ...itemObj,
      status: kdsStatus,
      kdsStatus: kdsStatus,
      unitStatuses,
      preparedQuantity: preparedQty,
      preparingQuantity: preparingQty,
      pendingQuantity: pendingQty,
      prepTimeMinutes: prepMins,
      prepStartTime: prepStart
    };
  });

  const activeProcessed = processedItems.filter(i => !i.isCancelled);
  let kitchenStatus = 'Pending';
  if (bill.status === 'Billed') {
    kitchenStatus = 'Completed';
  } else if (activeProcessed.length > 0) {
    const allReady = activeProcessed.every(i => i.kdsStatus === 'Ready' || (i.preparedQuantity === (i.quantity - (i.cancelledQuantity || 0))));
    const anyPreparing = activeProcessed.some(i => i.kdsStatus === 'Preparing' || i.preparingQuantity > 0);
    const anyReady = activeProcessed.some(i => i.kdsStatus === 'Ready' || i.preparedQuantity > 0);

    if (allReady) {
      kitchenStatus = 'Ready';
    } else if (anyPreparing || anyReady) {
      kitchenStatus = 'Preparing';
    } else {
      kitchenStatus = 'Pending';
    }
  }

  const subTotal = bill.subtotal || activeProcessed.reduce((acc, i) => acc + (i.price * (i.quantity - (i.cancelledQuantity || 0))), 0);
  const currentTaxRate = (bill.tax && bill.tax > 0) ? bill.tax : taxRate;

  let taxAmount = 0;
  let taxBreakdown = { cgst: 0, sgst: 0, igst: 0 };
  let computedTotal = bill.total;

  if (bill.status === 'Open' || bill.status === 'open' || bill.status === 'Occupied' || bill.status === 'Pending') {
    taxAmount = Number(((subTotal * currentTaxRate) / 100).toFixed(2));
    const effectiveCgst = currentTaxRate === taxRate ? cgstRate : currentTaxRate / 2;
    const effectiveSgst = currentTaxRate === taxRate ? sgstRate : currentTaxRate / 2;
    taxBreakdown = {
      cgst: Number(((subTotal * effectiveCgst) / 100).toFixed(2)),
      sgst: Number(((subTotal * effectiveSgst) / 100).toFixed(2)),
      igst: 0
    };
    computedTotal = Math.round(subTotal + taxAmount);
  } else {
    taxAmount = bill.taxBreakdown ? Number(((bill.taxBreakdown.cgst || 0) + (bill.taxBreakdown.sgst || 0) + (bill.taxBreakdown.igst || 0)).toFixed(2)) : Number(((subTotal * (bill.tax || 0)) / 100).toFixed(2));
    taxBreakdown = bill.taxBreakdown || { cgst: 0, sgst: 0, igst: 0 };
  }

  return {
    _id: bill._id,
    tableNo: bill.tableNo,
    billNumber: bill.billNumber,
    status: bill.status,
    kitchenStatus,
    total: computedTotal,
    tax: taxAmount,
    taxBreakdown,
    subTotal,
    subtotal: subTotal,
    itemsCount: activeProcessed.reduce((acc, item) => acc + (item.quantity - (item.cancelledQuantity || 0)), 0),
    items: processedItems,
    // Payment settlement fields for customer-facing status tracking
    paymentMode: bill.paymentMode || null,
    splitPayments: bill.splitPayments || null,
    upiApp: bill.upiApp || null,
    discount: bill.discount || 0,
    discountType: bill.discountType || null,
    discountValue: bill.discountValue || 0
  };
};

// Public endpoint to fetch categories and active menu items
// Public endpoint to fetch categories and active menu items with high-speed in-memory caching
router.get('/menu', async (req, res) => {
  try {
    const tenantKey = req.tenantDb || req.headers['x-tenant-db'] || req.query?.tenant || 'default';
    const cached = publicMenuCache.get(tenantKey);
    if (cached && (Date.now() - cached.timestamp < 60000)) {
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      return res.status(200).json(cached.data);
    }

    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    const Setting = getTenantModel(req, 'Setting', SettingDefault);

    const [categories, rawItems, settingDocs] = await Promise.all([
      Category.find().sort({ order: 1, name: 1 }).maxTimeMS(4000).lean().catch(() => []),
      Menu.find({ isAvailable: true }).maxTimeMS(4000).lean().catch(() => []),
      Setting.find({ key: { $in: ['googleReviewLink', 'restaurantSettings'] } }).maxTimeMS(3000).lean().catch(() => [])
    ]);

    // Build category map in memory for 0ms resolution without slow Mongoose populate overhead
    const categoryMap = new Map();
    (categories || []).forEach(cat => {
      if (cat._id) {
        categoryMap.set(String(cat._id), cat);
      }
    });

    const items = (rawItems || []).map(item => {
      if (item.category && typeof item.category === 'object' && item.category.name) {
        return item;
      }
      const catId = item.category ? String(item.category) : '';
      const matchedCat = categoryMap.get(catId);
      return {
        ...item,
        category: matchedCat ? { _id: matchedCat._id, name: matchedCat.name } : item.category
      };
    });

    let googleReviewLink = null;
    let restaurantSettings = {};

    if (Array.isArray(settingDocs)) {
      settingDocs.forEach(s => {
        if (s.key === 'googleReviewLink' && s.value) {
          googleReviewLink = s.value;
        } else if (s.key === 'restaurantSettings' && s.value) {
          restaurantSettings = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
        }
      });
    }

    const responsePayload = { categories: categories || [], items, googleReviewLink, restaurantSettings };
    publicMenuCache.set(tenantKey, { data: responsePayload, timestamp: Date.now() });

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error fetching public menu:", error);
    res.status(500).json({ message: error.message });
  }
});

// Public endpoint to submit an order from a customer with ultra-low latency response
router.post('/order', async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const Reservation = getTenantModel(req, 'Reservation', ReservationDefault);
    const { tableNo, items, total, subTotal, taxes } = req.body;

    if (!tableNo || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Table number and items are required' });
    }

    // Fast indexed reservation check for today only with lean execution
    const tableRegex = getTableMatchCondition(tableNo);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeReservations = await Reservation.find({
      tableType: tableRegex,
      date: { $gte: todayStart },
      status: { $in: ['pending', 'confirmed', 'seated'] }
    }).lean().maxTimeMS(1500).catch(() => []);
    
    const now = new Date();
    let isReserved = false;
    for (const reservation of activeReservations) {
      try {
        const resStart = new Date(`${new Date(reservation.date).toISOString().split('T')[0]}T${reservation.time}`);
        const resEnd = new Date(`${new Date(reservation.endDate || reservation.date).toISOString().split('T')[0]}T${reservation.endTime || reservation.time}`);
        if (now >= resStart && now <= resEnd) {
          isReserved = true;
          break;
        }
      } catch (e) {}
    }

    if (isReserved) {
      return res.status(409).json({ message: 'This table is currently reserved. Please speak to staff to order.' });
    }

    // Geofencing verification if enabled in restaurantSettings for this shop
    try {
      const Setting = getTenantModel(req, 'Setting', SettingDefault);
      const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean().catch(() => null);
      let restSettings = {};
      if (settingsDoc?.value) {
        restSettings = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
      }

      if (restSettings.enableGeoFencing && restSettings.latitude && restSettings.longitude) {
        const restLat = Number(restSettings.latitude);
        const restLng = Number(restSettings.longitude);
        const allowedRadius = Number(restSettings.geoFencingRadius) || 50;
        const { customerLocation } = req.body;

        if (customerLocation && customerLocation.latitude && customerLocation.longitude) {
          const custLat = Number(customerLocation.latitude);
          const custLng = Number(customerLocation.longitude);
          const accuracy = Number(customerLocation.accuracy) || 0;

          // Haversine calculation
          const R = 6371000;
          const toRad = (deg) => (deg * Math.PI) / 180;
          const dLat = toRad(custLat - restLat);
          const dLon = toRad(custLng - restLng);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(restLat)) * Math.cos(toRad(custLat)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = Math.max(0, Math.round(R * c));

          // Allow a 40m GPS accuracy buffer on the backend for indoor phones
          const effectiveDistance = Math.max(0, distance - Math.min(accuracy, 30));
          if (distance > allowedRadius + 50 && effectiveDistance > allowedRadius) {
            return res.status(403).json({ 
              message: `You appear to be ${distance}m away from the restaurant. Orders must be placed inside the restaurant premises (within ${allowedRadius}m).`,
              distance,
              allowedRadius
            });
          }
        }
      }
    } catch (geoCheckErr) {
      console.warn("Server geo check warning:", geoCheckErr);
    }

    // Sanitize items format safely (handles item._id, item.menuItem, and item.name)
    const sanitizedItems = items.map(item => ({
      _id: item._id || item.menuItem || item.id,
      name: item.name || item.itemName || 'Menu Item',
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
      specialNote: item.specialNote || '',
      orderedAt: item.orderedAt ? new Date(item.orderedAt) : new Date(),
      total: Number(item.price || 0) * Number(item.quantity || 1)
    }));

    const itemsSubtotal = sanitizedItems.reduce((acc, i) => acc + i.total, 0);

    // Fast indexed match first
    let bill = await findActiveBillForTable(Bill, tableNo);

    const kotNumber = `KOT-${(bill && bill.kots ? bill.kots.length : 0) + 1}`;
    const newKotTicket = {
      kotNumber,
      items: sanitizedItems.map(i => ({
        name: i.name,
        quantity: i.quantity,
        specialNote: i.specialNote || '',
        orderedAt: i.orderedAt || new Date(),
        status: 'Pending'
      })),
      createdAt: new Date()
    };

    const taxSettings = await getCachedDynamicSettings(req);
    const { taxRate, cgstRate, sgstRate } = taxSettings;

    if (bill) {
      // Append items to existing order safely
      sanitizedItems.forEach(newItem => {
        const existingItem = bill.items.find(i => 
          (i._id && newItem._id && i._id.toString() === newItem._id.toString()) ||
          (i.name && newItem.name && i.name.toLowerCase().trim() === newItem.name.toLowerCase().trim())
        );
        if (existingItem) {
          existingItem.quantity += newItem.quantity;
          existingItem.total = existingItem.price * existingItem.quantity;
          existingItem.printedQuantity = (existingItem.printedQuantity || 0) + newItem.quantity;
          if (!existingItem.orderedAt) {
            existingItem.orderedAt = newItem.orderedAt || new Date();
          }
        } else {
          bill.items.push({ ...newItem, printedQuantity: newItem.quantity, orderedAt: newItem.orderedAt || new Date() });
        }
      });

      bill.subtotal = bill.items.reduce((acc, i) => acc + (i.isCancelled ? 0 : (i.price * (i.quantity - (i.cancelledQuantity || 0)))), 0);
      
      const taxAmount = Number(((bill.subtotal * taxRate) / 100).toFixed(2));
      bill.tax = taxRate;
      bill.taxBreakdown = {
        cgst: Number(((bill.subtotal * cgstRate) / 100).toFixed(2)),
        sgst: Number(((bill.subtotal * sgstRate) / 100).toFixed(2)),
        igst: 0
      };
      bill.total = Math.round(bill.subtotal + taxAmount);
      bill.status = 'Open';
      bill.billType = bill.billType || 'Dine-In';

      if (!bill.kots) bill.kots = [];
      bill.kots.push(newKotTicket);

      await bill.save();
    } else {
      // Create new order
      const taxAmount = Number(((itemsSubtotal * taxRate) / 100).toFixed(2));
      const orderTotal = Math.round(itemsSubtotal + taxAmount);

      bill = new Bill({
        tableNo,
        items: sanitizedItems.map(i => ({ ...i, printedQuantity: i.quantity })),
        subtotal: itemsSubtotal,
        total: orderTotal,
        tax: taxRate,
        taxBreakdown: {
          cgst: Number(((itemsSubtotal * cgstRate) / 100).toFixed(2)),
          sgst: Number(((itemsSubtotal * sgstRate) / 100).toFixed(2)),
          igst: 0
        },
        status: 'Open',
        billType: 'Dine-In',
        kots: [newKotTicket],
        createdAt: new Date()
      });
      await bill.save();
    }

    // Prepare unified formatted payload for immediate customer response
    const formattedPayload = formatPublicBillPayload(bill, taxSettings);

    // ⚡ SYNCHRONOUS NOTIFICATION (Fixes missing 'Order Placed' notifications)
    try {
      const itemNames = sanitizedItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const cleanTable = tableNo.replace(/^Table\s*/i, '');
      emitNotification(
        req, 
        `Table ${cleanTable} Order`, 
        `${itemNames}`, 
        'success', 
        ['Admin', 'Manager', 'Captain', 'Chef'],
        { orderId: bill._id, type: 'digital_order', tableNo: bill.tableNo, total: bill.total }
      );
    } catch (notifErr) {
      console.warn("Notification error on public order:", notifErr.message);
    }

    // ⚡ INSTANT 201 RESPONSE TO CUSTOMER (No waiting on sockets or print queue)
    res.status(201).json(formattedPayload);

    // ⚡ BACKGROUND ASYNC: WebSockets, Floor update, and KOT Printing
    setImmediate(async () => {
      try {
        const io = req.app?.locals?.io;
        const tenantDb = getTenantDbFromReq(req);
        if (io) {
          const payloadOrder = { tableNo, status: 'Open', message: `New digital menu order from Table ${tableNo}`, orderId: bill._id, order: bill };
          const payloadKot = { tableNo, kotNumber, items: sanitizedItems, orderId: bill._id, kot: newKotTicket };
          if (tenantDb) {
            io.to(tenantDb).emit('orderUpdated', payloadOrder);
            io.to(tenantDb).emit('tableUpdated', { tableNo, status: 'Open' });
            io.to(tenantDb).emit('newKOT', payloadKot);
            io.to(tenantDb).emit('kotUpdated', payloadKot);
          } else {
            io.emit('orderUpdated', payloadOrder);
            io.emit('tableUpdated', { tableNo, status: 'Open' });
            io.emit('newKOT', payloadKot);
            io.emit('kotUpdated', payloadKot);
          }
        }
      } catch (sockErr) {
        console.warn("Socket broadcast error on public order:", sockErr.message);
      }

      try {
        await updateTableStatusHelper(req, tableNo, 'Open', bill._id);
      } catch (e) {
        console.warn("Could not update floor status for table", tableNo, e.message);
      }

      try {
        printKOTToPrinters(req, bill, kotNumber, sanitizedItems).catch(err => {
          console.error('[QR KOT Print Error]:', err.message);
        });
      } catch (printErr) {
        console.warn('[QR KOT Print Trigger Failed]:', printErr.message);
      }
    });
  } catch (error) {
    console.error("Error submitting public order:", error);
    res.status(500).json({ message: error.message || 'Failed to place order' });
  }
});

// Public endpoint to request service (Call Waiter, Water, Bill)
router.post('/request-service', async (req, res) => {
  try {
    const { tableNumber, requestType } = req.body;
    
    if (!tableNumber || !requestType) {
      return res.status(400).json({ message: 'tableNumber and requestType are required' });
    }
    
    const displayTable = tableNumber.startsWith('Table') ? tableNumber : `Table ${tableNumber}`;
    
    // ⚡ INSTANT WEBSOCKET BROADCAST (0ms latency to POS UI)
    emitNotification(
      req,
      `${displayTable} Service`,
      `${requestType}`,
      'warning',
      ['Admin', 'Manager', 'Captain']
    );

    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestDefault);
    const newRequest = new ServiceRequest({
      tableNumber,
      requestType,
      status: 'Pending'
    });
    
    await newRequest.save();

    res.status(201).json({ message: 'Request sent successfully', request: newRequest });
  } catch (error) {
    console.error("Error requesting service:", error);
    res.status(500).json({ message: error.message });
  }
});

// Public endpoint to get order status for a table
router.get('/order-status', async (req, res) => {
  try {
    const { tableNo } = req.query;
    if (!tableNo) {
      return res.status(400).json({ message: 'tableNo is required' });
    }

    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const bill = await findActiveBillForTable(Bill, tableNo);
    
    if (!bill) {
      return res.status(404).json({ message: 'No active order found' });
    }

    const taxSettings = await getCachedDynamicSettings(req);
    const formatted = formatPublicBillPayload(bill, taxSettings);

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Error fetching order status:", error);
    res.status(500).json({ message: error.message });
  }
});

// Public endpoint to request item cancellation
router.post('/request-item-cancel', async (req, res) => {
  try {
    const { orderId, itemId, tableNo, cancelQty } = req.body;
    if (!orderId || !itemId) {
      return res.status(400).json({ message: 'orderId and itemId are required' });
    }

    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const bill = await Bill.findById(orderId);
    
    if (!bill) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let item = null;
    if (bill.items && typeof bill.items.id === 'function') {
      try {
        item = bill.items.id(itemId);
      } catch (e) {}
    }
    if (!item && bill.items) {
      item = bill.items.find(i => (i._id && i._id.toString() === itemId?.toString()) || (i.id && i.id.toString() === itemId?.toString()));
    }
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    item.cancellationRequested = true;
    item.cancellationRequestedQty = cancelQty || item.quantity;
    bill.markModified('items');
    await bill.save();

    // Use cached settings for shop name
    const { restaurantName: shopName } = await getCachedDynamicSettings(req);

    const cleanTable = (tableNo || bill.tableNo || '').replace('Table ', '');
    const io = req.app?.locals?.io;
    const tenantDb = req.headers['x-tenant-db'];

    emitNotification(
      req,
      `${shopName} | Table ${cleanTable} Cancel Req`,
      `${item.cancellationRequestedQty}x ${item.name}`,
      'error',
      ['Admin', 'Manager', 'Captain'],
      { orderId: bill._id, itemId: item._id, type: 'cancel_item_request', itemName: item.name, cancelQty: item.cancellationRequestedQty, tableNo: bill.tableNo }
    );

    if (io && tenantDb) {
      io.to(tenantDb).emit('itemCancellationRequested', { 
        orderId: bill._id, 
        itemId: item._id, 
        tableNo: bill.tableNo,
        itemName: item.name,
        cancelQty: item.cancellationRequestedQty
      });
      io.to(tenantDb).emit('orderUpdated', { tableNo: bill.tableNo, status: bill.status });
    }

    res.status(200).json({ message: 'Cancellation requested successfully', item });
  } catch (error) {
    console.error("Error requesting item cancellation:", error);
    res.status(500).json({ message: error.message });
  }
});

// Public endpoint to withdraw item cancellation request
router.post('/withdraw-item-cancel', async (req, res) => {
  try {
    const { orderId, itemId, tableNo } = req.body;
    if (!orderId || !itemId) {
      return res.status(400).json({ message: 'orderId and itemId are required' });
    }

    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const bill = await Bill.findById(orderId);
    
    if (!bill) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let item = null;
    if (bill.items && typeof bill.items.id === 'function') {
      try {
        item = bill.items.id(itemId);
      } catch (e) {}
    }
    if (!item && bill.items) {
      item = bill.items.find(i => (i._id && i._id.toString() === itemId?.toString()) || (i.id && i.id.toString() === itemId?.toString()));
    }
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    item.cancellationRequested = false;
    item.cancellationRequestedQty = 0;
    bill.markModified('items');
    await bill.save();

    const io = req.app?.locals?.io;
    const tenantDb = req.headers['x-tenant-db'];

    // 1. ⚡ Dismiss & permanently delete the cancellation request notification from DB & all Admin/Captain panels
    await emitDismissNotification(req, {
      type: 'cancel_item_request',
      orderId: bill._id,
      itemId: item._id,
      itemName: item.name,
      tableNo: bill.tableNo
    });

    // 2. ⚡ Emit an informative notification that the cancel was withdrawn
    const cleanTable = (tableNo || bill.tableNo || '').replace('Table ', '');
    const { restaurantName: shopName } = await getCachedDynamicSettings(req);
    emitNotification(
      req,
      `${shopName} | Table ${cleanTable} Cancel Withdrawn`,
      `${item.name} cancel request was withdrawn by customer`,
      'info',
      ['Admin', 'Manager', 'Captain'],
      { orderId: bill._id, itemId: item._id, type: 'cancel_item_withdrawn', itemName: item.name, tableNo: bill.tableNo }
    );

    if (io && tenantDb) {
      io.to(tenantDb).emit('itemCancellationWithdrawn', { 
        orderId: bill._id, 
        itemId: item._id, 
        tableNo: bill.tableNo,
        itemName: item.name
      });
      io.to(tenantDb).emit('orderUpdated', { tableNo: bill.tableNo, status: bill.status });
    }

    res.status(200).json({ message: 'Cancellation request withdrawn successfully', item });
  } catch (error) {
    console.error("Error withdrawing item cancellation:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/system-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  let candidateIPs = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /vbox|virtual|vmnet|vethernet|docker|wsl|tap|tun/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) {
          candidateIPs.unshift(iface.address);
        } else {
          candidateIPs.push(iface.address);
        }
      }
    }
  }

  if (candidateIPs.length > 0) {
    localIP = candidateIPs[0];
  }

  const serverPort = process.env.PORT || 5002;
  res.status(200).json({ ip: localIP, port: serverPort });
});

export default router;
