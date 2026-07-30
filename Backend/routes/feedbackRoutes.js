import express from 'express';
import { getFeedback, getFeedbackStats, createFeedback } from '../controllers/feedbackController.js';
import { authenticateToken as protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getFeedback)
  .post(protect, createFeedback);

router.route('/stats')
  .get(protect, getFeedbackStats);

export default router;
