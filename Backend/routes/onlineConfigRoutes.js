import express from 'express';
import { getOnlineConfig, updateOnlineConfig } from '../controllers/onlineConfigController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getOnlineConfig)
  .put(protect, admin, updateOnlineConfig);

export default router;
