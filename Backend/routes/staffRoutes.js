import express from 'express';
import { getStaff, addStaff, updateStaff, deleteStaff, clockInOut } from '../controllers/staffController.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { authenticateToken as protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(tenantMiddleware);

router.get('/', protect, requireAdmin, getStaff);
router.post('/', protect, requireAdmin, addStaff);
router.put('/:id', protect, requireAdmin, updateStaff);
router.delete('/:id', protect, requireAdmin, deleteStaff);

// Publicly accessible within the tenant context (for the PIN screen)
router.post('/attendance', clockInOut);

export default router;
