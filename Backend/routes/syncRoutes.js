import express from 'express';
import { triggerSync, getSyncStatus } from '../controllers/syncController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/trigger')
  .post(protect, admin, triggerSync);

router.route('/status')
  .get(protect, getSyncStatus);

export default router;
