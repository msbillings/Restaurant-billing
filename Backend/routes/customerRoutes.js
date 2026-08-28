import express from 'express';
import { getCustomerInfo, getAllCustomers, createOrUpdateCustomer, updateCustomerType } from '../controllers/customerController.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { authenticateToken as protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(tenantMiddleware);

// Get all customers (Admin/CRM)
router.get('/', protect, requireAdmin, getAllCustomers);

// Create or update customer (Cashier/Admin CRM)
router.post('/', protect, createOrUpdateCustomer);

// Update customer order type directly from CRM
router.patch('/:phone/type', protect, updateCustomerType);
router.put('/:phone/type', protect, updateCustomerType);

// Get customer info for CRM/Upsell
router.get('/:phone', protect, getCustomerInfo);

export default router;
