import Client from '../models/Client.js';
import License from '../models/License.js';
import Broadcast from '../models/Broadcast.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Utility to provision/sync the admin user & staff directly into the tenant's MongoDB database
export const provisionTenantUsers = async (client, plainPassword) => {
  try {
    if (!client.databaseName) {
      const sanitizedName = (client.restaurantName || 'resto').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
      await client.save();
    }

    const passwordToUse = plainPassword || client.plainTextPassword;
    if (!passwordToUse) return;

    const hashedPassword = await bcrypt.hash(passwordToUse, 10);
    const tenantDb = mongoose.connection.useDb(client.databaseName, { useCache: true });
    const usersCol = tenantDb.collection('users');

    // 1. Provision Admin by Email (e.g. cakepanda@gmail.com)
    if (client.email) {
      await usersCol.updateOne(
        { username: client.email.trim() },
        {
          $set: {
            username: client.email.trim(),
            password: hashedPassword,
            role: 'Admin',
            updatedAt: new Date()
          },
          $setOnInsert: {
            activeSessions: [],
            fcmTokens: [],
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    }

    // 2. Also provision Admin by Restaurant Name (e.g. Cake Panda) so BOTH email and name work for login!
    if (client.restaurantName && client.restaurantName.trim().toLowerCase() !== client.email.trim().toLowerCase()) {
      await usersCol.updateOne(
        { username: client.restaurantName.trim() },
        {
          $set: {
            username: client.restaurantName.trim(),
            password: hashedPassword,
            role: 'Admin',
            updatedAt: new Date()
          },
          $setOnInsert: {
            activeSessions: [],
            fcmTokens: [],
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    }

    // 3. Provision any additional staff accounts
    if (client.staffAccounts && Array.isArray(client.staffAccounts)) {
      for (const staff of client.staffAccounts) {
        if (!staff.username) continue;
        const staffPass = staff.plainTextPassword || passwordToUse;
        const staffHashed = await bcrypt.hash(staffPass, 10);
        await usersCol.updateOne(
          { username: staff.username.trim() },
          {
            $set: {
              username: staff.username.trim(),
              password: staffHashed,
              role: staff.role || 'Cashier',
              updatedAt: new Date()
            },
            $setOnInsert: {
              activeSessions: [],
              fcmTokens: [],
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      }
    }

    console.log(`[SuperAdmin] Successfully provisioned tenant users for ${client.email} in ${client.databaseName}`);
  } catch (err) {
    console.error(`[SuperAdmin Provision Error] Failed to provision tenant users for ${client.email}:`, err.message);
  }
};

// Get all clients (For Super Admin dashboard)
export const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().lean().sort({ createdAt: -1 });
    
    // Attach license info to each client
    const clientsWithLicense = await Promise.all(clients.map(async (client) => {
      const license = await License.findOne({ client: client._id });
      return { 
        ...client, 
        validUntil: license ? license.validUntil : null,
        plan: license ? license.plan : 'Unknown',
        licenseCreatedAt: license ? license.createdAt : client.createdAt
      };
    }));

    res.status(200).json(clientsWithLicense);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clients', error: error.message });
  }
};

// Update client license and expiry
export const updateLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const { licenseKey, validUntil, resetHardware } = req.body;

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    // Update Client License Key
    if (licenseKey) {
      client.licenseKey = licenseKey;
    }
    
    // Reset hardware ID if requested (allows them to install on a new computer)
    if (resetHardware) {
      client.hardwareId = null;
    }
    
    await client.save();

    // Update License Document
    const license = await License.findOne({ client: id });
    if (license) {
      if (licenseKey) license.key = licenseKey;
      if (validUntil) license.validUntil = new Date(validUntil);
      await license.save();
    } else if (licenseKey && validUntil) {
       // If somehow missing, create it
       const newLicense = new License({
         key: licenseKey,
         client: id,
         plan: 'Custom',
         validUntil: new Date(validUntil)
       });
       await newLicense.save();
    }

    // Handle mapsUrl if provided
    const mapsUrl = req.body.mapsUrl;
    if (mapsUrl) {
      client.location = client.location || {};
      client.location.mapsUrl = mapsUrl;
      client.location.lastUpdated = new Date();

      try {
        let query = '';
        const decodedUrl = decodeURIComponent(mapsUrl);
        const daddrMatch = decodedUrl.match(/daddr=([^&]+)/);
        if (daddrMatch) {
          query = daddrMatch[1].replace(/\+/g, ' ');
        } else {
          const placeMatch = decodedUrl.match(/\/place\/([^\/]+)/);
          if (placeMatch) {
            query = placeMatch[1].replace(/\+/g, ' ');
          } else {
            const dirMatch = decodedUrl.match(/\/dir\/[^\/]*\/([^\/]+)/);
            if (dirMatch) {
              query = dirMatch[1].replace(/\+/g, ' ');
            } else {
              const searchMatch = decodedUrl.match(/\/search\/([^\/]+)/) || decodedUrl.match(/\?q=([^&]+)/);
              if (searchMatch) {
                query = searchMatch[1].replace(/\+/g, ' ');
              }
            }
          }
        }

        if (query) {
          let parts = query.split(',').map(s => s.trim());
          let foundLocation = null;

          while (parts.length > 0 && !foundLocation) {
            const currentQuery = parts.join(', ');
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(currentQuery)}&format=json&limit=1&addressdetails=1`;
            
            const response = await fetch(url, {
              headers: { 'User-Agent': 'RestaurantBillingSuperAdmin/1.0' }
            });

            if (response.ok) {
              const data = await response.json();
              if (data && data.length > 0) {
                foundLocation = data[0];
              }
            }
            parts.shift(); // Remove the most specific part and try again if not found
          }

          if (foundLocation) {
            const address = foundLocation.address || {};
            // Prefer state_district or county as the "city" for correct district categorization
            const district = address.state_district || address.county || address.city || address.town || address.village || foundLocation.name;
            const country = address.country || 'India';
            
            client.location.lat = parseFloat(foundLocation.lat);
            client.location.lon = parseFloat(foundLocation.lon);
            client.location.city = district;
            client.location.country = country;
          }
        }
      } catch (error) {
        console.error('Error fetching location data from mapsUrl:', error);
      }
      
      await client.save();
    }

    res.status(200).json({ message: 'License updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating license', error: error.message });
  }
};

// Create a new client and generate a license
export const createClient = async (req, res) => {
  try {
    const { restaurantName, ownerName, email, password, plan, customDays, staffAccounts } = req.body;

    // Check if email exists
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Generate unique license key (e.g. MSBILL-ABCD-1234-WXYZ)
    const generateKeySegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    const licenseKey = `MSBILL-${generateKeySegment()}-${generateKeySegment()}-${generateKeySegment()}`;

    // Ensure staffAccounts includes Admin account
    let staff = Array.isArray(staffAccounts) ? [...staffAccounts] : [];
    const hasAdminStaff = staff.some(s => s.role === 'Admin');
    if (!hasAdminStaff) {
      staff.unshift({
        role: 'Admin',
        username: email,
        plainTextPassword: password
      });
    }

    // Pre-generate client ID and databaseName right away
    const tempId = new mongoose.Types.ObjectId();
    const sanitizedName = (restaurantName || 'resto').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
    const databaseName = `client_${sanitizedName}_${tempId.toString().substring(0, 6)}`;

    // Create client (storing plainTextPassword as requested by Super Admin)
    const newClient = new Client({
      _id: tempId,
      restaurantName,
      ownerName,
      email,
      plainTextPassword: password, // For admin visibility/support
      databaseName,
      licenseKey,
      staffAccounts: staff
    });

    const savedClient = await newClient.save();

    // Determine validity based on plan
    const validUntil = new Date();
    if (plan === 'Monthly') validUntil.setMonth(validUntil.getMonth() + 1);
    else if (plan === 'Yearly') validUntil.setFullYear(validUntil.getFullYear() + 1);
    else if (plan === 'Lifetime') validUntil.setFullYear(validUntil.getFullYear() + 100);
    else if (plan === 'Custom' && customDays) {
      validUntil.setDate(validUntil.getDate() + parseInt(customDays, 10));
    }

    // Save license to DB
    const newLicense = new License({
      key: licenseKey,
      client: savedClient._id,
      plan: plan || 'Yearly',
      validUntil
    });

    await newLicense.save();

    // CRITICAL: Provision the Admin and staff accounts directly into the tenant's MongoDB database!
    await provisionTenantUsers(savedClient, password);

    res.status(201).json({
      message: 'Client and License generated successfully',
      client: savedClient
    });

  } catch (error) {
    res.status(500).json({ message: 'Error creating client', error: error.message });
  }
};

// Update client password directly (Super Admin override)
export const updateClientPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    client.plainTextPassword = newPassword;
    if (client.staffAccounts && Array.isArray(client.staffAccounts)) {
      client.staffAccounts.forEach(s => {
        if (s.role === 'Admin' || s.username === client.email) {
          s.plainTextPassword = newPassword;
        }
      });
    }
    await client.save();

    // Also update password in the tenant's database!
    await provisionTenantUsers(client, newPassword);

    res.status(200).json({ message: 'Password updated successfully', client });
  } catch (error) {
    res.status(500).json({ message: 'Error updating password', error: error.message });
  }
};

// Validate License Key (Called by Desktop App on startup)
export const validateLicense = async (req, res) => {
  try {
    const { licenseKey, hardwareId } = req.body;

    if (!licenseKey || !hardwareId) {
      return res.status(400).json({ valid: false, message: 'License key and Hardware ID are required' });
    }

    const license = await License.findOne({ key: licenseKey });
    if (!license) {
      return res.status(404).json({ valid: false, message: 'Invalid License Key' });
    }

    const client = await Client.findById(license.client);
    if (!client) {
      return res.status(404).json({ valid: false, message: 'Client account not found' });
    }

    if (client.status !== 'Active') {
      return res.status(403).json({ valid: false, message: `Account is ${client.status}` });
    }

    if (new Date() > license.validUntil) {
      return res.status(403).json({ valid: false, message: 'License has expired' });
    }

    // Hardware ID Binding
    // Allow permanent/lifetime accounts (like Maheer Restaurant) to be used on ANY device/computer without restriction!
    if (!client.hardwareId) {
      client.hardwareId = hardwareId;
      await client.save();
    } else if (client.hardwareId !== hardwareId && client.plan !== 'Lifetime Premium' && client.plan !== '1 Year Premium' && !client.licenseKey.includes('MAH') && !client.licenseKey.includes('DEMO') && !client.licenseKey.includes('MM') && !client.licenseKey.includes('39BB') && !client.licenseKey.includes('SAIF') && !client.licenseKey.includes('STAR')) {
      // Trying to use on a different computer! Block it only if not a permanent/premium license.
      return res.status(403).json({ valid: false, message: 'License is already bound to another computer. Contact support.' });
    }

    // Generate Database Name if missing (for Multi-Tenancy)
    if (!client.databaseName) {
      const sanitizedName = client.restaurantName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
    }

    // Capture Geographic Location silently
    try {
      const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const cleanIp = ip ? ip.split(',')[0].trim() : null;
      if (cleanIp && cleanIp !== '::1' && cleanIp !== '127.0.0.1') {
        // Only update once a day to prevent rate limiting
        const needsUpdate = !client.location?.lastUpdated || 
          (new Date() - new Date(client.location.lastUpdated)) > 24 * 60 * 60 * 1000;
          
        if (needsUpdate || client.location?.ip !== cleanIp) {
          const geoResp = await fetch(`http://ip-api.com/json/${cleanIp}`);
          const geoData = await geoResp.json();
          if (geoData.status === 'success') {
            client.location = {
              city: geoData.city,
              region: geoData.regionName,
              country: geoData.country,
              lat: geoData.lat,
              lon: geoData.lon,
              ip: cleanIp,
              lastUpdated: new Date()
            };
          }
        }
      }
    } catch (e) {
      console.error('GeoIP Error:', e.message);
    }

    await client.save();

    // Ensure tenant admin & staff users are provisioned in MongoDB
    await provisionTenantUsers(client, client.plainTextPassword);

    // Fetch active broadcasts
    const activeBroadcasts = await Broadcast.find({ active: true }).sort({ createdAt: -1 });

    res.status(200).json({
      valid: true,
      message: 'License Verified',
      restaurantName: client.restaurantName,
      email: client.email,
      username: client.email,
      validUntil: license.validUntil,
      databaseName: client.databaseName,
      plainTextPassword: client.plainTextPassword,
      features: client.features,
      broadcasts: activeBroadcasts,
      staffAccounts: client.staffAccounts || []
    });

  } catch (error) {
    res.status(500).json({ valid: false, message: 'Error validating license', error: error.message });
  }
};

// Account-Based Login (Replacement for hardware-bound License Keys)
export const loginClient = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ valid: false, message: 'Email and password are required' });
    }

    const client = await Client.findOne({ email });
    if (!client) {
      return res.status(404).json({ valid: false, message: 'Invalid email or password' });
    }

    // Since passwords were saved as plainTextPassword previously for admin visibility
    if (client.plainTextPassword !== password) {
      return res.status(401).json({ valid: false, message: 'Invalid email or password' });
    }

    if (client.status !== 'Active') {
      return res.status(403).json({ valid: false, message: `Account is ${client.status}` });
    }

    const license = await License.findOne({ client: client._id });
    if (!license) {
      return res.status(404).json({ valid: false, message: 'No active subscription found' });
    }

    if (new Date() > license.validUntil) {
      return res.status(403).json({ valid: false, message: 'Subscription has expired' });
    }

    // Generate Database Name if missing (for Multi-Tenancy)
    if (!client.databaseName) {
      const sanitizedName = client.restaurantName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
    }

    // Capture Geographic Location silently
    try {
      const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const cleanIp = ip ? ip.split(',')[0].trim() : null;
      if (cleanIp && cleanIp !== '::1' && cleanIp !== '127.0.0.1') {
        const needsUpdate = !client.location?.lastUpdated || 
          (new Date() - new Date(client.location.lastUpdated)) > 24 * 60 * 60 * 1000;
          
        if (needsUpdate || client.location?.ip !== cleanIp) {
          const geoResp = await fetch(`http://ip-api.com/json/${cleanIp}`);
          const geoData = await geoResp.json();
          if (geoData.status === 'success') {
            client.location = {
              city: geoData.city,
              region: geoData.regionName,
              country: geoData.country,
              lat: geoData.lat,
              lon: geoData.lon,
              ip: cleanIp,
              lastUpdated: new Date()
            };
          }
        }
      }
    } catch (e) {
      console.error('GeoIP Error:', e.message);
    }

    await client.save();

    // Ensure tenant admin & staff users are provisioned in MongoDB
    await provisionTenantUsers(client, client.plainTextPassword);

    res.status(200).json({
      valid: true,
      message: 'Login Successful',
      restaurantName: client.restaurantName,
      email: client.email,
      username: client.email,
      validUntil: license.validUntil,
      databaseName: client.databaseName,
      plainTextPassword: client.plainTextPassword,
      licenseKey: client.licenseKey, // Send it back so POS can store it backward-compatibly
      features: client.features,
      staffAccounts: client.staffAccounts || []
    });

  } catch (error) {
    res.status(500).json({ valid: false, message: 'Error logging in', error: error.message });
  }
};

// Update client features (Super Admin toggle)
export const updateFeatures = async (req, res) => {
  try {
    const { id } = req.params;
    const { features } = req.body;

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    client.features = { ...client.features, ...features };
    await client.save();

    res.status(200).json({ message: 'Features updated successfully', features: client.features });
  } catch (error) {
    res.status(500).json({ message: 'Error updating features', error: error.message });
  }
};

// Get License info and features (For POS initialization check)
export const getLicenseInfo = async (req, res) => {
  try {
    const { key } = req.params;
    const client = await Client.findOne({ licenseKey: key });
    if (!client) {
      return res.status(404).json({ valid: false, message: 'Invalid License Key' });
    }
    
    const license = await License.findOne({ client: client._id });
    if (!license) {
      return res.status(404).json({ valid: false, message: 'No active subscription found' });
    }

    // Ensure databaseName is set
    if (!client.databaseName) {
      const sanitizedName = (client.restaurantName || 'resto').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
      await client.save();
    }

    // Ensure tenant admin & staff users are provisioned in MongoDB
    await provisionTenantUsers(client, client.plainTextPassword);

    const activeBroadcasts = await Broadcast.find({ active: true }).sort({ createdAt: -1 });

    res.status(200).json({
      valid: true,
      restaurantName: client.restaurantName,
      email: client.email,
      username: client.email,
      databaseName: client.databaseName,
      validUntil: license.validUntil,
      status: client.status,
      features: client.features,
      broadcasts: activeBroadcasts,
      plainTextPassword: client.plainTextPassword,
      staffAccounts: client.staffAccounts || []
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: 'Error fetching license info', error: error.message });
  }
};

// Update client status (Suspend/Activate)
export const updateClientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    client.status = status;
    await client.save();

    res.status(200).json({ message: `Client status updated to ${status}`, client });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
};

// Delete a client
export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    // Delete associated license
    await License.findOneAndDelete({ client: id });

    // Delete the client
    await Client.findByIdAndDelete(id);

    res.status(200).json({ message: 'Client and associated license deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting client', error: error.message });
  }
};

// Add a staff account to client and sync to tenant database
export const addStaffAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, role, plainTextPassword } = req.body;

    if (!username || !plainTextPassword) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    if (!client.databaseName) {
      const sanitizedName = (client.restaurantName || 'resto').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
    }

    // Check if username already exists in staffAccounts
    const cleanUsername = username.trim();
    if (client.staffAccounts.some(s => s.username && s.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return res.status(400).json({ message: `A staff account with username "${cleanUsername}" already exists.` });
    }

    const newStaffItem = {
      username: cleanUsername,
      role: role || 'Cashier',
      plainTextPassword: plainTextPassword.trim()
    };

    client.staffAccounts.push(newStaffItem);

    // If adding an Admin and client plainTextPassword wasn't set, sync it
    if (newStaffItem.role === 'Admin' && !client.plainTextPassword) {
      client.plainTextPassword = newStaffItem.plainTextPassword;
    }

    await client.save();

    // Sync to tenant MongoDB database
    const hashedPassword = await bcrypt.hash(newStaffItem.plainTextPassword, 10);
    const tenantDb = mongoose.connection.useDb(client.databaseName, { useCache: true });
    const usersCol = tenantDb.collection('users');

    await usersCol.updateOne(
      { username: cleanUsername },
      {
        $set: {
          username: cleanUsername,
          password: hashedPassword,
          role: newStaffItem.role,
          updatedAt: new Date()
        },
        $setOnInsert: {
          activeSessions: [],
          fcmTokens: [],
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.status(201).json({
      message: 'Staff account added and synchronized successfully',
      staffAccounts: client.staffAccounts
    });
  } catch (error) {
    console.error('Error adding staff account:', error);
    res.status(500).json({ message: 'Error adding staff account', error: error.message });
  }
};

// Update a staff account and sync to tenant database
export const updateStaffAccount = async (req, res) => {
  try {
    const { id, staffId } = req.params;
    const { username, role, plainTextPassword, oldUsername } = req.body;

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    if (!client.databaseName) {
      const sanitizedName = (client.restaurantName || 'resto').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
    }

    // Find staff member by _id or index or oldUsername
    let staffMember = client.staffAccounts.id ? client.staffAccounts.id(staffId) : null;
    if (!staffMember) {
      const idx = parseInt(staffId, 10);
      if (!isNaN(idx) && client.staffAccounts[idx]) {
        staffMember = client.staffAccounts[idx];
      } else if (oldUsername) {
        staffMember = client.staffAccounts.find(s => s.username === oldUsername);
      }
    }

    if (!staffMember) {
      return res.status(404).json({ message: 'Staff account not found' });
    }

    const prevUsername = staffMember.username;
    const newUsername = (username || staffMember.username).trim();
    const newRole = role || staffMember.role || 'Cashier';
    const newPassword = (plainTextPassword || staffMember.plainTextPassword).trim();

    staffMember.username = newUsername;
    staffMember.role = newRole;
    staffMember.plainTextPassword = newPassword;

    // If role is Admin, also sync client's primary password if applicable
    if (newRole === 'Admin' && (client.email === newUsername || client.staffAccounts.length === 1)) {
      client.plainTextPassword = newPassword;
    }

    await client.save();

    // Sync to tenant MongoDB database
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const tenantDb = mongoose.connection.useDb(client.databaseName, { useCache: true });
    const usersCol = tenantDb.collection('users');

    // If username changed, delete the old username entry from tenant DB
    if (prevUsername && prevUsername.toLowerCase() !== newUsername.toLowerCase()) {
      await usersCol.deleteOne({ username: prevUsername });
    }

    await usersCol.updateOne(
      { username: newUsername },
      {
        $set: {
          username: newUsername,
          password: hashedPassword,
          role: newRole,
          updatedAt: new Date()
        },
        $setOnInsert: {
          activeSessions: [],
          fcmTokens: [],
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.status(200).json({
      message: 'Staff account updated and synchronized successfully',
      staffAccounts: client.staffAccounts
    });
  } catch (error) {
    console.error('Error updating staff account:', error);
    res.status(500).json({ message: 'Error updating staff account', error: error.message });
  }
};

// Delete a staff account from client and remove from tenant database
export const deleteStaffAccount = async (req, res) => {
  try {
    const { id, staffId } = req.params;

    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    let targetUsername = null;
    let staffMember = client.staffAccounts.id ? client.staffAccounts.id(staffId) : null;

    if (staffMember) {
      targetUsername = staffMember.username;
      staffMember.deleteOne();
    } else {
      const idx = parseInt(staffId, 10);
      if (!isNaN(idx) && client.staffAccounts[idx]) {
        targetUsername = client.staffAccounts[idx].username;
        client.staffAccounts.splice(idx, 1);
      } else {
        const foundIdx = client.staffAccounts.findIndex(s => s.username === staffId || s._id?.toString() === staffId);
        if (foundIdx !== -1) {
          targetUsername = client.staffAccounts[foundIdx].username;
          client.staffAccounts.splice(foundIdx, 1);
        }
      }
    }

    if (!targetUsername) {
      return res.status(404).json({ message: 'Staff account not found' });
    }

    await client.save();

    // Delete from tenant MongoDB database if databaseName exists
    if (client.databaseName) {
      const tenantDb = mongoose.connection.useDb(client.databaseName, { useCache: true });
      const usersCol = tenantDb.collection('users');
      await usersCol.deleteOne({ username: targetUsername });
    }

    res.status(200).json({
      message: `Staff account "${targetUsername}" deleted and removed from database`,
      staffAccounts: client.staffAccounts
    });
  } catch (error) {
    console.error('Error deleting staff account:', error);
    res.status(500).json({ message: 'Error deleting staff account', error: error.message });
  }
};
