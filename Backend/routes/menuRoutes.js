import express from 'express';
const router = express.Router();
import { getAllMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, deleteAllMenuItems } from '../controllers/menuController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// GET menu items - public (for billing page)
router.get('/', getAllMenuItems);

// POST, PUT, DELETE - Admin only
router.post('/', authenticateToken, requireAdmin, addMenuItem);
router.delete('/all', authenticateToken, requireAdmin, deleteAllMenuItems);
router.put('/:id', authenticateToken, requireAdmin, updateMenuItem);
router.delete('/:id', authenticateToken, requireAdmin, deleteMenuItem);

export default router;
