import express from 'express';
const router = express.Router();
import { getAllMenuItems, addMenuItem, bulkAddMenuItems, updateMenuItem, deleteMenuItem, deleteAllMenuItems } from '../controllers/menuController.js';
import { authenticateToken, requireAdmin, optionalAuthenticateToken } from '../middleware/auth.js';

// GET menu items - public/POS with tenant authentication
router.get('/', optionalAuthenticateToken, getAllMenuItems);

// POST, PUT, DELETE - Admin only
router.post('/', authenticateToken, requireAdmin, addMenuItem);
router.post('/bulk', authenticateToken, requireAdmin, bulkAddMenuItems);
router.delete('/all', authenticateToken, requireAdmin, deleteAllMenuItems);
router.put('/:id', authenticateToken, updateMenuItem);
router.delete('/:id', authenticateToken, requireAdmin, deleteMenuItem);

export default router;
