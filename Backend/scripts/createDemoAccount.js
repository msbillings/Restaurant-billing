/**
 * createDemoAccount.js
 * Run: node scripts/createDemoAccount.js
 * Creates a demo restaurant account for Google Play Store review
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

// ── Models ──────────────────────────────────────────────────────
import Client from '../models/Client.js';
import License from '../models/License.js';

// ── Demo Credentials (share these with Google Play) ─────────────
const DEMO = {
  restaurantName: 'Demo Restaurant',
  ownerName:      'Demo Owner',
  email:          'demo@msbilling.app',
  password:       'Demo@1234',
  plan:           'Yearly'
};

// ────────────────────────────────────────────────────────────────
async function createDemoAccount() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if demo already exists
    const existing = await Client.findOne({ email: DEMO.email });
    if (existing) {
      console.log('⚠️  Demo account already exists!');
      console.log('─────────────────────────────────────');
      console.log('📧 Email    :', DEMO.email);
      console.log('🔑 Password :', DEMO.password);
      console.log('─────────────────────────────────────');
      await mongoose.disconnect();
      return;
    }

    // Generate license key
    const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    const licenseKey = `MSBILL-${seg()}-${seg()}-${seg()}`;

    // Set valid until (1 year from now)
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    // Create client
    const client = await Client.create({
      restaurantName:    DEMO.restaurantName,
      ownerName:         DEMO.ownerName,
      email:             DEMO.email,
      plainTextPassword: DEMO.password,
      licenseKey,
      status: 'Active',
      staffAccounts: []
    });

    // Create license
    await License.create({
      key:      licenseKey,
      client:   client._id,
      plan:     DEMO.plan,
      validUntil
    });

    console.log('\n✅ Demo account created successfully!\n');
    console.log('══════════════════════════════════════════');
    console.log('  GOOGLE PLAY REVIEW - DEMO CREDENTIALS  ');
    console.log('══════════════════════════════════════════');
    console.log('Email    :', DEMO.email);
    console.log('Password :', DEMO.password);
    console.log('Restaurant:', DEMO.restaurantName);
    console.log('Role     : Admin (full access)');
    console.log('Valid Until:', validUntil.toDateString());
    console.log('══════════════════════════════════════════');
    console.log('\nCopy these into Google Play Console -> Sign-in Details\n');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createDemoAccount();
