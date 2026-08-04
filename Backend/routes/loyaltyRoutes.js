import express from 'express';
import { getConfig, updateConfig, getStats } from '../controllers/loyaltyController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/config')
  .get(protect, getConfig)
  .post(protect, admin, updateConfig);

router.route('/stats')
  .get(protect, admin, getStats);

export default router;
