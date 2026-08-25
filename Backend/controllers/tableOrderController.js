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