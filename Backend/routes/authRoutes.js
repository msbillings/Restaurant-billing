import express from 'express';
const router = express.Router();
import { login, logout, logoutAll, refreshToken, createAdmin, setupAdmin, updateProfile, register, getUsers, deleteUser } from '../controllers/authController.js';
import sessionManager from '../utils/sessionManager.js';
import { authenticateToken, requireAdmin, optionalAuthenticateToken } from '../middleware/auth.js';

// Public routes
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refreshToken);

// Protected routes
router.post('/clear-sessions', authenticateToken, requireAdmin, (req, res) => {
  sessionManager.clearAllSessions();
  res.json({ message: 'All sessions cleared' });
});

// Protected routes
router.post('/logout', authenticateToken, logout);
router.post('/logout-all', authenticateToken, logoutAll);
router.put('/profile', authenticateToken, updateProfile);

// Staff management (Admin only)
router.get('/users', authenticateToken, requireAdmin, getUsers);
router.post('/users', authenticateToken, requireAdmin, register);
router.delete('/users/:id', authenticateToken, requireAdmin, deleteUser);

// Admin routes (public if no admin exists, protected if admins exist)
// Uses optional auth middleware so token is verified if provided, but not required
router.post('/admin/create', optionalAuthenticateToken, createAdmin);

// Setup route (public, but only works if no admin exists)
router.post('/admin/setup', setupAdmin);

export default router;
