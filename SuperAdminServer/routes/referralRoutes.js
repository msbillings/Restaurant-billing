import express from 'express';
import { getReferrals, getSettings, updateSettings } from '../controllers/referralController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getReferrals);
router.get('/settings', protect, getSettings);
router.post('/settings', protect, updateSettings);

export default router;
