import express from 'express';
import { getCustomerInfo } from '../controllers/customerController.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { authenticateToken as protect } from '../middleware/auth.js';

const router = express.Router();

router.use(tenantMiddleware);

// Get customer info for CRM/Upsell
router.get('/:phone', protect, getCustomerInfo);

export default router;
