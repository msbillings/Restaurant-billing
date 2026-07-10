import express from 'express';
import { login, getRegistrationOptions, verifyRegistration, getAuthOptions, verifyAuth } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.get('/webauthn/register/generate', getRegistrationOptions);
router.post('/webauthn/register/verify', verifyRegistration);
router.get('/webauthn/authenticate/generate', getAuthOptions);
router.post('/webauthn/authenticate/verify', verifyAuth);

export default router;
