import Client from '../models/Client.js';
import License from '../models/License.js';
import Broadcast from '../models/Broadcast.js';
import crypto from 'crypto';

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

    res.status(200).json({ message: 'License updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating license', error: error.message });
  }
};

// Create a new client and generate a license
export const createClient = async (req, res) => {
  try {
    const { restaurantName, ownerName, email, password, plan, staffAccounts } = req.body;

    // Check if email exists
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Generate unique license key (e.g. MSBILL-ABCD-1234-WXYZ)
    const generateKeySegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    const licenseKey = `MSBILL-${generateKeySegment()}-${generateKeySegment()}-${generateKeySegment()}`;

    // Create client (storing plainTextPassword as requested by Super Admin)
    const newClient = new Client({
      restaurantName,
      ownerName,
      email,
      plainTextPassword: password, // For admin visibility/support
      licenseKey,
      staffAccounts: staffAccounts || []
    });

    const savedClient = await newClient.save();

    // Determine validity based on plan
    const validUntil = new Date();
    if (plan === 'Monthly') validUntil.setMonth(validUntil.getMonth() + 1);
    else if (plan === 'Yearly') validUntil.setFullYear(validUntil.getFullYear() + 1);
    else if (plan === 'Lifetime') validUntil.setFullYear(validUntil.getFullYear() + 100);

    // Save license to DB
    const newLicense = new License({
      key: licenseKey,
      client: savedClient._id,
      plan: plan || 'Yearly',
      validUntil
    });

    await newLicense.save();

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
    await client.save();

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
      const sanitizedName = client.restaurantName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
    }

    // Capture Geographic Location silently
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
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

    // Fetch active broadcasts
    const activeBroadcasts = await Broadcast.find({ active: true }).sort({ createdAt: -1 });

    res.status(200).json({
      valid: true,
      message: 'License Verified',
      restaurantName: client.restaurantName,
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
      const sanitizedName = client.restaurantName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
    }

    // Capture Geographic Location silently
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
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

    res.status(200).json({
      valid: true,
      message: 'Login Successful',
      restaurantName: client.restaurantName,
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

    res.status(200).json({
      valid: true,
      restaurantName: client.restaurantName,
      validUntil: license.validUntil,
      status: client.status,
      features: client.features
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
