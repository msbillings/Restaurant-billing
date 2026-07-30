import express from 'express';
import { getTaxes, createTax, updateTax, deleteTax } from '../controllers/taxController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getTaxes)
  .post(protect, admin, createTax);

router.route('/:id')
  .put(protect, admin, updateTax)
  .delete(protect, admin, deleteTax);

export default router;
