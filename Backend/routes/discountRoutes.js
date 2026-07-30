import express from 'express';
import { getDiscounts, createDiscount, updateDiscount, deleteDiscount } from '../controllers/discountController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getDiscounts)
  .post(protect, admin, createDiscount);

router.route('/:id')
  .put(protect, admin, updateDiscount)
  .delete(protect, admin, deleteDiscount);

export default router;
