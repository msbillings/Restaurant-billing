import express from 'express';
import { 
  getBroadcasts, 
  createBroadcast, 
  updateBroadcast, 
  toggleBroadcast, 
  deleteBroadcast, 
  getClientBroadcasts, 
  replyToBroadcast 
} from '../controllers/broadcastController.js';

const router = express.Router();

// SuperAdmin & POS Client routes
router.get('/', getBroadcasts);
router.post('/', createBroadcast);
router.put('/:id', updateBroadcast);
router.put('/:id/toggle', toggleBroadcast);
router.delete('/:id', deleteBroadcast);

// POS Client specific routes
router.get('/client/:clientId', getClientBroadcasts);
router.post('/reply', replyToBroadcast);

export default router;
