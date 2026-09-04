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
    if (orderSource && orderSource !== 'all' && orderSource !== 'All') {
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

    // Date range filter (inclusive of full days)
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        if (!isNaN(s.getTime())) {
          s.setHours(0, 0, 0, 0);
          query.createdAt.$gte = s;
        }
      }
      if (endDate) {
        const e = new Date(endDate);
        if (!isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999);
          query.createdAt.$lte = e;
        }
      }
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
    // Note: Exclude heavy arrays (items, restaurantDetails) from summary list to keep pagination ultra-light (<10KB)
    const [bills, total] = await Promise.all([
      Bill.find(query)
        .select('billNumber tableNo billType paymentMode splitPayments upiApp amountPaid changeAmount subtotal tax taxBreakdown discount discountType discountValue deliveryCharge containerCharge total orderSource status customerName customerPhone billedAt settledAt createdAt updatedAt')
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
    const billDoc = await Bill.findById(id).lean();
    if (!billDoc) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const bill = { ...billDoc };

    // Freeze snapshot for legacy bills that were created before snapshotting (computed in-memory without blocking writes)
    if (!bill.restaurantDetails || !bill.restaurantDetails.restaurantName) {
      try {
        const Setting = getTenantModel(req, 'Setting', SettingDefault);
        const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
        const settings = settingsDoc?.value ? (typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value) : {};
        if (settings && (settings.restaurantName || settings.address)) {
          bill.restaurantDetails = {
            restaurantName: settings.restaurantName || 'MSBILLINGS',
            restaurantType: settings.restaurantType || 'Restaurant',
            address: settings.address || '',
            phone: settings.phone || '',
            email: settings.email || '',
            gstin: settings.gstin || '',
            fssai: settings.fssai || '',
            logo: (settings.logo && settings.logo !== '[logo_stored]') ? settings.logo : '',
            upiId: settings.upiId || '',
            enableQrPayment: settings.enableQrPayment !== false,
            footerMessage: settings.footerMessage || '',
            tagline: settings.tagline || '',
            printFormat: settings.printFormat || '80mm',
            taxSettings: {
              enableCgst: settings.enableCgst !== false,
              enableSgst: settings.enableSgst !== false,
              enableGst: settings.enableGst === true,
              cgstRate: settings.cgstRate !== undefined ? Number(settings.cgstRate) : 2.5,
              sgstRate: settings.sgstRate !== undefined ? Number(settings.sgstRate) : 2.5,
              gstRate: settings.gstRate !== undefined ? Number(settings.gstRate) : 5
            }
          };
          if (bill.status === 'Paid' || bill.status === 'Billed') {
            // Non-blocking background sync for legacy bills
            Bill.findByIdAndUpdate(bill._id, { restaurantDetails: bill.restaurantDetails }).catch(() => {});
          }
        }
      } catch (e) {}
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

// Get all edited bills
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

    // Filter out any false-positive historical entries where items and charges were identical before and after
    const genuinelyEdited = (editedBills || []).filter(b => {
      if (!b.editHistory || b.editHistory.length === 0) return b.isEdited === true;
      return b.editHistory.some(e => {
        const prevItems = (e.previousState?.items || []).filter(i => (i.quantity || 0) > 0).map(i => `${(i.name || '').trim()}:${i.quantity}`).sort().join(',');
        const newItems = (e.newState?.items || []).filter(i => (i.quantity || 0) > 0).map(i => `${(i.name || '').trim()}:${i.quantity}`).sort().join(',');
        const totalChanged = Math.abs((e.previousState?.total || 0) - (e.newState?.total || 0)) > 0.01;
        const chargesChanged = Math.abs((e.previousState?.deliveryCharge || 0) - (e.newState?.deliveryCharge || 0)) > 0.01 || Math.abs((e.previousState?.containerCharge || 0) - (e.newState?.containerCharge || 0)) > 0.01;
        return prevItems !== newItems || totalChanged || chargesChanged;
      });
    });
    
    res.json(genuinelyEdited);
  } catch (error) {
    console.error('Error fetching edited bills:', error);
    res.status(500).json({ message: 'Server error while fetching edited bills' });
  }
};
