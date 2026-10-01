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
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', authenticateToken, getStatus);
router.post('/logout', authenticateToken, logout);
router.post('/send-message', authenticateToken, sendMessage);
router.post('/send-bill', authenticateToken, sendBill);
router.post('/pairing-code', authenticateToken, requestPairingCode);
router.post('/refresh', authenticateToken, refreshQR);
router.post('/trigger-auto-daybook', authenticateToken, triggerAutoDayBook);
router.post('/trigger-feedback', authenticateToken, triggerFeedback);
router.post('/campaign/log', authenticateToken, logCampaign);
router.get('/campaign/history', authenticateToken, getCampaignHistory);
router.get('/templates', authenticateToken, getTemplates);
router.post('/templates', authenticateToken, saveTemplates);

export default router;

