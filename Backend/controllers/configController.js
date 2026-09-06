import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import ClientDefault from '../models/Client.js';
import UserDefault from '../models/User.js';
import SettingDefault from '../models/Setting.js';
import FloorDefault from '../models/Floor.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { emitSocketEvent } from '../utils/socket.js';
import { clearPublicMenuCache } from '../routes/publicRoutes.js';
import cache from '../utils/cache.js';
import { invalidateSnapshotCache } from './orderController.js';

export let isSettingUpDB = false;

export const setupDatabase = async (req, res) => {
  try {
    isSettingUpDB = true;
    const { databaseName, username, password, staffAccounts } = req.body;

    // We only strictly need databaseName now, but we check if either username/password OR staffAccounts is provided
    if (!databaseName || (!username && !staffAccounts)) {
      return res.status(400).json({ message: 'Missing required configuration fields.' });
    }

    // If running in cloud environment (Render, Vercel, or production), do NOT disconnect global database!
    // Instead, initialize tenant pool for this database. (Desktop app provides APP_USER_DATA_PATH, so it is never cloud)
    const isDesktop = !!process.env.APP_USER_DATA_PATH;
    const isCloud = !isDesktop && (process.env.VERCEL || process.env.VERCEL_ENV || process.env.RENDER || process.env.NODE_ENV === 'production' || process.env.MONGO_URI?.includes('mongodb+srv'));

    let User = UserDefault;
    if (isCloud) {
      console.log(`[Cloud Mode] Initializing tenant connection for: ${databaseName}`);
      const models = await getTenantModels(databaseName);
      User = models.User;
    } else {
      // 1. Write config for local desktop POS app
      const configDir = process.env.APP_USER_DATA_PATH || process.cwd();
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      const configPath = path.join(configDir, 'client-config.json');
      fs.writeFileSync(configPath, JSON.stringify({ databaseName }), 'utf8');

      // 2. Disconnect existing mongoose
      await mongoose.disconnect();

      // 3. Generate new URI
      const baseUri = process.env.MONGO_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
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
  } finally {
    isSettingUpDB = false;
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
    const Floor = getTenantModel(req, 'Floor', FloorDefault);
    const expiryDoc = await Setting.findOne({ key: 'licenseExpiry' }).lean();
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
    const spacesDoc = await Floor.find().sort({ createdAt: 1 }).lean();

    // Default to July 12, 2026 (Demo Expiry) if not set in DB
    const licenseExpiry = expiryDoc?.value || '2026-07-12T23:59:59.000Z';

    let restaurantSettings = settingsDoc?.value;
    if (typeof restaurantSettings === 'string') {
      try {
        restaurantSettings = JSON.parse(restaurantSettings);
      } catch (e) { }
    }
    if (!restaurantSettings || typeof restaurantSettings !== 'object') {
      restaurantSettings = {};
    }

    // Intelligent fallback to SuperAdmin Client registration if restaurantName is not set yet in tenant DB
    const tenantDbName = req.tenantDb || req.headers?.['x-tenant-db'] || '';
    if (!restaurantSettings.restaurantName && tenantDbName) {
      try {
        const clientDoc = await ClientDefault.findOne({
          $or: [
            { databaseName: tenantDbName },
            { licenseKey: req.headers?.['x-license-key'] || '' }
          ]
        }).lean();

        if (clientDoc) {
          if (!restaurantSettings.restaurantName && clientDoc.restaurantName) {
            restaurantSettings.restaurantName = clientDoc.restaurantName;
          }
          if (!restaurantSettings.email && clientDoc.email) {
            restaurantSettings.email = clientDoc.email;
          }
          if (!restaurantSettings.phone && clientDoc.phone) {
            restaurantSettings.phone = clientDoc.phone;
          }
        }
      } catch (clientErr) {
        console.warn('Notice: could not lookup client doc fallback:', clientErr.message);
      }
    }

    // Default structure for complete form hydration
    restaurantSettings = {
      restaurantName: restaurantSettings.restaurantName || '',
      restaurantType: restaurantSettings.restaurantType || '',
      address: restaurantSettings.address || '',
      phone: restaurantSettings.phone || '',
      email: restaurantSettings.email || '',
      gstin: restaurantSettings.gstin || '',
      fssai: restaurantSettings.fssai || '',
      upiId: restaurantSettings.upiId || '',
      ownerPin: restaurantSettings.ownerPin || '',
      footerMessage: restaurantSettings.footerMessage || '*** THANK YOU! VISIT AGAIN ***',
      kotPrinter: restaurantSettings.kotPrinter || '',
      billingPrinter: restaurantSettings.billingPrinter || '',
      silentPrinting: restaurantSettings.silentPrinting !== undefined ? restaurantSettings.silentPrinting : true,
      enableQrPayment: restaurantSettings.enableQrPayment !== undefined ? restaurantSettings.enableQrPayment : true,
      enableCgst: restaurantSettings.enableCgst !== undefined ? restaurantSettings.enableCgst : true,
      cgstRate: restaurantSettings.cgstRate !== undefined ? restaurantSettings.cgstRate : 2.5,
      enableSgst: restaurantSettings.enableSgst !== undefined ? restaurantSettings.enableSgst : true,
      sgstRate: restaurantSettings.sgstRate !== undefined ? restaurantSettings.sgstRate : 2.5,
      enableGst: restaurantSettings.enableGst !== undefined ? restaurantSettings.enableGst : false,
      gstRate: restaurantSettings.gstRate !== undefined ? restaurantSettings.gstRate : 5,
      logo: restaurantSettings.logo === '[logo_stored]' ? '' : (restaurantSettings.logo || ''),
      printFormat: restaurantSettings.printFormat || '80mm',
      enableGeoFencing: restaurantSettings.enableGeoFencing !== undefined ? restaurantSettings.enableGeoFencing : false,
      geoFencingRadius: restaurantSettings.geoFencingRadius || 50,
      latitude: restaurantSettings.latitude || '',
      longitude: restaurantSettings.longitude || '',
      qrMenuMode: restaurantSettings.qrMenuMode || 'cloud',
      vercelUrl: restaurantSettings.vercelUrl || 'https://restaurant-billing-seven.vercel.app',
      serverIp: restaurantSettings.serverIp || '',
      autoSendDaybook: restaurantSettings.autoSendDaybook !== undefined ? restaurantSettings.autoSendDaybook : false,
      autoSendTime: restaurantSettings.autoSendTime || '22:00',
      vipVisitThreshold: restaurantSettings.vipVisitThreshold !== undefined ? restaurantSettings.vipVisitThreshold : 5,
      vipSpendThreshold: restaurantSettings.vipSpendThreshold !== undefined ? restaurantSettings.vipSpendThreshold : 5000,
      ...restaurantSettings,
      logo: restaurantSettings.logo === '[logo_stored]' ? '' : (restaurantSettings.logo || '')
    };

    const spaces = spacesDoc && spacesDoc.length > 0 ? spacesDoc : null;

    res.status(200).json({
      licenseExpiry,
      restaurantSettings,
      spaces,
      ...restaurantSettings,
      logo: restaurantSettings.logo
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching config', error: error.message });
  }
};

export const updateRestaurantInfo = async (req, res) => {
  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const { licenseExpiry, restaurantSettings, spaces } = req.body;
    const settingsToSave = restaurantSettings || (req.body.restaurantName ? req.body : null);
    const updatePromises = [];

    if (licenseExpiry) {
      updatePromises.push(Setting.findOneAndUpdate({ key: 'licenseExpiry' }, { value: licenseExpiry }, { upsert: true }).maxTimeMS(3000));
    }

    let mergedSettings = null;
    if (settingsToSave) {
      const existingDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean().maxTimeMS(2500);
      const existingSettings = existingDoc?.value || {};
      
      // CRITICAL FIX: If client sent dummy '[logo_stored]', never overwrite the existing stored logo
      if (settingsToSave.logo === '[logo_stored]') {
        delete settingsToSave.logo;
      }
      
      mergedSettings = { ...existingSettings, ...settingsToSave };
      if (mergedSettings.logo === '[logo_stored]') {
        mergedSettings.logo = '';
      }
      updatePromises.push(Setting.findOneAndUpdate({ key: 'restaurantSettings' }, { value: mergedSettings }, { upsert: true }).maxTimeMS(3000));
    }
    
    if (spaces) {
      updatePromises.push(Setting.findOneAndUpdate({ key: 'spaces' }, { value: spaces }, { upsert: true }).maxTimeMS(3000));
    }

    await Promise.all(updatePromises);

    if (mergedSettings) {
      const socketPayload = { ...mergedSettings };
      // Keep network fast: If logo exceeds 200KB omit from websocket payload, NEVER send '[logo_stored]' string
      if (typeof socketPayload.logo === 'string' && socketPayload.logo.length > 200000) {
        delete socketPayload.logo;
      }
      emitSocketEvent(req, 'settingsUpdated', socketPayload);
      try {
        const cacheKey = cache.getCacheKey('restaurantSettings', req.shopName || 'default');
        cache.set(cacheKey, mergedSettings, 60000);
        clearPublicMenuCache(req.tenantDb || req.headers?.['x-tenant-db']);
        // ⚡ Evict the full-snapshot module cache so the next save/KOT/settle picks up the new settings immediately
        invalidateSnapshotCache(req.tenantDb || req.headers?.['x-tenant-db'] || req.user?.db);
      } catch (e) { }
    }

    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating config', error: error.message });
  }
};

export const syncUsersFromSuperAdmin = async (req, res) => {
  try {
    const { plainTextPassword, staffAccounts } = req.body;
    const User = getTenantModel(req, 'User', UserDefault);

    // Sync admin password if provided
    if (plainTextPassword) {
      const admin = await User.findOne({ role: 'Admin' });
      if (admin) {
        admin.password = plainTextPassword;
        // The pre('save') hook in User model will hash it
        await admin.save();
      }
    }

    // Sync staff accounts if provided
    if (staffAccounts && Array.isArray(staffAccounts)) {
      for (const staff of staffAccounts) {
        const staffUser = await User.findOne({ username: staff.username });
        if (staffUser) {
          // If staff already exists, update password
          const newPass = staff.plainTextPassword || staff.password || plainTextPassword;
          if (newPass) {
            staffUser.password = newPass;
            await staffUser.save();
          }
        } else {
          // If staff was newly created in SuperAdmin, create them locally too
          const newPass = staff.plainTextPassword || staff.password || plainTextPassword || '123456';
          const newUser = new User({
            username: staff.username,
            password: newPass,
            role: staff.role || 'Cashier',
            activeSessions: []
          });
          await newUser.save();
        }
      }
    }

    res.status(200).json({ message: 'Users synced successfully' });
  } catch (error) {
    console.error('Error syncing users:', error);
    res.status(500).json({ message: 'Error syncing users', error: error.message });
  }
};

export const getSecuritySettings = async (req, res) => {
  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const securityDoc = await Setting.findOne({ key: 'securitySettings' });

    let config = {
      requireMasterPin: true,
      ownerPin: '1234',
      customLocks: {}
    };

    if (securityDoc && securityDoc.value) {
      config.requireMasterPin = securityDoc.value.requireMasterPin !== false;
      config.ownerPin = securityDoc.value.masterPin || securityDoc.value.ownerPin || '1234';

      if (securityDoc.value.customLocks) {
        Object.entries(securityDoc.value.customLocks).forEach(([key, lock]) => {
          config.customLocks[key] = {
            enabled: lock.enabled,
            pin: lock.pin || '',
            hasCustomPin: !!(lock.pin || lock.pinHash)
          };
        });
      }
    }

    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching security settings', error: error.message });
  }
};

export const updateSecuritySettings = async (req, res) => {
  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const { requireMasterPin, ownerPin, customLocks } = req.body;

    // Fetch existing so we don't overwrite if not provided
    const existingDoc = await Setting.findOne({ key: 'securitySettings' });
    const existingValue = existingDoc ? existingDoc.value : {};

    const finalMasterPin = (ownerPin !== undefined && ownerPin !== '') ? String(ownerPin) : (existingValue.masterPin || existingValue.ownerPin || '1234');
    const masterPinHash = await bcrypt.hash(finalMasterPin, 10);

    let updatedValue = {
      requireMasterPin: requireMasterPin !== false,
      masterPin: finalMasterPin,
      masterPinHash: masterPinHash,
      customLocks: {}
    };

    if (customLocks) {
      for (const [key, lock] of Object.entries(customLocks)) {
        const lockPin = (lock.pin !== undefined && lock.pin !== '') ? String(lock.pin) : (existingValue.customLocks?.[key]?.pin || '');
        const pinHash = lockPin ? await bcrypt.hash(lockPin, 10) : (existingValue.customLocks?.[key]?.pinHash || '');

        updatedValue.customLocks[key] = {
          enabled: lock.enabled !== false,
          pin: lockPin,
          pinHash: pinHash
        };
      }
    }

    await Setting.findOneAndUpdate({ key: 'securitySettings' }, { value: updatedValue }, { upsert: true });

    // Notify connected clients that settings changed (structure only)
    emitSocketEvent(req, 'securitySettingsUpdated', {
      requireMasterPin: updatedValue.requireMasterPin,
      customLocks: Object.fromEntries(
        Object.entries(updatedValue.customLocks).map(([k, v]) => [k, { enabled: v.enabled }])
      )
    });

    res.status(200).json({
      message: 'Security settings saved successfully',
      ownerPin: finalMasterPin,
      customLocks: Object.fromEntries(
        Object.entries(updatedValue.customLocks).map(([k, v]) => [k, { enabled: v.enabled, pin: v.pin, hasCustomPin: !!v.pin }])
      )
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating security settings', error: error.message });
  }
};

export const verifyPin = async (req, res) => {
  try {
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const { featureId, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required' });
    }

    const securityDoc = await Setting.findOne({ key: 'securitySettings' });
    const config = securityDoc ? securityDoc.value : {};

    const inputPin = String(pin).trim();
    let isMatch = false;

    // 1. Check feature-specific lock first
    if (featureId && config.customLocks && config.customLocks[featureId]) {
      const lock = config.customLocks[featureId];
      if (lock.enabled) {
        if (lock.pin && String(lock.pin).trim() === inputPin) {
          isMatch = true;
        } else if (lock.pinHash) {
          isMatch = await bcrypt.compare(inputPin, lock.pinHash);
        }
      }
    }

    // 2. If not matched or no custom lock matched, check Master PIN (master PIN can unlock ANY feature)
    if (!isMatch) {
      const master = config.masterPin || config.ownerPin;
      if (master && String(master).trim() === inputPin) {
        isMatch = true;
      } else if (config.masterPinHash) {
        isMatch = await bcrypt.compare(inputPin, config.masterPinHash);
      } else if (inputPin === '1234') {
        // Fallback default
        isMatch = true;
      }
    }

    res.status(200).json({ success: isMatch });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
