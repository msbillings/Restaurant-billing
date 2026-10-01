import { webhookLimiter } from '../middleware/rateLimiter.js';
import express from 'express';
import { receiveOnlineOrder } from '../controllers/aggregatorController.js';
import mongoose from 'mongoose';

const router = express.Router();

import { requireTrustedWebhook } from '../middleware/webhookAuth.js';

// Endpoint for Zomato/Swiggy to push new orders
router.post('/webhook', webhookLimiter, requireTrustedWebhook, receiveOnlineOrder);

router.post('/settings', webhookLimiter, async (req, res) => {
  try {
    const { zomatoId, swiggyId } = req.body;
    const tenantId = req.tenantId;

    const AggregatorMapping = mongoose.connection.collection('aggregatorMappings');
    
    if (zomatoId) {
       await AggregatorMapping.updateOne(
         { tenantId, aggregator: 'zomato' }, 
         { $set: { storeId: zomatoId } }, 
         { upsert: true }
       );
    }
    
    if (swiggyId) {
       await AggregatorMapping.updateOne(
         { tenantId, aggregator: 'swiggy' }, 
         { $set: { storeId: swiggyId } }, 
         { upsert: true }
       );
    }

    res.json({ success: true, message: 'Settings saved' });
  } catch(e) {
     res.status(500).json({ error: e.message });
  }
});

router.get('/settings', webhookLimiter, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const AggregatorMapping = mongoose.connection.collection('aggregatorMappings');
    
    const zomatoMapping = await AggregatorMapping.findOne({ tenantId, aggregator: 'zomato' });
    const swiggyMapping = await AggregatorMapping.findOne({ tenantId, aggregator: 'swiggy' });

    res.json({ 
      zomatoId: zomatoMapping?.storeId || '', 
      swiggyId: swiggyMapping?.storeId || '' 
    });
  } catch(e) {
     res.status(500).json({ error: e.message });
  }
});

export default router;
