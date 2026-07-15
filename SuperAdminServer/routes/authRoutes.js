import express from 'express';
import { login, getRegistrationOptions, verifyRegistration, getAuthOptions, verifyAuth } from '../controllers/authController.js';

const router = express.Router();

import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

router.post('/login', loginLimiter, login);
router.get('/webauthn/register/generate', getRegistrationOptions);
router.post('/webauthn/register/verify', verifyRegistration);
router.get('/webauthn/authenticate/generate', getAuthOptions);
router.post('/webauthn/authenticate/verify', verifyAuth);

export default router;
