import express from 'express';
const router = express.Router();
import { 
  getActiveOrder, 
  saveOrder, 
  generateBill, 
  settleBill, 
  getBills, 
  getBillById, 
  deleteBill, 
  getOpenOrders,
  getDailyStats,
  generateKOT,
  getTodayKOTs,
  reopenOrder,
  cancelOrder,
  transferTable
} from '../controllers/billController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// GET routes - authenticated users only
// Order matters: specific routes before parameterized routes
router.get('/active/:tableNo', authenticateToken, getActiveOrder);
router.get('/open', authenticateToken, getOpenOrders);
router.get('/stats', authenticateToken, getDailyStats);
router.get('/kots/today', authenticateToken, getTodayKOTs);
router.get('/', authenticateToken, getBills);
router.get('/:id', authenticateToken, getBillById);

// POST routes - authenticated users only
router.post('/save', authenticateToken, saveOrder);
router.post('/generate/:id', authenticateToken, generateBill);
router.post('/reopen/:id', authenticateToken, reopenOrder);
router.post('/cancel/:id', authenticateToken, cancelOrder);
router.post('/settle/:id', authenticateToken, settleBill);
router.post('/transfer/:id', authenticateToken, transferTable);
router.post('/kot/:id', authenticateToken, generateKOT);

// DELETE - Admin only
router.delete('/:id', authenticateToken, requireAdmin, deleteBill);

export default router;
