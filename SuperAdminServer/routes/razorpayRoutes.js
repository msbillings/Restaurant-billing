import express from 'express';
import { handleRazorpayWebhook } from '../controllers/razorpayController.js';

const router = express.Router();

router.post('/webhook', handleRazorpayWebhook);

export default router;
