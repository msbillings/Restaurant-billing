import express from 'express';
import { getCustomerInfo, getAllCustomers } from '../controllers/customerController.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { authenticateToken as protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(tenantMiddleware);

// Get all customers (Admin/CRM)
router.get('/', protect, requireAdmin, getAllCustomers);

// Get customer info for CRM/Upsell
router.get('/:phone', protect, getCustomerInfo);

export default router;
