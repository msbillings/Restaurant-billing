import express from 'express';
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

// Public endpoint to fetch categories and active menu items
router.get('/menu', async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    const Setting = getTenantModel(req, 'Setting', SettingDefault);

    const categories = await Category.find();
    const items = await Menu.find({ isAvailable: true }).populate('category', 'name');
    
    let googleReviewLink = null;
    try {
      const setting = await Setting.findOne({ key: 'googleReviewLink' });
      if (setting && setting.value) googleReviewLink = setting.value;
    } catch (e) {
      console.log("Could not fetch google review link", e);
    }

    res.status(200).json({ categories, items, googleReviewLink });
  } catch (error) {
    console.error("Error fetching public menu:", error);
    res.status(500).json({ message: error.message });
  }
});

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
    const finalTotal = Math.round(subTotal || total || itemsSubtotal);

    // Case-insensitive table matching for open order
    const tableRegex = new RegExp('^' + tableNo.trim() + '$', 'i');
    let bill = await Bill.findOne({ tableNo: tableRegex, status: { $in: ['Open', 'open', 'Billed'] } });

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

      bill.subtotal = bill.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      bill.total = Math.round(bill.subtotal);
      bill.status = 'Open';
      bill.billType = bill.billType || 'Dine-In';

      if (!bill.kots) bill.kots = [];
      bill.kots.push(newKotTicket);

      await bill.save();
    } else {
      // Create new order
      bill = new Bill({
        tableNo,
        items: sanitizedItems.map(i => ({ ...i, printedQuantity: i.quantity })),
        subtotal: itemsSubtotal,
        total: finalTotal,
        tax: taxes || 0,
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
    
    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestDefault);
    
    const newRequest = new ServiceRequest({
      tableNumber,
      requestType,
      status: 'Pending'
    });
    
    await newRequest.save();
    
    // Emit persistent notification for Navbar Panel
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
    
    const cleanTable = tableNumber.replace('Table ', '');
    emitNotification(
      req,
      `${shopName} | Table ${cleanTable} Service`,
      `${requestType}`,
      'warning',
      ['Admin', 'Manager', 'Captain']
    );

    res.status(201).json({ message: 'Request sent successfully', request: newRequest });
  } catch (error) {
    console.error("Error requesting service:", error);
    res.status(500).json({ message: error.message });
  }
});

import os from 'os';

// Public endpoint to get order status for a table
router.get('/order-status', async (req, res) => {
  try {
    const { tableNo } = req.query;
    if (!tableNo) {
      return res.status(400).json({ message: 'tableNo is required' });
    }

    const Bill = getTenantModel(req, 'Bill', BillDefault);
    
    // Find the most recent active order for this table
    const tableRegex = new RegExp('^' + tableNo.trim() + '$', 'i');
    const bill = await Bill.findOne({ tableNo: tableRegex, status: { $in: ['Open', 'open', 'Billed'] } }).sort({ createdAt: -1 });
    
    if (!bill) {
      return res.status(404).json({ message: 'No active order found' });
    }

    let kitchenStatus = 'Preparing';
    if (bill.status === 'Billed') {
      kitchenStatus = 'Completed';
    } else if (bill.kots && bill.kots.length > 0) {
      const allItems = bill.kots.flatMap(k => k.items || []);
      if (allItems.length > 0) {
        const allReady = allItems.every(i => i.status === 'Ready');
        const anyPreparing = allItems.some(i => i.status === 'Preparing');
        if (allReady) {
          kitchenStatus = 'Ready';
        } else if (anyPreparing) {
          kitchenStatus = 'Preparing';
        } else {
          kitchenStatus = 'Pending';
        }
      }
    }

    res.status(200).json({
      _id: bill._id,
      status: bill.status,
      kitchenStatus,
      total: bill.total,
      subTotal: bill.subtotal || bill.total,
      itemsCount: bill.items.reduce((acc, item) => acc + (item.quantity || 1), 0)
    });
  } catch (error) {
    console.error("Error fetching order status:", error);
    res.status(500).json({ message: error.message });
  }
});
router.get('/system-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  res.status(200).json({ ip: localIP, port: process.env.VITE_PORT || 5173 });
});

export default router;
