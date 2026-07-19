import express from 'express';
import { getAllClients, createClient, updateClientPassword, validateLicense, updateLicense, loginClient, updateFeatures, getLicenseInfo, updateClientStatus, deleteClient } from '../controllers/clientController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// PROTECTED ROUTES (For SuperAdmin Dashboard)
router.get('/', protect, getAllClients);
router.post('/', protect, createClient);
router.put('/:id/password', protect, updateClientPassword);
router.put('/:id/license', protect, updateLicense);
router.put('/:id/features', protect, updateFeatures);
router.put('/:id/status', protect, updateClientStatus);
router.delete('/:id', protect, deleteClient);

// PUBLIC ROUTES (For POS Client Software)
router.post('/validate', validateLicense);
router.post('/login', loginClient);
router.get('/license/:key', getLicenseInfo);

export default router;
