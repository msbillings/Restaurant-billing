import express from 'express';
import { setupDatabase, resetLicense, getRestaurantInfo, updateRestaurantInfo, syncUsersFromSuperAdmin, getSecuritySettings, updateSecuritySettings, verifyPin } from '../controllers/configController.js';

const router = express.length ? express.Router() : express.Router();

// Allow frontend to configure database on first boot without auth
router.post('/setup', setupDatabase);

// Allow frontend to reset license to switch accounts
router.post('/reset', resetLicense);

import { authenticateToken } from '../middleware/auth.js';

// Sync license expiry and restaurant settings across all devices
router.get('/', authenticateToken, getRestaurantInfo);
router.post('/', authenticateToken, updateRestaurantInfo);
router.get('/info', authenticateToken, getRestaurantInfo);
router.post('/info', authenticateToken, updateRestaurantInfo);
// Security Settings & PINs
router.get('/security', authenticateToken, getSecuritySettings);
router.post('/security', authenticateToken, updateSecuritySettings);
router.post('/verify-pin', authenticateToken, verifyPin);

// Sync users and passwords silently from SuperAdmin in the background
router.post('/sync-users', authenticateToken, syncUsersFromSuperAdmin);

export default router;

