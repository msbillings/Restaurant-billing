import express from 'express';
import {
  getCreditAccounts,
  createCreditAccount,
  addTransaction,
  getKhataAccounts,
  getKhataLedger,
  settleKhataPayment
} from '../controllers/creditAccountController.js';
import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

// ─── LEGACY routes ──────────────────────────────────
router.route('/')
  .get(protect, getCreditAccounts)
  .post(protect, admin, createCreditAccount);

router.route('/:id/transactions')
  .post(protect, admin, addTransaction);

// ─── KHATA BOOK routes ───────────────────────────────
// GET  /api/credit-accounts/khata              → paginated accounts list + stats
// GET  /api/credit-accounts/khata/:phone/ledger → ledger (unpaid bills + payment history)
// POST /api/credit-accounts/khata/settle        → record a payment settlement

router.get('/khata', protect, getKhataAccounts);
router.get('/khata/:phoneNumber/ledger', protect, getKhataLedger);
router.post('/khata/settle', protect, settleKhataPayment);

export default router;
