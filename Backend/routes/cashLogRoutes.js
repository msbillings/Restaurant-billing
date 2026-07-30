import express from 'express';
import { getCashLogs, createCashLog, deleteCashLog } from '../controllers/cashLogController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, admin, getCashLogs)
  .post(protect, admin, createCashLog);

router.route('/:id')
  .delete(protect, admin, deleteCashLog);

export default router;
