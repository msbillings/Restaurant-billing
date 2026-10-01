import express from 'express';
import { 
  getCalculationHistory, 
  saveCalculation, 
  clearCalculationHistory,
  deleteSingleCalculation
} from '../controllers/calculatorController.js';
import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/history', authenticateToken, tenantApiLimiter, getCalculationHistory);
router.post('/history', authenticateToken, tenantApiLimiter, saveCalculation);
router.delete('/history', authenticateToken, tenantApiLimiter, clearCalculationHistory);
router.delete('/history/:id', authenticateToken, tenantApiLimiter, deleteSingleCalculation);

export default router;
