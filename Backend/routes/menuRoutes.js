import express from 'express';
const router = express.Router();
import { getAllMenuItems, addMenuItem, bulkAddMenuItems, updateMenuItem, deleteMenuItem, deleteAllMenuItems } from '../controllers/menuController.js';
import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken, requireAdmin, optionalAuthenticateToken } from '../middleware/auth.js';

// GET menu items - public/POS with tenant authentication
router.get('/', optionalAuthenticateToken, getAllMenuItems);

// POST, PUT, DELETE - Admin only
router.post('/', authenticateToken, requireAdmin, adminLimiter, addMenuItem);
router.post('/bulk', authenticateToken, requireAdmin, adminLimiter, bulkAddMenuItems);
router.delete('/all', authenticateToken, requireAdmin, adminLimiter, deleteAllMenuItems);
router.put('/:id', authenticateToken, tenantApiLimiter, updateMenuItem);
router.delete('/:id', authenticateToken, requireAdmin, adminLimiter, deleteMenuItem);

export default router;
