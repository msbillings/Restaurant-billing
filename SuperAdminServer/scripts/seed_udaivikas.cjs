require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superAdminUri = process.env.MONGODB_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
const tenantDbName = 'client_udaivikas_db';
const tenantUri = superAdminUri.replace('/mscurechain?', `/${tenantDbName}?`);

async function seedClient() {
  try {
    console.log('========================================================');
    console.log('       CREATING CLIENT CREDENTIALS DIRECTLY IN DB       ');
    console.log('========================================================');

    console.log('\n--- 1. Connecting to SuperAdmin DB (mscurechain) ---');
    await mongoose.connect(superAdminUri);

    // Schemas for SuperAdmin
    const ClientSchema = new mongoose.Schema({
      restaurantName: String,
      ownerName: String,
      email: { type: String, unique: true },
      plainTextPassword: String,
      licenseKey: String,
      status: { type: String, default: 'Active' },
      hardwareId: String,
      databaseName: String,
      plan: String,
      location: Object,
      features: Object,
      staffAccounts: Array
    }, { strict: false });
    const Client = mongoose.models.Client || mongoose.model('Client', ClientSchema);

    const LicenseSchema = new mongoose.Schema({
      key: String,
      client: mongoose.Schema.Types.ObjectId,
      plan: String,
      validUntil: Date,
      status: { type: String, default: 'active' }
    }, { strict: false });
    const License = mongoose.models.License || mongoose.model('License', LicenseSchema);

    // Client Credentials
    const email = 'udaivikas.m@gmail.com';
    const password = 'Udai@2008';
    const licenseKey = 'MSBILL-UDAI-VIKAS-2026';
    const validUntil = new Date('2126-12-31T23:59:59Z'); // Lifetime

    const clientData = {
      restaurantName: 'Udai Vikas Restaurant',
      ownerName: 'Udai Vikas',
      email: email,
      plainTextPassword: password,
      licenseKey: licenseKey,
      status: 'Active',
      databaseName: tenantDbName,
      hardwareId: null, // Exempt from HWID locking
      plan: 'Lifetime Premium',
      location: {
        city: 'Hyderabad',
        region: 'Telangana',
        country: 'India'
      },
      features: {
        kds: true,
        inventory: true,
        crm: true,
        staff: true,
        analytics: true,
        daybook: true,
        qrcode: true,
        delivery: true,
        expenses: true
      },
      staffAccounts: [
        { role: 'Admin', username: 'udaivikas.m@gmail.com', plainTextPassword: password },
        { role: 'Admin', username: 'udaivikas', plainTextPassword: password },
        { role: 'Admin', username: 'admin', plainTextPassword: password },
        { role: 'Cashier', username: 'cashier', plainTextPassword: password },
        { role: 'Captain', username: 'captain', plainTextPassword: password }
      ]
    };

    let client = await Client.findOne({ email });
    if (!client) {
      console.log(`Creating new Client for ${email} in SuperAdmin DB...`);
      client = new Client(clientData);
      await client.save();
    } else {
      console.log(`Updating existing Client for ${email} in SuperAdmin DB...`);
      Object.assign(client, clientData);
      await client.save();
    }

    let license = await License.findOne({ client: client._id });
    if (!license) {
      license = new License({
        key: licenseKey,
        client: client._id,
        plan: 'Lifetime Premium',
        validUntil: validUntil,
        status: 'active'
      });
      await license.save();
    } else {
      license.key = licenseKey;
      license.plan = 'Lifetime Premium';
      license.validUntil = validUntil;
      license.status = 'active';
      await license.save();
    }

    console.log('✅ SuperAdmin Client & License Provisioned Successfully!');
    await mongoose.disconnect();

    console.log(`\n--- 2. Connecting to Tenant DB (${tenantDbName}) ---`);
    await mongoose.connect(tenantUri);

    // Tenant User Schema
    const UserSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['Admin', 'Cashier', 'Captain'], default: 'Cashier' },
      activeSessions: Array
    }, { timestamps: true });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const SettingSchema = new mongoose.Schema({
      key: { type: String, unique: true },
      value: mongoose.Schema.Types.Mixed
    });
    const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);

    // Seed Shop / Tenant Users
    const usersToSeed = [
      { username: 'udaivikas.m@gmail.com', password: password, role: 'Admin' },
      { username: 'udaivikas', password: password, role: 'Admin' },
      { username: 'admin', password: password, role: 'Admin' },
      { username: 'cashier', password: password, role: 'Cashier' },
      { username: 'captain', password: password, role: 'Captain' }
    ];

    console.log('Seeding Tenant Users in Tenant DB...');
    for (const u of usersToSeed) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await User.findOneAndUpdate(
        { username: u.username },
        { password: hashedPassword, role: u.role, activeSessions: [] },
        { upsert: true, new: true }
      );
    }

    // Seed Restaurant Settings
    console.log('Seeding Restaurant Settings...');
    const restaurantSettings = {
      restaurantName: 'Udai Vikas Restaurant',
      restaurantType: 'Restaurant & POS',
      ownerName: 'Udai Vikas',
      email: email,
      phone: '',
      address: 'India',
      gstin: ''
    };
    await Setting.findOneAndUpdate(
      { key: 'restaurantSettings' },
      { value: restaurantSettings },
      { upsert: true }
    );

    console.log('\n====================================================');
    console.log('   CLIENT CREDENTIALS PROVISIONED SUCCESSFULLY!     ');
    console.log('====================================================');
    console.log('Restaurant Name :', clientData.restaurantName);
    console.log('Database Name   :', tenantDbName);
    console.log('License Email   :', email);
    console.log('License Password:', password);
    console.log('License Key     :', licenseKey);
    console.log('Valid Until     :', validUntil.toISOString());
    console.log('----------------------------------------------------');
    console.log('POS Login Options:');
    console.log('  1. Username: udaivikas.m@gmail.com | Password:', password, '(Admin)');
    console.log('  2. Username: udaivikas             | Password:', password, '(Admin)');
    console.log('  3. Username: admin                 | Password:', password, '(Admin)');
    console.log('  4. Username: cashier               | Password:', password, '(Cashier)');
    console.log('  5. Username: captain               | Password:', password, '(Captain)');
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error provisioning client credentials:', err);
    process.exit(1);
  }
}

seedClient();
