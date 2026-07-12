import BillDefault from '../models/Bill.js';
import UserDefault from '../models/User.js';
import cache from '../utils/cache.js';
import { deductStockForBillItems } from './inventoryController.js';
import { updateTableStatusHelper } from './floorController.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';
import { updateCustomerFromBill, syncCustomer } from './customerController.js';

const emitSocketEvent = (req, eventName, data) => {
  try {
    const io = req.app?.locals?.io;
    if (io) {
      const tenantDb = req.models?.connection?.name || req.headers['x-tenant-db'];
      if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
        io.to(tenantDb).emit(eventName, data);
        console.log(`[Socket] Broadcasted event ${eventName} securely to tenant room: ${tenantDb}`);
      } else {
        io.emit(eventName, data);
      }
    }
  } catch (err) {
    console.error('Socket emit error:', err);
  }
};

// Helper to get case-insensitive clean regex match for table variations (e.g. "Table 1" vs "Ground Floor - Table 1")
const getTableMatchCondition = (tblStr) => {
  if (!tblStr) return tblStr;
  const cleanName = tblStr.includes(' - ') ? tblStr.split(' - ').slice(1).join(' - ').trim() : tblStr.trim();
  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $regex: new RegExp(`^.*${escaped}$`, 'i') };
};

// Get active order for a table
export const getActiveOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { tableNo } = req.params;
    const order = await Bill.findOne({ 
      tableNo: getTableMatchCondition(tableNo), 
      status: { $in: ['Open', 'Billed'] } 
    });
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
    const sanitizedItems = items.map(item => ({
      name: item.name,
      price: Number(item.price),
      quantity: Number(item.quantity),
      total: Number(item.price) * Number(item.quantity)
    }));

    let order;
    if (id) {
      order = await Bill.findById(id);
    } else {
      order = await Bill.findOne({ 
        tableNo: getTableMatchCondition(tableNo), 
        status: { $in: ['Open', 'Billed'] } 
      });
    }

    const subtotal = sanitizedItems.reduce((sum, item) => sum + item.total, 0);

    if (order) {
      // Preserve printedQuantity for existing items
      const updatedItems = sanitizedItems.map(newItem => {
        const existingItem = order.items.find(i => i.name === newItem.name);
        if (existingItem && existingItem.printedQuantity !== undefined) {
          return { ...newItem, printedQuantity: existingItem.printedQuantity };
        }
        return newItem;
      });

      // Update existing order
      // Track edit history if a KOT was already printed or the bill was somehow not open
      const previousState = {
        items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
        subtotal: order.subtotal,
        totalDiscount: order.discount || 0,
        totalTax: order.tax || 0,
        total: order.total
      };

      const dType = discountType || order.discountType || 'flat';
      const dValue = discountValue !== undefined ? discountValue : (order.discountValue || 0);
      let calculatedDiscount = 0;
      if (dType === 'percentage') {
        calculatedDiscount = (subtotal * dValue) / 100;
      } else {
        calculatedDiscount = dValue;
      }

      const taxableAmount = subtotal - calculatedDiscount;
      const tRate = tax !== undefined ? tax : (order.tax || 0);
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
      order.total = calculatedTotal;
      
      await order.save();
    } else {
      // Create new order
      const dType = discountType || 'flat';
      const dValue = discountValue || 0;
      let calculatedDiscount = 0;
      if (dType === 'percentage') {
        calculatedDiscount = (subtotal * dValue) / 100;
      } else {
        calculatedDiscount = dValue;
      }

      const taxableAmount = subtotal - calculatedDiscount;
      const tRate = tax !== undefined ? tax : 0;
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

    const order = await Bill.findById(id);
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

    await order.save();
    
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
    
    if (order.status !== 'Open') {
      return res.status(400).json({ message: 'Only open orders can be transferred' });
    }

    // Check if new table is already occupied by an Open order
    const existingOrder = await Bill.findOne({ tableNo: newTableNo, status: 'Open' });
    if (existingOrder) {
      return res.status(400).json({ message: `Table ${newTableNo} is already occupied` });
    }

    const oldTableNo = order.tableNo;
    order.tableNo = newTableNo;
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
    .select('tableNo items total status billNumber billType orderSource createdAt') // Include orderSource for delivery filtering
    .sort({ createdAt: -1 })
    .limit(100) // Limit to 100 most recent active orders
    .lean(); // Use lean for faster queries
    
    // Cache for 10 seconds (active orders change frequently)
    // cache.set(cacheKey, orders, 10000);
    
    res.json(orders);
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
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
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
            createdAt: { $gte: today, $lt: tomorrow },
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
            createdAt: { $gte: today, $lt: tomorrow },
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
            createdAt: { $gte: today, $lt: tomorrow },
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
        createdAt: { $gte: today, $lt: tomorrow },
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
        createdAt: { $gte: today, $lt: tomorrow },
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
        createdAt: { $gte: today, $lt: tomorrow },
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
        createdAt: { $gte: today, $lt: tomorrow },
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
        createdAt: { $gte: today, $lt: tomorrow },
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
      editedOrders: editedOrders || []
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
          quantity: newQty // Can be negative for cancellations
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
      targetDate = new Date(date);
    }
    
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find all bills from target date that have KOTs
    const bills = await Bill.find({
      updatedAt: { $gte: targetDate, $lt: nextDay },
      'kots.0': { $exists: true }
    })
    .select('tableNo billType kots status')
    .sort({ updatedAt: -1 })
    .lean();

    // Flatten KOTs into a single array
    let allKOTs = [];
    bills.forEach(bill => {
      if (bill.kots) {
        bill.kots.forEach(kot => {
          allKOTs.push({
            ...kot,
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
      order.kots.forEach(kot => {
        // Only include KOTs that have pending or preparing items
        const hasUnfinishedItems = kot.items.some(item => item.status === 'Pending' || item.status === 'Preparing');
        if (hasUnfinishedItems) {
          allKots.push({
            orderId: order._id,
            tableNo: order.tableNo,
            billType: order.billType,
            orderSource: order.orderSource,
            kotId: kot._id,
            kotNumber: kot.kotNumber,
            items: kot.items,
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

    const kot = order.kots.id(kotId);
    if (!kot) return res.status(404).json({ message: 'KOT not found' });

    const item = kot.items.id(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found in KOT' });

    item.status = status;
    await order.save();

    emitSocketEvent(req, 'kotUpdated', { orderId, kotId, itemId, status });

    res.json({ message: 'Item status updated successfully', kot });
  } catch (error) {
    console.error('Error updating KOT item status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
