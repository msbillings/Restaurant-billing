import express from 'express';
import { addExpense, getExpenses, deleteExpense } from '../controllers/expenseController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Cashiers can record and view expenses; deleting requires Admin
router.post('/', authenticateToken, addExpense);
router.get('/', authenticateToken, getExpenses);
router.delete('/:id', authenticateToken, requireAdmin, deleteExpense);

export default router;
