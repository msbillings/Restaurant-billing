import express from 'express';
import { getGlobalAnalytics } from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/global', getGlobalAnalytics);

export default router;
