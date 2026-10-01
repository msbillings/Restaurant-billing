import express from 'express';
import { setupDatabase, resetLicense, getRestaurantInfo, updateRestaurantInfo, syncUsersFromSuperAdmin, getSecuritySettings, updateSecuritySettings, verifyPin } from '../controllers/configController.js';

const router = express.length ? express.Router() : express.Router();

// Allow frontend to configure database on first boot without auth
router.post('/setup', setupDatabase);

// Allow frontend to reset license to switch accounts
router.post('/reset', resetLicense);

import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';

// Sync license expiry and restaurant settings across all devices
router.get('/', authenticateToken, tenantApiLimiter, getRestaurantInfo);
router.post('/', authenticateToken, tenantApiLimiter, updateRestaurantInfo);
router.get('/info', authenticateToken, tenantApiLimiter, getRestaurantInfo);
router.post('/info', authenticateToken, tenantApiLimiter, updateRestaurantInfo);
// Security Settings & PINs
router.get('/security', authenticateToken, tenantApiLimiter, getSecuritySettings);
router.post('/security', authenticateToken, tenantApiLimiter, updateSecuritySettings);
router.post('/verify-pin', authenticateToken, tenantApiLimiter, verifyPin);

// Sync users and passwords silently from SuperAdmin in the background
router.post('/sync-users', authenticateToken, tenantApiLimiter, syncUsersFromSuperAdmin);

export default router;

