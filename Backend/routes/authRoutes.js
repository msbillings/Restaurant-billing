import express from 'express';
const router = express.Router();
import { login, logout, logoutAll, refreshToken, createAdmin, setupAdmin, updateProfile, register, getUsers, deleteUser, updateFcmToken } from '../controllers/authController.js';
import sessionManager from '../utils/sessionManager.js';
import { authenticateToken, requireAdmin, optionalAuthenticateToken } from '../middleware/auth.js';

import { authLimiter, adminLimiter, tenantApiLimiter } from '../middleware/rateLimiter.js';

router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);

// Protected routes
router.post('/clear-sessions', authenticateToken, requireAdmin, adminLimiter, (req, res) => {
  sessionManager.clearAllSessions();
  res.json({ message: 'All sessions cleared' });
});

// Protected routes
router.post('/logout', authenticateToken, authLimiter, logout);
router.post('/logout-all', authenticateToken, authLimiter, logoutAll);
router.put('/profile', authenticateToken, tenantApiLimiter, updateProfile);
router.post('/fcm-token', authenticateToken, tenantApiLimiter, updateFcmToken);

// Staff management (Admin only)
router.get('/users', authenticateToken, requireAdmin, adminLimiter, getUsers);
router.post('/users', authenticateToken, requireAdmin, adminLimiter, register);
router.delete('/users/:id', authenticateToken, requireAdmin, adminLimiter, deleteUser);

// Admin routes (public if no admin exists, protected if admins exist)
// Uses optional auth middleware so token is verified if provided, but not required
router.post('/admin/create', optionalAuthenticateToken, authLimiter, createAdmin);

// Setup route (public, but only works if no admin exists)
router.post('/admin/setup', authLimiter, setupAdmin);

export default router;
