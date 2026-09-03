require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superAdminUri = process.env.MONGODB_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
const tenantDbName = 'client_yahabibi_db';
const tenantUri = superAdminUri.replace('/mscurechain?', `/${tenantDbName}?`);

async function seedYaHabibi() {
  try {
    console.log('--- 1. Connecting to SuperAdmin DB (mscurechain) ---');
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

    const email = 'yahabibi@msbilling.com';
    const password = 'yahabibi123';
    const licenseKey = 'MSBILL-YAHABIBI-KADAPA-2026';
    const validUntil = new Date('2126-12-31T23:59:59Z');

    let client = await Client.findOne({ email });
    if (!client) {
      console.log('Creating new Client for Ya Habibi in SuperAdmin DB...');
      client = new Client({
        restaurantName: 'Ya Habibi Mandi & Biryani Restaurant',
        ownerName: 'Ya Habibi Management',
        email: email,
        plainTextPassword: password,
        licenseKey: licenseKey,
        status: 'Active',
        databaseName: tenantDbName,
        hardwareId: null, // Exempt from HWID locking so it works across devices
        plan: 'Lifetime Premium',
        location: {
          city: 'Kadapa',
          region: 'Andhra Pradesh',
          country: 'India',
          address: 'Trunk Road, Near 2nd Gandhi Statue, KADAPA'
        },
        features: {
          kds: true,
          inventory: true,
          crm: true,
          staff: true,
          analytics: true,
          daybook: true,
          qrcode: true
        }
      });
      await client.save();
    } else {
      console.log('Updating existing Client in SuperAdmin DB...');
      client.restaurantName = 'Ya Habibi Mandi & Biryani Restaurant';
      client.ownerName = 'Ya Habibi Management';
      client.plainTextPassword = password;
      client.licenseKey = licenseKey;
      client.status = 'Active';
      client.databaseName = tenantDbName;
      client.hardwareId = null;
      client.plan = 'Lifetime Premium';
      client.location = {
        city: 'Kadapa',
        region: 'Andhra Pradesh',
        country: 'India',
        address: 'Trunk Road, Near 2nd Gandhi Statue, KADAPA'
      };
      client.features = {
        kds: true,
        inventory: true,
        crm: true,
        staff: true,
        analytics: true,
        daybook: true,
        qrcode: true
      };
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

    console.log('SuperAdmin Client & License Provisioned Successfully!');
    await mongoose.disconnect();

    console.log(`\n--- 2. Connecting to Tenant DB (${tenantDbName}) ---`);
    await mongoose.connect(tenantUri);

    // Tenant Schemas
    const UserSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['Admin', 'Cashier', 'Captain'], default: 'Cashier' },
      activeSessions: Array
    }, { timestamps: true });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const MenuSchema = new mongoose.Schema({
      name: String,
      price: Number,
      category: String,
      isAvailable: { type: Boolean, default: true },
      itemCode: String
    });
    const Menu = mongoose.models.Menu || mongoose.model('Menu', MenuSchema);

    const SettingSchema = new mongoose.Schema({
      key: { type: String, unique: true },
      value: mongoose.Schema.Types.Mixed
    });
    const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);

    // Seed Users
    const usersToSeed = [
      { username: 'yahabibi', password: password, role: 'Admin' },
      { username: 'admin', password: password, role: 'Admin' },
      { username: 'cashier', password: password, role: 'Cashier' },
      { username: 'captain', password: password, role: 'Captain' }
    ];

    console.log('Seeding Shop Users...');
    for (const u of usersToSeed) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await User.findOneAndUpdate(
        { username: u.username },
        { password: hashedPassword, role: u.role, activeSessions: [] },
        { upsert: true }
      );
    }

    // Seed Mandi & Biryani Menu Items
    const menuItems = [
      { name: 'Chicken Mandi (Half)', price: 380, category: 'Mandi Specials', itemCode: 'MND01' },
      { name: 'Chicken Mandi (Full)', price: 680, category: 'Mandi Specials', itemCode: 'MND02' },
      { name: 'Mutton Mandi (Half)', price: 490, category: 'Mandi Specials', itemCode: 'MND03' },
      { name: 'Mutton Mandi (Full)', price: 890, category: 'Mandi Specials', itemCode: 'MND04' },
      { name: 'Ya Habibi Special Mandi (Jumbo)', price: 1250, category: 'Mandi Specials', itemCode: 'MND05' },
      { name: 'Chicken Dum Biryani', price: 260, category: 'Biryani Specials', itemCode: 'BIR01' },
      { name: 'Chicken Fry Piece Biryani', price: 290, category: 'Biryani Specials', itemCode: 'BIR02' },
      { name: 'Special Mutton Dum Biryani', price: 380, category: 'Biryani Specials', itemCode: 'BIR03' },
      { name: 'Paneer Biryani', price: 240, category: 'Biryani Specials', itemCode: 'BIR04' },
      { name: 'Chicken 65', price: 260, category: 'Starters', itemCode: 'STR01' },
      { name: 'Chicken Majestic', price: 280, category: 'Starters', itemCode: 'STR02' },
      { name: 'Chicken Lollipop', price: 290, category: 'Starters', itemCode: 'STR03' },
      { name: 'Butter Chicken', price: 280, category: 'Curries & Gravies', itemCode: 'CUR01' },
      { name: 'Rumali Roti', price: 30, category: 'Breads', itemCode: 'BRD01' },
      { name: 'Butter Naan', price: 50, category: 'Breads', itemCode: 'BRD02' },
      { name: 'Fresh Lime Soda', price: 60, category: 'Beverages', itemCode: 'BEV01' },
      { name: 'Mineral Water', price: 20, category: 'Beverages', itemCode: 'BEV02' }
    ];

    console.log('Seeding Menu Items...');
    for (const item of menuItems) {
      await Menu.findOneAndUpdate(
        { name: item.name },
        { price: item.price, category: item.category, isAvailable: true, itemCode: item.itemCode },
        { upsert: true }
      );
    }

    // Seed Restaurant Settings
    console.log('Seeding Restaurant Settings...');
    const restaurantSettings = {
      restaurantName: 'Ya Habibi Mandi & Biryani Restaurant',
      restaurantType: 'Mandi & Biryani Restaurant',
      address: 'Trunk Road, Near 2nd Gandhi Statue, KADAPA',
      phone: '9949945058',
      secondaryPhone: '8008225258',
      whatsappNumber: '9949945058',
      email: 'yahabibi@msbilling.com',
      gstin: ''
    };
    await Setting.findOneAndUpdate(
      { key: 'restaurantSettings' },
      { value: restaurantSettings },
      { upsert: true }
    );

    console.log('====================================================');
    console.log('YA HABIBI RESTAURANT PROVISIONED SUCCESSFULLY!');
    console.log('====================================================');
    console.log('Shop Name: Ya Habibi Mandi & Biryani Restaurant');
    console.log('Database:', tenantDbName);
    console.log('License Email:', email);
    console.log('License Password:', password);
    console.log('License Key:', licenseKey);
    console.log('----------------------------------------------------');
    console.log('POS Login Username: yahabibi  (or admin / cashier / captain)');
    console.log('POS Login Password:', password);
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error provisioning Ya Habibi account:', err);
    process.exit(1);
  }
}

seedYaHabibi();
