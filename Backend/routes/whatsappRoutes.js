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
import { sendReferralInvite } from '../controllers/referralWhatsAppController.js';
import { optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', optionalAuthenticateToken, getStatus);
router.post('/logout', optionalAuthenticateToken, logout);
router.post('/send-message', optionalAuthenticateToken, sendMessage);
router.post('/send-bill', optionalAuthenticateToken, sendBill);
router.post('/pairing-code', optionalAuthenticateToken, requestPairingCode);
router.post('/refresh', optionalAuthenticateToken, refreshQR);
router.post('/trigger-auto-daybook', optionalAuthenticateToken, triggerAutoDayBook);
router.post('/trigger-feedback', optionalAuthenticateToken, triggerFeedback);
router.post('/campaign/log', optionalAuthenticateToken, logCampaign);
router.get('/campaign/history', optionalAuthenticateToken, getCampaignHistory);
router.get('/templates', optionalAuthenticateToken, getTemplates);
router.post('/templates', optionalAuthenticateToken, saveTemplates);
router.post('/send-referral', optionalAuthenticateToken, sendReferralInvite);

export default router;

