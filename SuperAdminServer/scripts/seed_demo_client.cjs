require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superAdminUri = process.env.MONGODB_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
const tenantUri = superAdminUri.replace('/mscurechain?', '/client_demo_db?');

async function seedDemo() {
  try {
    console.log('--- 1. Connecting to SuperAdmin DB (mscurechain) ---');
    await mongoose.connect(superAdminUri);

    // Schemas for SuperAdmin
    const ClientSchema = new mongoose.Schema({
      restaurantName: String,
      ownerName: String,
      email: String,
      plainTextPassword: String,
      licenseKey: String,
      status: { type: String, default: 'Active' },
      hardwareId: String,
      databaseName: String,
      plan: String
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

    const demoKey = 'MSBILL-DEMO-TEAM-2026';
    const validUntil = new Date('2126-12-31T23:59:59Z');

    let client = await Client.findOne({ licenseKey: demoKey });
    if (!client) {
      console.log('Creating new Demo Client in SuperAdmin DB...');
      client = new Client({
        restaurantName: 'DEMO RESTAURANT (Presentation)',
        ownerName: 'Sales & Presentation Team',
        email: 'demo-team@msbilling.com',
        plainTextPassword: 'demo123',
        licenseKey: demoKey,
        status: 'Active',
        databaseName: 'client_demo_db',
        hardwareId: null, // Exempt from HWID locking
        plan: 'Lifetime Premium'
      });
      await client.save();
    } else {
      console.log('Updating existing Demo Client in SuperAdmin DB...');
      client.restaurantName = 'DEMO RESTAURANT (Presentation)';
      client.status = 'Active';
      client.databaseName = 'client_demo_db';
      client.hardwareId = null;
      client.plan = 'Lifetime Premium';
      await client.save();
    }

    let license = await License.findOne({ key: demoKey });
    if (!license) {
      license = new License({
        key: demoKey,
        client: client._id,
        plan: 'Lifetime Premium',
        validUntil: validUntil,
        status: 'active'
      });
      await license.save();
    } else {
      license.validUntil = validUntil;
      license.status = 'active';
      await license.save();
    }

    console.log('SuperAdmin Demo Client Seeded Successfully!');
    await mongoose.disconnect();

    console.log('\n--- 2. Connecting to Tenant DB (client_demo_db) ---');
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
      { username: 'demo_admin', password: 'demo123', role: 'Admin' },
      { username: 'admin', password: 'admin123', role: 'Admin' },
      { username: 'Admin', password: 'demo123', role: 'Admin' },
      { username: 'demo_cashier', password: 'demo123', role: 'Cashier' },
      { username: 'cashier', password: 'cashier123', role: 'Cashier' },
      { username: 'demo_captain', password: 'demo123', role: 'Captain' },
      { username: 'captain', password: 'captain123', role: 'Captain' }
    ];

    console.log('Seeding Demo Users...');
    for (const u of usersToSeed) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await User.findOneAndUpdate(
        { username: u.username },
        { password: hashedPassword, role: u.role, activeSessions: [] },
        { upsert: true }
      );
    }

    // Seed Menu Items
    const menuItems = [
      { name: 'Chicken 65', price: 280, category: 'Starters', itemCode: 'STR01' },
      { name: 'Paneer Tikka', price: 240, category: 'Starters', itemCode: 'STR02' },
      { name: 'Crispy Corn', price: 210, category: 'Starters', itemCode: 'STR03' },
      { name: 'Mutton Seekh Kebab', price: 380, category: 'Starters', itemCode: 'STR04' },
      { name: 'Hyderabadi Chicken Dum Biryani', price: 350, category: 'Biryani & Rice', itemCode: 'BIR01' },
      { name: 'Mutton Mandi Biryani', price: 480, category: 'Biryani & Rice', itemCode: 'BIR02' },
      { name: 'Paneer Biryani', price: 280, category: 'Biryani & Rice', itemCode: 'BIR03' },
      { name: 'Jeera Rice', price: 160, category: 'Biryani & Rice', itemCode: 'BIR04' },
      { name: 'Butter Chicken', price: 320, category: 'Main Course', itemCode: 'MAIN01' },
      { name: 'Dal Makhani', price: 220, category: 'Main Course', itemCode: 'MAIN02' },
      { name: 'Kadai Paneer', price: 260, category: 'Main Course', itemCode: 'MAIN03' },
      { name: 'Butter Naan', price: 50, category: 'Main Course', itemCode: 'MAIN04' },
      { name: 'Garlic Naan', price: 60, category: 'Main Course', itemCode: 'MAIN05' },
      { name: 'Fresh Lime Soda', price: 90, category: 'Beverages & Desserts', itemCode: 'BEV01' },
      { name: 'Masala Chai', price: 40, category: 'Beverages & Desserts', itemCode: 'BEV02' },
      { name: 'Qubani Ka Meetha', price: 150, category: 'Beverages & Desserts', itemCode: 'DES01' },
      { name: 'Gulab Jamun with Ice Cream', price: 120, category: 'Beverages & Desserts', itemCode: 'DES02' }
    ];

    console.log('Seeding Demo Menu Items...');
    for (const item of menuItems) {
      await Menu.findOneAndUpdate(
        { name: item.name },
        { price: item.price, category: item.category, isAvailable: true, itemCode: item.itemCode },
        { upsert: true }
      );
    }

    // Seed Settings
    console.log('Seeding Demo Restaurant Settings...');
    const demoSettings = {
      restaurantName: 'DEMO RESTAURANT (Presentation)',
      restaurantType: 'Multi-Cuisine Fine Dining & POS',
      address: 'Tech Hub, Cyber City, Hyderabad - 500081',
      phone: '9876543210',
      email: 'demo@msbilling.com',
      gstin: '36DEMO1234F1Z5'
    };
    await Setting.findOneAndUpdate(
      { key: 'restaurantSettings' },
      { value: demoSettings },
      { upsert: true }
    );

    console.log('====================================================');
    console.log('DEMO ACCOUNT SEEDED & READY FOR PRESENTATIONS!');
    console.log('====================================================');
    console.log('License Key:', demoKey);
    console.log('Database:', 'client_demo_db');
    console.log('Admin Login:', 'demo_admin / demo123 (or admin / admin123)');
    console.log('Cashier Login:', 'demo_cashier / demo123 (or cashier / cashier123)');
    console.log('Captain Login:', 'demo_captain / demo123 (or captain / captain123)');
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding demo account:', err);
    process.exit(1);
  }
}

seedDemo();
