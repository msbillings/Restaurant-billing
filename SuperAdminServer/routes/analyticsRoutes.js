import express from 'express';
import { getGlobalAnalytics, exportGlobalCustomers, getRealtimeAnalytics } from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/global', getGlobalAnalytics);
router.get('/realtime', getRealtimeAnalytics);
router.get('/customers/export', exportGlobalCustomers);

export default router;
