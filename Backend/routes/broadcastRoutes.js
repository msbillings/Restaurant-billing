import express from 'express';
import { getClientBroadcasts, replyToBroadcast } from '../controllers/broadcastController.js';

const router = express.Router();

// GET active broadcasts for the tenant shop
router.get('/', getClientBroadcasts);
router.get('/client/:clientId', getClientBroadcasts);

// POST reply to a broadcast
router.post('/reply', replyToBroadcast);

export default router;
