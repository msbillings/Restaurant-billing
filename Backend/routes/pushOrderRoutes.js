import express from 'express';
import { getPushOrders, receivePushOrder, updateOrderStatus } from '../controllers/pushOrderController.js';
import { authenticateToken as protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getPushOrders)
  .post(receivePushOrder); // Notice this is public so webhook can hit it

router.route('/:id/status')
  .put(protect, updateOrderStatus);

export default router;
