import express from 'express';
import { processWhatsAppOrder, parseOnly, runFraudAnalysis } from '../controllers/aiController.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { authenticateToken as protect } from '../middleware/auth.js';

const router = express.Router();

router.use(tenantMiddleware);

// Parse a message into order items (preview only, no order created)
router.post('/parse-only', protect, parseOnly);

// Full WhatsApp order: parse + create order
router.post('/whatsapp-order', protect, processWhatsAppOrder);

// Fraud Analysis - Silent Auditor
router.get('/fraud-analysis', protect, runFraudAnalysis);

export default router;
