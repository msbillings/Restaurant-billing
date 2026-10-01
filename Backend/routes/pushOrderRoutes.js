import { webhookLimiter, tenantApiLimiter } from '../middleware/rateLimiter.js';
import express from 'express';
import { getPushOrders, receivePushOrder, updateOrderStatus } from '../controllers/pushOrderController.js';
import { authenticateToken as protect } from '../middleware/auth.js';

const router = express.Router();

import { requireTrustedWebhook } from '../middleware/webhookAuth.js';

router.route('/')
  .get(protect, tenantApiLimiter, getPushOrders)
  .post(webhookLimiter, requireTrustedWebhook, receivePushOrder); // Notice this is public so webhook can hit it

router.route('/:id/status')
  .put(protect, tenantApiLimiter, updateOrderStatus);

export default router;
