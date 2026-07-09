import express from 'express';
const router = express.Router();
import { getAllCategories, getAllCategoriesAdmin, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// Get all categories
router.get('/', getAllCategories);

// Get all categories (admin)
router.get('/admin', authenticateToken, requireAdmin, getAllCategoriesAdmin);

// Create category
router.post('/', authenticateToken, requireAdmin, createCategory);

// Update category
router.put('/:id', authenticateToken, requireAdmin, updateCategory);

// Delete category
router.delete('/:id', authenticateToken, requireAdmin, deleteCategory);

export default router;