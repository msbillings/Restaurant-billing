import express from 'express';
const router = express.Router();

import { 
  getActiveOrder, saveOrder, generateBill, settleBill, getOpenOrders, reopenOrder, cancelOrder, refundOrder, updateBillCustomer, clearUnpaidBill
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

import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// GET routes - authenticated users only
// Order matters: specific routes before parameterized routes
router.get('/active-notifications', authenticateToken, tenantApiLimiter, getActiveNotifications);
router.get('/active/:tableNo', authenticateToken, tenantApiLimiter, getActiveOrder);
router.get('/open', authenticateToken, tenantApiLimiter, getOpenOrders);
router.get('/edited', authenticateToken, tenantApiLimiter, getEditedBills);
router.get('/stats', authenticateToken, tenantApiLimiter, getDailyStats);
router.get('/kots/active', authenticateToken, tenantApiLimiter, getActiveKOTs);
router.get('/kots/today', authenticateToken, tenantApiLimiter, getTodayKOTs);
router.get('/', authenticateToken, tenantApiLimiter, getBills);
router.get('/:id', authenticateToken, tenantApiLimiter, getBillById);

// POST routes - authenticated users only
router.post('/save', authenticateToken, tenantApiLimiter, saveOrder);
router.post('/generate/:id', authenticateToken, tenantApiLimiter, generateBill);
router.post('/reopen/:id', authenticateToken, tenantApiLimiter, reopenOrder);
router.post('/cancel/:id', authenticateToken, tenantApiLimiter, cancelOrder);
router.post('/settle/:id', authenticateToken, tenantApiLimiter, settleBill);
router.post('/clear-unpaid/:id', authenticateToken, tenantApiLimiter, clearUnpaidBill);
router.post('/transfer/:id', authenticateToken, tenantApiLimiter, transferTable);
router.post('/merge', authenticateToken, tenantApiLimiter, mergeTableOrders);
router.post('/kot/:id', authenticateToken, tenantApiLimiter, generateKOT);
router.post('/kot/item/status', authenticateToken, tenantApiLimiter, updateKOTItemStatus);
router.post('/kot/item/prep-time', authenticateToken, tenantApiLimiter, updateItemPrepTime);
router.post('/refund/:id', authenticateToken, tenantApiLimiter, refundOrder);
router.post('/resolve-item-cancel', authenticateToken, tenantApiLimiter, resolveItemCancel);
router.patch('/:id/customer', authenticateToken, tenantApiLimiter, updateBillCustomer);
router.put('/:id/customer', authenticateToken, tenantApiLimiter, updateBillCustomer);

// DELETE notification routes - authenticated users
router.delete('/notifications/all', authenticateToken, tenantApiLimiter, deleteAllNotifications);
router.delete('/notifications/:id', authenticateToken, tenantApiLimiter, deleteNotification);

// DELETE - Requires password verification in controller
router.delete('/:id', authenticateToken, tenantApiLimiter, deleteBill);

export default router;
