import express from 'express';
import { 
  getCalculationHistory, 
  saveCalculation, 
  clearCalculationHistory,
  deleteSingleCalculation
} from '../controllers/calculatorController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/history', authenticateToken, getCalculationHistory);
router.post('/history', authenticateToken, saveCalculation);
router.delete('/history', authenticateToken, clearCalculationHistory);
router.delete('/history/:id', authenticateToken, deleteSingleCalculation);

export default router;
