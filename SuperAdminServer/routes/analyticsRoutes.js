import express from 'express';
import { getGlobalAnalytics, exportGlobalCustomers } from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/global', getGlobalAnalytics);
router.get('/customers/export', exportGlobalCustomers);

export default router;
