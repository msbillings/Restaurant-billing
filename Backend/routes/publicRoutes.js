import express from 'express';
const router = express.Router();
import MenuDefault from '../models/Menu.js';
import CategoryDefault from '../models/Category.js';
import BillDefault from '../models/Bill.js';
import ServiceRequestDefault from '../models/ServiceRequest.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Public endpoint to fetch categories and active menu items
router.get('/menu', async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const Category = getTenantModel(req, 'Category', CategoryDefault);

    const categories = await Category.find();
    const items = await Menu.find({ isAvailable: true }).populate('category', 'name');

    res.status(200).json({ categories, items });
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

    if (!tableNo || !items || items.length === 0) {
      return res.status(400).json({ message: 'Table number and items are required' });
    }

    // Check if there is an open order for this table
    let bill = await Bill.findOne({ tableNo, status: 'open' });

    if (bill) {
      // Append items to existing order
      items.forEach(newItem => {
        const existingItem = bill.items.find(i => 
          i.menuItem.toString() === newItem.menuItem && 
          i.variant === newItem.variant
        );
        if (existingItem) {
          existingItem.quantity += newItem.quantity;
        } else {
          bill.items.push(newItem);
        }
      });
      bill.subTotal = (bill.subTotal || 0) + (subTotal || 0);
      bill.taxes = (bill.taxes || 0) + (taxes || 0);
      bill.total = (bill.total || 0) + (total || 0);
    } else {
      // Create new order
      bill = new Bill({
        tableNo,
        items,
        subTotal: subTotal || total,
        total,
        taxes: taxes || 0,
        status: 'open',
        date: new Date()
      });
    }

    await bill.save();

    // Emit socket event to notify POS and KDS
    const io = req.app?.locals?.io;
    if (io) {
      const tenantDb = req.headers['x-tenant-db'];
      if (tenantDb) {
        io.to(tenantDb).emit('orderUpdated', { message: `New order received from ${tableNo}` });
        io.to(tenantDb).emit('newKOT', { tableNo });
      }
    }

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
    
    res.status(201).json({ message: 'Request sent successfully', request: newRequest });
  } catch (error) {
    console.error("Error requesting service:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
