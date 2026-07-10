import express from 'express';
import { getBroadcasts, createBroadcast, toggleBroadcast, deleteBroadcast } from '../controllers/broadcastController.js';

const router = express.Router();

router.get('/', getBroadcasts);
router.post('/', createBroadcast);
router.put('/:id/toggle', toggleBroadcast);
router.delete('/:id', deleteBroadcast);

export default router;
