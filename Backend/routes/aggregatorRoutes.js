import express from 'express';
import { receiveOnlineOrder } from '../controllers/aggregatorController.js';
import { tenantMiddleware } from '../middleware/tenant.js';

const router = express.length ? express.Router() : express.Router();

// Apply tenant middleware because we need to know which DB to save the order to
router.use(tenantMiddleware);

// Endpoint for Zomato/Swiggy to push new orders
router.post('/webhook', receiveOnlineOrder);

export default router;
