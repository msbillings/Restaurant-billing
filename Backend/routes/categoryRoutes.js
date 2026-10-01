import express from 'express';
const router = express.Router();
import { getAllCategories, getAllCategoriesAdmin, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken, requireAdmin, adminLimiter, optionalAuthenticateToken } from '../middleware/auth.js';

// Get all categories - with tenant authentication
router.get('/', optionalAuthenticateToken, getAllCategories);

// Get all categories (admin)
router.get('/admin', authenticateToken, requireAdmin, adminLimiter, getAllCategoriesAdmin);

// Create category
router.post('/', authenticateToken, requireAdmin, adminLimiter, createCategory);

// Update category
router.put('/:id', authenticateToken, requireAdmin, adminLimiter, updateCategory);

// Delete category
router.delete('/:id', authenticateToken, requireAdmin, adminLimiter, deleteCategory);

export default router;