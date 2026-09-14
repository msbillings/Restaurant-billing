import express from 'express';
import {
  getReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  sendManualReservationWhatsApp
} from '../controllers/reservationController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getReservations)
  .post(protect, admin, createReservation);

router.route('/:id')
  .put(protect, admin, updateReservation)
  .delete(protect, admin, deleteReservation);

router.post('/:id/send-whatsapp', protect, sendManualReservationWhatsApp);

export default router;
