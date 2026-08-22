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

// Route GET / — if tenant header or query is present, strictly filter for that POS client; otherwise return SuperAdmin list
router.get('/', (req, res, next) => {
  const tenant = req.tenantDb || req.headers['x-tenant-db'] || req.query.tenant || req.query.clientId;
  if (tenant) {
    return getClientBroadcasts(req, res, next);
  }
  return getBroadcasts(req, res, next);
});

// SuperAdmin mutation routes
router.post('/', createBroadcast);
router.put('/:id', updateBroadcast);
router.put('/:id/toggle', toggleBroadcast);
router.delete('/:id', deleteBroadcast);

// Explicit client endpoint
router.get('/client/:clientId', getClientBroadcasts);
router.post('/reply', replyToBroadcast);

export default router;
