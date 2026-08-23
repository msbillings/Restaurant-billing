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

    if (licenseKey) {
      client.licenseKey = licenseKey;
    }
    
    if (resetHardware) {
      client.hardwareId = null;
    }
    
    await client.save();

    const license = await License.findOne({ client: id });
    if (license) {
      if (licenseKey) license.key = licenseKey;
      if (validUntil) license.validUntil = new Date(validUntil);
      await license.save();
    } else if (licenseKey && validUntil) {
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
    const { restaurantName, ownerName, email, password, plan, customDays, staffAccounts } = req.body;

    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const generateKeySegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    const licenseKey = `MSBILL-${generateKeySegment()}-${generateKeySegment()}-${generateKeySegment()}`;

    const newClient = new Client({
      restaurantName,
      ownerName,
      email,
      plainTextPassword: password,
      licenseKey,
      staffAccounts: staffAccounts || []
    });

    const savedClient = await newClient.save();

    const validUntil = new Date();
    if (plan === 'Monthly') validUntil.setMonth(validUntil.getMonth() + 1);
    else if (plan === 'Yearly') validUntil.setFullYear(validUntil.getFullYear() + 1);
    else if (plan === 'Lifetime') validUntil.setFullYear(validUntil.getFullYear() + 100);
    else if (plan === 'Custom' && customDays) {
      validUntil.setDate(validUntil.getDate() + parseInt(customDays, 10));
    }

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

// Update client password directly
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

// Validate License Key
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

    if (!client.hardwareId) {
      client.hardwareId = hardwareId;
      await client.save();
    }

    if (!client.databaseName) {
      const sanitizedName = client.restaurantName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
      await client.save();
    }

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

// Account-Based Login
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

    if (!client.databaseName) {
      const sanitizedName = client.restaurantName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
      client.databaseName = `client_${sanitizedName}_${client._id.toString().substring(0, 6)}`;
      await client.save();
    }

    res.status(200).json({
      valid: true,
      message: 'Login Successful',
      restaurantName: client.restaurantName,
      validUntil: license.validUntil,
      databaseName: client.databaseName,
      plainTextPassword: client.plainTextPassword,
      licenseKey: client.licenseKey,
      features: client.features,
      staffAccounts: client.staffAccounts || []
    });

  } catch (error) {
    res.status(500).json({ valid: false, message: 'Error logging in', error: error.message });
  }
};

// Update client features
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

// Get License info and features
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

    const activeBroadcasts = await Broadcast.find({ active: true }).sort({ createdAt: -1 });

    res.status(200).json({
      valid: true,
      restaurantName: client.restaurantName,
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

// Update client status
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

    await License.findOneAndDelete({ client: id });
    await Client.findByIdAndDelete(id);

    res.status(200).json({ message: 'Client and associated license deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting client', error: error.message });
  }
};
