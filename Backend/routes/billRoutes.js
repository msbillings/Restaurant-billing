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
  getActiveKOTs,
  updateKOTItemStatus,
  reopenOrder,
  cancelOrder,
  refundOrder,
  transferTable,
  mergeTableOrders
} from '../controllers/billController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// GET routes - authenticated users only
// Order matters: specific routes before parameterized routes
router.get('/active/:tableNo', authenticateToken, getActiveOrder);
router.get('/open', authenticateToken, getOpenOrders);
router.get('/stats', authenticateToken, getDailyStats);
router.get('/kots/active', authenticateToken, getActiveKOTs);
router.get('/kots/today', authenticateToken, getTodayKOTs);
router.get('/', authenticateToken, getBills);
router.get('/:id', authenticateToken, getBillById);

// POST routes - authenticated users only
router.post('/save', authenticateToken, saveOrder);
router.post('/generate/:id', authenticateToken, generateBill);
router.post('/reopen/:id', authenticateToken, reopenOrder);
router.post('/cancel/:id', authenticateToken, cancelOrder);
router.post('/settle/:id', authenticateToken, settleBill);
router.post('/transfer/:id', transferTable);
router.post('/merge', mergeTableOrders);
router.post('/kot/:id', authenticateToken, generateKOT);
router.post('/kot/item/status', authenticateToken, updateKOTItemStatus);
router.post('/refund/:id', authenticateToken, refundOrder);

// DELETE - Requires password verification in controller
router.delete('/:id', authenticateToken, deleteBill);

export default router;
