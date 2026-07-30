import express from 'express';
import { getCreditAccounts, createCreditAccount, addTransaction } from '../controllers/creditAccountController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getCreditAccounts)
  .post(protect, admin, createCreditAccount);

router.route('/:id/transactions')
  .post(protect, admin, addTransaction);

export default router;
