import express from 'express';
import { addExpense, getExpenses, deleteExpense } from '../controllers/expenseController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';

const router = express.Router();

router.use(authenticateToken);
router.use(tenantMiddleware);

// Cashiers can record and view expenses; deleting requires Admin
router.post('/', addExpense);
router.get('/', getExpenses);
router.delete('/:id', requireAdmin, deleteExpense);

export default router;
