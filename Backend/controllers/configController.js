import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import UserDefault from '../models/User.js';
import SettingDefault from '../models/Setting.js';
import { getTenantModels } from '../utils/tenantManager.js';
import { getTenantModel } from '../utils/tenantHelper.js';

export const setupDatabase = async (req, res) => {
  try {
    const { databaseName, username, password, staffAccounts } = req.body;
    
    // We only strictly need databaseName now, but we check if either username/password OR staffAccounts is provided
    if (!databaseName || (!username && !staffAccounts)) {
      return res.status(400).json({ message: 'Missing required configuration fields.' });
    }

    // If running in cloud environment (Render, Vercel, or production), do NOT disconnect global database!
    // Instead, initialize tenant pool for this database.
    const isCloud = process.env.VERCEL || process.env.VERCEL_ENV || process.env.RENDER || process.env.NODE_ENV === 'production' || process.env.MONGO_URI?.includes('mongodb+srv');
    
    let User = UserDefault;
    if (isCloud) {
      console.log(`[Cloud Mode] Initializing tenant connection for: ${databaseName}`);
      const models = await getTenantModels(databaseName);
      User = models.User;
    } else {
      // 1. Write config for local desktop POS app
      const configDir = process.env.APP_USER_DATA_PATH || process.cwd();
      const configPath = path.join(configDir, 'client-config.json');
      fs.writeFileSync(configPath, JSON.stringify({ databaseName }), 'utf8');

      // 2. Disconnect existing mongoose
      await mongoose.disconnect();

      // 3. Generate new URI
      const baseUri = process.env.MONGO_URI || 'mongodb://localhost:27017/restaurantbilling';
      const parts = baseUri.split('?');
      const connectionPart = parts[0];
      const queryPart = parts.length > 1 ? `?${parts[1]}` : '';
      
      const lastSlashIndex = connectionPart.lastIndexOf('/');
      const newConnectionPart = connectionPart.substring(0, lastSlashIndex) + '/' + databaseName;
      const newUri = newConnectionPart + queryPart;
      
      // 4. Reconnect
      await mongoose.connect(newUri, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 1,
      });
      console.log(`Switched to new client database: ${databaseName}`);
    }

    // 5. Seed initial users if the database is empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      // 1. Always create the main Admin user
      if (username && password) {
        const adminUser = new User({
          username: username,
          password: password,
          role: 'Admin',
          activeSessions: []
        });
        await adminUser.save();
        console.log(`Created initial admin user: ${username} in database ${databaseName}`);
      }

      // 2. Inject staff accounts if provided
      if (staffAccounts && Array.isArray(staffAccounts) && staffAccounts.length > 0) {
        for (const staff of staffAccounts) {
          // Skip if staff username is same as admin username to avoid Duplicate Key error
          if (staff.username === username) continue;
          
          const staffPassword = staff.plainTextPassword || staff.password || password || '123456';
          
          const newUser = new User({
            username: staff.username || 'staff',
            password: staffPassword,
            role: staff.role || 'Cashier',
            activeSessions: []
          });
          
          try {
            await newUser.save();
          } catch (err) {
            console.error(`Failed to save staff account ${staff.username}:`, err.message);
          }
        }
        console.log(`Seeded ${staffAccounts.length} staff accounts in database ${databaseName}`);
      }
    }

    res.status(200).json({ message: 'Database configured successfully' });
  } catch (error) {
    console.error('Error in setupDatabase:', error);
    res.status(500).json({ message: 'Failed to configure database', error: error.message });
  }
};

export const resetLicense = async (req, res) => {
  try {
    const configDir = process.env.APP_USER_DATA_PATH || process.cwd();
    const configPath = path.join(configDir, 'client-config.json');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    // Also clear hardware ID from local storage in frontend, but here we just clear backend config
    res.status(200).json({ message: 'License reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset license', error: error.message });
  }
};

export const getRestaurantInfo = async (req, res) => {
  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const expiryDoc = await Setting.findOne({ key: 'licenseExpiry' });
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' });
    const spacesDoc = await Setting.findOne({ key: 'spaces' });
    
    // Default to July 12, 2026 (Demo Expiry) if not set in DB
    const licenseExpiry = expiryDoc?.value || '2026-07-12T23:59:59.000Z';
    
    const restaurantSettings = settingsDoc?.value || {
      restaurantName: '',
      restaurantType: '',
      address: '',
      phone: '',
      email: '',
      gstin: ''
    };

    const spaces = spacesDoc?.value || null;

    res.status(200).json({ licenseExpiry, restaurantSettings, spaces });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching config', error: error.message });
  }
};

export const updateRestaurantInfo = async (req, res) => {
  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const { licenseExpiry, restaurantSettings, spaces } = req.body;
    if (licenseExpiry) {
      await Setting.findOneAndUpdate({ key: 'licenseExpiry' }, { value: licenseExpiry }, { upsert: true });
    }
    if (restaurantSettings) {
      await Setting.findOneAndUpdate({ key: 'restaurantSettings' }, { value: restaurantSettings }, { upsert: true });
    }
    if (spaces) {
      await Setting.findOneAndUpdate({ key: 'spaces' }, { value: spaces }, { upsert: true });
    }
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating config', error: error.message });
  }
};
