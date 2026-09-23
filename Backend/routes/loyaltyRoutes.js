import express from 'express';
import {
  getConfig,
  updateConfig,
  getStats,
  getCustomerLoyalty,
  adjustCustomerPoints,
  testLoyaltyWhatsApp,
  getCampaignAudience,
  sendLoyaltyCampaign,
  getExpiryStats,
  runLoyaltyExpiryAudit,
  generateOtp,
  verifyOtp
} from '../controllers/loyaltyController.js';
import { authenticateToken as protect, requireAdmin as admin, optionalAuthenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.route('/config')
  .get(protect, getConfig)
  .post(protect, admin, updateConfig);

router.route('/stats')
  .get(protect, admin, getStats);

router.route('/expiry/stats')
  .get(protect, admin, getExpiryStats);

router.route('/expiry/audit')
  .post(protect, admin, runLoyaltyExpiryAudit);

router.route('/customer/:phone')
  .get(protect, getCustomerLoyalty);

router.route('/adjust')
  .post(protect, admin, adjustCustomerPoints);

router.route('/test-whatsapp')
  .post(optionalAuthenticateToken, testLoyaltyWhatsApp);

router.route('/campaign/audience')
  .get(protect, admin, getCampaignAudience);

router.route('/campaign/send')
  .post(protect, admin, sendLoyaltyCampaign);


router.route('/generate-otp')
  .post(protect, generateOtp);

router.route('/verify-otp')
  .post(protect, verifyOtp);

export default router;
