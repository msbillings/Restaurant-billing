import express from 'express';
import { getAllClients, createClient, updateClientPassword, validateLicense, updateLicense, loginClient, updateFeatures, getLicenseInfo } from '../controllers/clientController.js';

const router = express.Router();

router.get('/', getAllClients);
router.post('/', createClient);
router.put('/:id/password', updateClientPassword);
router.put('/:id/license', updateLicense);
router.put('/:id/features', updateFeatures);
router.post('/validate', validateLicense);
router.post('/login', loginClient);
router.get('/license/:key', getLicenseInfo);

export default router;
