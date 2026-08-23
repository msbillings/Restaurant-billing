import express from 'express';
import { 
  getAllClients, 
  createClient, 
  updateClientPassword, 
  validateLicense, 
  updateLicense, 
  loginClient, 
  updateFeatures, 
  getLicenseInfo, 
  updateClientStatus, 
  deleteClient 
} from '../controllers/clientController.js';
import { getClientBroadcasts } from '../controllers/broadcastController.js';

const router = express.Router();

// Routes for SuperAdmin dashboard
router.get('/', getAllClients);
router.post('/', createClient);
router.put('/:id/password', updateClientPassword);
router.put('/:id/license', updateLicense);
router.put('/:id/features', updateFeatures);
router.put('/:id/status', updateClientStatus);
router.delete('/:id', deleteClient);

// Public Routes (For POS Client Software)
router.post('/validate', validateLicense);
router.post('/login', loginClient);
router.get('/license/:key', getLicenseInfo);
router.get('/broadcasts/:clientId', getClientBroadcasts);

export default router;
