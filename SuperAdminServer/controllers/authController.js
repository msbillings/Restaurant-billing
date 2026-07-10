import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Basic Password Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role, name: admin.name }, 
      process.env.JWT_SECRET || 'superadmin_secret_key', 
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// We will add WebAuthn (Fingerprint) endpoints here in the next step

import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';

const rpName = 'MSBILLING Super Admin';
const rpID = process.env.NODE_ENV === 'production' ? 'msbillings-superadmin.vercel.app' : 'localhost';
const origin = process.env.NODE_ENV === 'production' ? 'https://msbillings-superadmin.vercel.app' : 'http://localhost:5174';

export const getRegistrationOptions = async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: 'admin@msbilling.in' });
    if (!admin) return res.status(404).send('Admin not found');

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(admin._id.toString()),
      userName: admin.email,
      userDisplayName: admin.name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    admin.currentChallenge = options.challenge;
    await admin.save();

    res.status(200).json(options);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating options');
  }
};

export const verifyRegistration = async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: 'admin@msbilling.in' });
    if (!admin) return res.status(404).send('Admin not found');

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: admin.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;

      admin.passkeys.push({
        credentialID: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports || [],
      });

      admin.currentChallenge = undefined;
      await admin.save();

      res.status(200).json({ verified: true });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error('Verify Registration Error:', error);
    res.status(500).json({ message: 'Error verifying registration', details: error.message, stack: error.stack });
  }
};

export const getAuthOptions = async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: 'admin@msbilling.in' });
    if (!admin || admin.passkeys.length === 0) {
      return res.status(404).json({ error: 'No passkeys found' });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: admin.passkeys.map(passkey => ({
        id: Buffer.from(passkey.credentialID, 'base64url'),
        type: 'public-key',
        transports: passkey.transports,
      })),
      userVerification: 'preferred',
    });

    admin.currentChallenge = options.challenge;
    await admin.save();

    res.status(200).json(options);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating auth options');
  }
};

export const verifyAuth = async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: 'admin@msbilling.in' });
    if (!admin) return res.status(404).send('Admin not found');

    const bodyCredID = req.body.id;
    const passkey = admin.passkeys.find(pk => pk.credentialID === bodyCredID);
    if (!passkey) return res.status(400).send('Passkey not found');

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: admin.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialID, // already a base64url string
        publicKey: Buffer.from(passkey.credentialPublicKey, 'base64url'),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });

    if (verification.verified) {
      admin.currentChallenge = undefined;
      passkey.counter = verification.authenticationInfo.newCounter;
      await admin.save();

      const token = jwt.sign(
        { id: admin._id, role: admin.role, name: admin.name }, 
        process.env.JWT_SECRET || 'superadmin_secret_key', 
        { expiresIn: '7d' }
      );

      res.status(200).json({
        verified: true,
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error('Verify Auth Error:', error);
    res.status(500).json({ message: 'Error verifying authentication', details: error.message });
  }
};
