import express from 'express';
const router = express.Router();
import { 
  getAnalytics, 
  getDayBook, 
  exportDayBookExcel, 
  downloadDailyReportCSV, 
  downloadMonthlyReportExcel,
  sendDayBookWhatsApp,
  sendAnalyticsWhatsApp,
  downloadSecureReport
} from '../controllers/analyticsController.js';
import { getSalesForecast } from '../controllers/forecastController.js';
import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// GET forecast - Admin users only
router.get('/forecast', authenticateToken, requireAdmin, adminLimiter, getSalesForecast);

// GET analytics - Admin users only
router.get('/', authenticateToken, requireAdmin, adminLimiter, getAnalytics);

// GET DayBook - Available to Cashier & Admin
router.get('/daybook', authenticateToken, tenantApiLimiter, getDayBook);

// Export DayBook - Available to Cashier & Admin
router.get('/daybook/export', authenticateToken, tenantApiLimiter, exportDayBookExcel);

// Direct WhatsApp Delivery for DayBook & Analytics - Available to all authenticated staff (Cashier, Manager, Admin)
router.post('/daybook/whatsapp', authenticateToken, tenantApiLimiter, sendDayBookWhatsApp);
router.post('/whatsapp', authenticateToken, tenantApiLimiter, sendAnalyticsWhatsApp);

// Download reports - Available to Cashier & Admin
router.get('/download/daily/csv', authenticateToken, tenantApiLimiter, downloadDailyReportCSV);
router.get('/download/monthly/excel', authenticateToken, tenantApiLimiter, downloadMonthlyReportExcel);
router.get('/download/:reportId', authenticateToken, tenantApiLimiter, downloadSecureReport);

export default router;
