import express from 'express';
import { 
  getStatus, 
  logout, 
  sendMessage, 
  sendBill, 
  requestPairingCode, 
  refreshQR, 
  triggerAutoDayBook,
  triggerFeedback,
  logCampaign,
  getCampaignHistory,
  getTemplates,
  saveTemplates
} from '../controllers/whatsappController.js';
import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';
import { sendReferralInvite } from '../controllers/referralWhatsAppController.js';

const router = express.Router();

router.get('/status', authenticateToken, tenantApiLimiter, getStatus);
router.post('/logout', authenticateToken, tenantApiLimiter, logout);
router.post('/send-message', authenticateToken, tenantApiLimiter, sendMessage);
router.post('/send-bill', authenticateToken, tenantApiLimiter, sendBill);
router.post('/pairing-code', authenticateToken, tenantApiLimiter, requestPairingCode);
router.post('/refresh', authenticateToken, tenantApiLimiter, refreshQR);
router.post('/trigger-auto-daybook', authenticateToken, tenantApiLimiter, triggerAutoDayBook);
router.post('/trigger-feedback', authenticateToken, tenantApiLimiter, triggerFeedback);
router.post('/campaign/log', authenticateToken, tenantApiLimiter, logCampaign);
router.get('/campaign/history', authenticateToken, tenantApiLimiter, getCampaignHistory);
router.get('/templates', authenticateToken, tenantApiLimiter, getTemplates);
router.post('/templates', authenticateToken, tenantApiLimiter, saveTemplates);

// Preserve main's referral route but add rate limiting
router.post('/send-referral', optionalAuthenticateToken, tenantApiLimiter, sendReferralInvite);

export default router;

