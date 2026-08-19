import express from 'express';
import { setupDatabase, resetLicense, getRestaurantInfo, updateRestaurantInfo, syncUsersFromSuperAdmin, getSecuritySettings, updateSecuritySettings, verifyPin } from '../controllers/configController.js';

const router = express.length ? express.Router() : express.Router();

// Allow frontend to configure database on first boot without auth
router.post('/setup', setupDatabase);

// Allow frontend to reset license to switch accounts
router.post('/reset', resetLicense);

// Sync license expiry and restaurant settings across all devices
router.get('/info', getRestaurantInfo);
router.post('/info', updateRestaurantInfo);
// Security Settings & PINs
router.get('/security', getSecuritySettings);
router.post('/security', updateSecuritySettings);
router.post('/verify-pin', verifyPin);

// Sync users and passwords silently from SuperAdmin in the background
router.post('/sync-users', syncUsersFromSuperAdmin);

export default router;

