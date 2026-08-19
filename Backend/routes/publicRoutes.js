import express from 'express';
import os from 'os';
const router = express.Router();
import MenuDefault from '../models/Menu.js';
import CategoryDefault from '../models/Category.js';
import BillDefault from '../models/Bill.js';
import ServiceRequestDefault from '../models/ServiceRequest.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import SettingDefault from '../models/Setting.js';
import { updateTableStatusHelper } from '../controllers/floorController.js';
import { printKOTToPrinters } from '../services/printerService.js';
import { emitNotification } from '../utils/notificationHelper.js';

// Helper to get indexed clean match for table/space variations (e.g. "Ground Floor - Cabin 1" vs "Ground Floor - Table 1")
export const getTableMatchCondition = (tblStr) => {
  if (!tblStr) return tblStr;
  const trimmed = tblStr.trim();
  
  // If floor prefix exists (e.g. "Ground Floor - Cabin 1", "First Floor - Table 2", "Ground Floor - Sofa 3")
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    const floorPart = parts[0].trim();
    const tablePart = parts.slice(1).join(' - ').trim();
    
    const escapedFloor = floorPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedTable = tablePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const patterns = [];
    // Exact match: "Ground Floor - Cabin 1"
    patterns.push(`^${escapedFloor}\\s*-\\s*${escapedTable}$`);
    
    // Check if tablePart has a space type word and number (e.g. "Cabin 1", "Sofa 2", "Table 3", "Room 4")
    const spaceMatch = tablePart.match(/^([A-Za-z]+)\s*0*(\d+)$/);
    if (spaceMatch) {
      const type = spaceMatch[1]; // e.g. "Cabin", "Table", "Sofa"
      const num = parseInt(spaceMatch[2], 10);
      const firstLetter = type.charAt(0);
      // Matches "Ground Floor - Cabin 1", "Ground Floor - Cabin 01", "Ground Floor - C1", "Ground Floor - C-1"
      // NEVER cross-matches other space types like "Table" or "Sofa"!
      patterns.push(`^${escapedFloor}\\s*-\\s*(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
    } else {
      const numOnly = tablePart.match(/^0*(\d+)$/);
      if (numOnly) {
        const num = parseInt(numOnly[1], 10);
        // Matches "Ground Floor - 1", "Ground Floor - 01"
        patterns.push(`^${escapedFloor}\\s*-\\s*0*${num}$`);
      }
    }
    
    return new RegExp(`(?:${patterns.join('|')})`, 'i');
  }

  // If no floor prefix (e.g. "Cabin 1", "Table 2", "Sofa 3", "2"):
  const escapedTrimmed = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [];
  patterns.push(`^${escapedTrimmed}$`);
  
  const spaceMatch = trimmed.match(/^([A-Za-z]+)\s*0*(\d+)$/);
  if (spaceMatch) {
    const type = spaceMatch[1];
    const num = parseInt(spaceMatch[2], 10);
    const firstLetter = type.charAt(0);
    patterns.push(`^(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
  } else {
    const numOnly = trimmed.match(/^0*(\d+)$/);
    if (numOnly) {
      const num = parseInt(numOnly[1], 10);
      patterns.push(`^0*${num}$`);
    }
  }
  
  return new RegExp(`(?:${patterns.join('|')})`, 'i');
};

// In-memory cache for public menu per tenant with 60s TTL
const publicMenuCache = new Map();

// Public endpoint to fetch categories and active menu items
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

    const [categories, items, settingDocs] = await Promise.all([
      Category.find().sort({ order: 1, name: 1 }).maxTimeMS(8000).lean(),
      Menu.find({ isAvailable: true }).populate('category', 'name').maxTimeMS(8000).lean(),
      Setting.find({ key: { $in: ['googleReviewLink', 'restaurantSettings'] } }).maxTimeMS(8000).lean()
    ]);

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

    const responsePayload = { categories, items, googleReviewLink, restaurantSettings };
    publicMenuCache.set(tenantKey, { data: responsePayload, timestamp: Date.now() });

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error fetching public menu:", error);
    res.status(500).json({ message: error.message });
  }
});

// Helper to dynamically load tax rates from restaurantSettings in DB
const getDynamicTaxSettings = async (req) => {
  let taxRate = 0;
  let cgstRate = 0;
  let sgstRate = 0;
  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' });
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
  } catch (e) {
    console.error("Error reading dynamic tax settings:", e);
    taxRate = 0;
    cgstRate = 0;
    sgstRate = 0;
  }
  return { taxRate, cgstRate, sgstRate };
};

// Public endpoint to submit an order from a customer
router.post('/order', async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { tableNo, items, total, subTotal, taxes } = req.body;

    if (!tableNo || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Table number and items are required' });
    }

    // Sanitize items format safely (handles item._id and item.name)
    const sanitizedItems = items.map(item => ({
      _id: item._id,
      name: item.name || item.itemName || 'Menu Item',
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
      specialNote: item.specialNote || '',
      total: Number(item.price || 0) * Number(item.quantity || 1)
    }));

    const itemsSubtotal = sanitizedItems.reduce((acc, i) => acc + i.total, 0);

    // Case-insensitive table matching for open order
    const tableRegex = getTableMatchCondition(tableNo);
    let bill = await Bill.findOne({ tableNo: tableRegex, status: { $in: ['Open', 'open', 'Billed', 'Pending', 'Occupied'] } });

    const kotNumber = `KOT-${(bill && bill.kots ? bill.kots.length : 0) + 1}`;
    const newKotTicket = {
      kotNumber,
      items: sanitizedItems.map(i => ({
        name: i.name,
        quantity: i.quantity,
        specialNote: i.specialNote || '',
        status: 'Pending'
      })),
      createdAt: new Date()
    };

    const { taxRate, cgstRate, sgstRate } = await getDynamicTaxSettings(req);

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
        } else {
          bill.items.push({ ...newItem, printedQuantity: newItem.quantity });
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

    // Update table occupied status on Floor Management
    try {
      await updateTableStatusHelper(req, tableNo, 'Open', bill._id);
    } catch (e) {
      console.warn("Could not update floor status for table", tableNo, e.message);
    }

    // Emit socket events to notify POS, Floor, KDS, and Kitchen Screens
    const io = req.app?.locals?.io;
    const tenantDb = req.headers['x-tenant-db'];
    if (io && tenantDb) {
      io.to(tenantDb).emit('orderUpdated', { tableNo, status: 'Open', message: `New digital menu order from Table ${tableNo}` });
      io.to(tenantDb).emit('tableUpdated', { tableNo, status: 'Open' });
      io.to(tenantDb).emit('newKOT', { tableNo, kotNumber, items: sanitizedItems });
      io.to(tenantDb).emit('kotUpdated', { tableNo, kotNumber });
    }

    // Trigger physical network thermal printing for new digital QR menu order
    try {
      printKOTToPrinters(req, bill, kotNumber, sanitizedItems).catch(err => {
        console.error('[QR KOT Print Error]:', err.message);
      });
    } catch (printErr) {
      console.warn('[QR KOT Print Trigger Failed]:', printErr.message);
    }

    // Emit persistent notification for Navbar Panel (including items)
    const itemNames = sanitizedItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
    
    // Get actual restaurant name
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' });
    let shopName = 'Unknown Shop';
    if (settingsDoc?.value) {
      if (typeof settingsDoc.value === 'string') {
        try {
          const parsed = JSON.parse(settingsDoc.value);
          shopName = parsed.restaurantName || 'Unknown Shop';
        } catch (e) {}
      } else {
        shopName = settingsDoc.value.restaurantName || 'Unknown Shop';
      }
    }
    
    const cleanTable = tableNo.replace('Table ', '');
    emitNotification(
      req, 
      `${shopName} | Table ${cleanTable} Order`, 
      `${itemNames}`, 
      'success', 
      ['Admin', 'Manager', 'Captain', 'Chef']
    );

    res.status(201).json(bill);
  } catch (error) {
    console.error("Error submitting public order:", error);
    res.status(500).json({ message: error.message });
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
    
    // Find the most recent active order for this table
    const tableRegex = getTableMatchCondition(tableNo);
    const bill = await Bill.findOne({ 
      tableNo: tableRegex, 
      status: { $in: ['Open', 'open', 'Billed', 'Pending', 'Occupied'] } 
    }).sort({ createdAt: -1 });
    
    if (!bill) {
      return res.status(404).json({ message: 'No active order found' });
    }

    let kitchenStatus = 'Pending';
    if (bill.status === 'Billed') {
      kitchenStatus = 'Completed';
    } else {
      let allItems = [];
      if (bill.kots && bill.kots.length > 0) {
        allItems = bill.kots.flatMap(k => k.items || []).filter(i => !i.isCancelled);
      }
      if (allItems.length === 0 && bill.items && bill.items.length > 0) {
        allItems = bill.items.filter(i => !i.isCancelled);
      }

      if (allItems.length > 0) {
        const allReady = allItems.every(i => i.status === 'Ready');
        const anyPreparing = allItems.some(i => i.status === 'Preparing');
        const anyReady = allItems.some(i => i.status === 'Ready');
        if (allReady) {
          kitchenStatus = 'Ready';
        } else if (anyPreparing || anyReady) {
          kitchenStatus = 'Preparing';
        } else {
          kitchenStatus = 'Pending';
        }
      }
    }

    const { taxRate, cgstRate, sgstRate } = await getDynamicTaxSettings(req);
    const subTotal = bill.subtotal || bill.items.reduce((acc, i) => acc + (i.isCancelled ? 0 : (i.price * (i.quantity - (i.cancelledQuantity || 0)))), 0);
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

    const processedItems = (bill.items || []).map(item => {
      let prepMins = item.prepTimeMinutes;
      let prepStart = item.prepStartTime;
      let kdsStatus = item.status || 'Pending'; // default to item.status if present

      if (bill.kots) {
        bill.kots.forEach(k => {
          (k.items || []).forEach(ki => {
            if (ki.name === item.name || (ki._id && ki._id.toString() === item._id?.toString())) {
              if (ki.prepTimeMinutes) {
                prepMins = ki.prepTimeMinutes;
                prepStart = ki.prepStartTime;
              }
              // Prioritize Ready, then Preparing, then others
              if (ki.status === 'Ready') {
                kdsStatus = 'Ready';
              } else if (ki.status === 'Preparing' && kdsStatus !== 'Ready') {
                kdsStatus = 'Preparing';
              } else if (ki.status && kdsStatus === 'Pending') {
                kdsStatus = ki.status;
              }
            }
          });
        });
      }

      const itemObj = item.toObject ? item.toObject() : item;
      return {
        ...itemObj,
        prepTimeMinutes: prepMins || 0,
        prepStartTime: prepStart || null,
        kdsStatus // 'Pending' | 'Preparing' | 'Ready'
      };
    });

    res.status(200).json({
      _id: bill._id,
      billNumber: bill.billNumber,
      status: bill.status,
      kitchenStatus,
      total: computedTotal,
      tax: taxAmount,
      taxBreakdown,
      subTotal,
      itemsCount: bill.items.reduce((acc, item) => acc + (item.isCancelled ? 0 : (item.quantity - (item.cancelledQuantity || 0))), 0),
      items: processedItems
    });
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

    // Emit notification to admin
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' });
    let shopName = 'Unknown Shop';
    if (settingsDoc?.value) {
      if (typeof settingsDoc.value === 'string') {
        try {
          const parsed = JSON.parse(settingsDoc.value);
          shopName = parsed.restaurantName || 'Unknown Shop';
        } catch (e) {}
      } else {
        shopName = settingsDoc.value.restaurantName || 'Unknown Shop';
      }
    }

    const cleanTable = (tableNo || bill.tableNo || '').replace('Table ', '');
    const io = req.app?.locals?.io;
    const tenantDb = req.headers['x-tenant-db'];

    emitNotification(
      req,
      `${shopName} | Table ${cleanTable} Cancel Req`,
      `${item.cancellationRequestedQty}x ${item.name}`,
      'error',
      ['Admin', 'Manager', 'Captain'],
      { orderId: bill._id, itemId: item._id, type: 'cancel_item_request', itemName: item.name, cancelQty: item.cancellationRequestedQty }
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
