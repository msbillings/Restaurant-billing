import express from 'express';
const router = express.Router();
import { getAnalytics, getDayBook, exportDayBookExcel, downloadDailyReportCSV, downloadMonthlyReportExcel } from '../controllers/analyticsController.js';
import { getSalesForecast } from '../controllers/forecastController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// GET forecast - Admin users only
router.get('/forecast', authenticateToken, requireAdmin, getSalesForecast);

// GET analytics - Admin users only
router.get('/', authenticateToken, requireAdmin, getAnalytics);

// GET DayBook - Available to Cashier & Admin
router.get('/daybook', authenticateToken, getDayBook);

// Export DayBook - Available to Cashier & Admin
router.get('/daybook/export', authenticateToken, exportDayBookExcel);

// Download reports - Admin users only
router.get('/download/daily/csv', authenticateToken, requireAdmin, downloadDailyReportCSV);
router.get('/download/monthly/excel', authenticateToken, requireAdmin, downloadMonthlyReportExcel);


export default router;
