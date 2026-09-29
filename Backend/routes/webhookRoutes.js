import express from 'express';
import mongoose from 'mongoose';
import * as tenantManager from '../utils/tenantManager.js';
import BillSchema from '../models/Bill.js';
import { printKOTToPrinters, printBillToPrinters } from '../services/printerService.js';
const router = express.Router();

// Universal webhook endpoint for Zomato
router.post('/zomato', async (req, res) => {
  console.log('Received Zomato Webhook:', JSON.stringify(req.body, null, 2));
  
  try {
    const storeId = req.body.store_id || req.body.restaurant_id || req.body.res_id; 
    
    if (!storeId) {
       console.log('Missing store ID in Zomato payload');
       return res.status(400).json({ status: 'error', message: 'Missing store ID' });
    }

    const AggregatorMapping = mongoose.connection.collection('aggregatorMappings');
    const mapping = await AggregatorMapping.findOne({ aggregator: 'zomato', storeId: storeId.toString() });

    if (!mapping) {
      console.log(`No tenant mapped for Zomato store ID: ${storeId}`);
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const tenantId = mapping.tenantId;

    // Connect to the tenant DB and insert the order
    const tenantDb = await tenantManager.getTenantDB(tenantId);
    // Since Bill model exports a mongoose model and we need its schema
    const Bill = await tenantManager.getTenantModel(tenantId, 'Bill', BillSchema.schema || BillSchema);

    const newBill = new Bill({
      billNo: `ZOM-${Date.now()}`,
      orderType: 'delivery',
      aggregator: 'zomato',
      aggregatorOrderId: req.body.order_id,
      customerName: req.body.customer?.name || 'Zomato Customer',
      customerPhone: req.body.customer?.phone || '',
      items: req.body.items?.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })) || [],
      subTotal: req.body.sub_total || 0,
      taxTotal: req.body.tax_total || 0,
      grandTotal: req.body.grand_total || 0,
      paymentMethod: req.body.payment_method || 'Online',
      status: 'pending',
      date: new Date()
    });

    await newBill.save();

    // 1. Manually attach tenantId to req for services
    req.tenantId = tenantId;
    
    // 2. Trigger Auto-Printing for online orders
    try {
      await printKOTToPrinters(req, newBill, 1, newBill.items, 1);
      await printBillToPrinters(req, newBill);
    } catch (e) {
      console.error('Error triggering printers from Zomato webhook:', e);
    }

    // 3. Notify the POS Frontend Instantly
    if (req.app.locals.io) {
      req.app.locals.io.to(tenantId).emit('new_notification', {
        title: 'New Zomato Order!',
        message: `Order ${newBill.billNo} received.`,
        type: 'success',
        tenantDb: tenantId
      });
      req.app.locals.io.to(tenantId).emit('bill_updated');
    }

    res.status(200).json({ status: 'success', message: 'Order processed successfully' });
  } catch (error) {
    console.error('Error processing Zomato webhook:', error);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});


// Universal webhook endpoint for Swiggy
router.post('/swiggy', async (req, res) => {
  console.log('Received Swiggy Webhook:', JSON.stringify(req.body, null, 2));
  
  try {
    const storeId = req.body.store_id || req.body.restaurant_id; 
    
    if (!storeId) {
       console.log('Missing store ID in Swiggy payload');
       return res.status(400).json({ status: 'error', message: 'Missing store ID' });
    }

    const AggregatorMapping = mongoose.connection.collection('aggregatorMappings');
    const mapping = await AggregatorMapping.findOne({ aggregator: 'swiggy', storeId: storeId.toString() });

    if (!mapping) {
      console.log(`No tenant mapped for Swiggy store ID: ${storeId}`);
      return res.status(404).json({ status: 'error', message: 'Store not found' });
    }

    const tenantId = mapping.tenantId;

    const tenantDb = await tenantManager.getTenantDB(tenantId);
    const Bill = await tenantManager.getTenantModel(tenantId, 'Bill', BillSchema.schema || BillSchema);

    const newBill = new Bill({
      billNo: `SWIG-${Date.now()}`,
      orderType: 'delivery',
      aggregator: 'swiggy',
      aggregatorOrderId: req.body.order_id,
      customerName: req.body.customer?.name || 'Swiggy Customer',
      customerPhone: req.body.customer?.phone || '',
      items: req.body.items?.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })) || [],
      subTotal: req.body.sub_total || 0,
      taxTotal: req.body.tax_total || 0,
      grandTotal: req.body.grand_total || 0,
      paymentMethod: req.body.payment_method || 'Online',
      status: 'pending',
      date: new Date()
    });

    await newBill.save();

    // 1. Manually attach tenantId to req for services
    req.tenantId = tenantId;
    
    // 2. Trigger Auto-Printing for online orders
    try {
      await printKOTToPrinters(req, newBill, 1, newBill.items, 1);
      await printBillToPrinters(req, newBill);
    } catch (e) {
      console.error('Error triggering printers from Swiggy webhook:', e);
    }

    // 3. Notify the POS Frontend Instantly
    if (req.app.locals.io) {
      req.app.locals.io.to(tenantId).emit('new_notification', {
        title: 'New Swiggy Order!',
        message: `Order ${newBill.billNo} received.`,
        type: 'success',
        tenantDb: tenantId
      });
      req.app.locals.io.to(tenantId).emit('bill_updated');
    }

    res.status(200).json({ status: 'success', message: 'Order processed successfully' });
  } catch (error) {
    console.error('Error processing Swiggy webhook:', error);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

export default router;
