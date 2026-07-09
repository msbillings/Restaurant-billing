import express from 'express';
import { getAllClients, createClient, updateClientPassword, validateLicense, updateLicense, loginClient } from '../controllers/clientController.js';

const router = express.Router();

router.get('/', getAllClients);
router.post('/', createClient);
router.put('/:id/password', updateClientPassword);
router.put('/:id/license', updateLicense);
router.post('/validate', validateLicense);
router.post('/login', loginClient);

export default router;
