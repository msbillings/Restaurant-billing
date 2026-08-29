import express from 'express';
import { getStatus, logout, sendMessage, sendBill, requestPairingCode, refreshQR } from '../controllers/whatsappController.js';
import { optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', optionalAuthenticateToken, getStatus);
router.post('/logout', optionalAuthenticateToken, logout);
router.post('/send-message', optionalAuthenticateToken, sendMessage);
router.post('/send-bill', optionalAuthenticateToken, sendBill);
router.post('/pairing-code', optionalAuthenticateToken, requestPairingCode);
router.post('/refresh', optionalAuthenticateToken, refreshQR);

export default router;

