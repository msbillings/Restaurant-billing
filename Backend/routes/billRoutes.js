import express from 'express';
const router = express.Router();

import { 
  getActiveOrder, saveOrder, generateBill, settleBill, getOpenOrders, reopenOrder, cancelOrder, refundOrder 
} from '../controllers/orderController.js';
import { 
  generateKOT, getTodayKOTs, getActiveKOTs, updateKOTItemStatus, updateItemPrepTime, resolveItemCancel 
} from '../controllers/kotController.js';
import { 
  transferTable, mergeTableOrders 
} from '../controllers/tableOrderController.js';
import { 
  getBills, getBillById, deleteBill, getEditedBills 
} from '../controllers/billHistoryController.js';
import { 
  getDailyStats 
} from '../controllers/billStatsController.js';
import { 
  getActiveNotifications, deleteNotification, deleteAllNotifications 
} from '../controllers/notificationController.js';

import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// GET routes - authenticated users only
// Order matters: specific routes before parameterized routes
router.get('/active-notifications', authenticateToken, getActiveNotifications);
router.get('/active/:tableNo', authenticateToken, getActiveOrder);
router.get('/open', authenticateToken, getOpenOrders);
router.get('/edited', authenticateToken, getEditedBills);
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
router.post('/transfer/:id', authenticateToken, transferTable);
router.post('/merge', authenticateToken, mergeTableOrders);
router.post('/kot/:id', authenticateToken, generateKOT);
router.post('/kot/item/status', authenticateToken, updateKOTItemStatus);
router.post('/kot/item/prep-time', authenticateToken, updateItemPrepTime);
router.post('/refund/:id', authenticateToken, refundOrder);
router.post('/resolve-item-cancel', authenticateToken, resolveItemCancel);

// DELETE notification routes - authenticated users
router.delete('/notifications/all', authenticateToken, deleteAllNotifications);
router.delete('/notifications/:id', authenticateToken, deleteNotification);

// DELETE - Requires password verification in controller
router.delete('/:id', authenticateToken, deleteBill);

export default router;
