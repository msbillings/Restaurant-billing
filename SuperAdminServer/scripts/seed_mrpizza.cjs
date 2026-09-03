require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superAdminUri = process.env.MONGODB_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
const tenantDbName = 'client_mrpizza_proddatur_db';
const tenantUri = superAdminUri.replace('/mscurechain?', `/${tenantDbName}?`);

async function seedMrPizza() {
  try {
    console.log('========================================================');
    console.log('          MR. PIZZA - PRODUCTION SEED SCRIPT             ');
    console.log('========================================================');
    console.log('\n--- 1. Connecting to SuperAdmin DB (mscurechain) ---');
    await mongoose.connect(superAdminUri);

    // ── Inline Schemas for SuperAdmin DB ──────────────────────────────
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

    // ── Credentials & License ─────────────────────────────────────────
    const email      = 'mrpizza@msbilling.com';
    const password   = 'mrpizza@2026';
    const licenseKey = 'MSBILL-MRPIZZA-PRODDATUR-2026';
    const validUntil = new Date('2126-12-31T23:59:59Z'); // Lifetime

    // ── Upsert Client ─────────────────────────────────────────────────
    let client = await Client.findOne({ email });
    if (!client) {
      console.log('Creating new Client for Mr. Pizza in SuperAdmin DB...');
      client = new Client({
        restaurantName: 'Mr. Pizza - Hot and Fresh',
        ownerName: 'Mr. Pizza Management',
        email,
        plainTextPassword: password,
        licenseKey,
        status: 'Active',
        databaseName: tenantDbName,
        hardwareId: null, // Exempt from HWID locking
        plan: 'Lifetime Premium',
        location: {
          city: 'Proddatur',
          region: 'Andhra Pradesh',
          country: 'India',
          address: 'Proddatur, Andhra Pradesh'
        },
        features: {
          kds: true, inventory: true, crm: true, staff: true,
          analytics: true, daybook: true, qrcode: true,
          delivery: true, expenses: true
        },
        staffAccounts: [
          { role: 'Admin',   username: 'mrpizza', plainTextPassword: password },
          { role: 'Admin',   username: 'admin',   plainTextPassword: password },
          { role: 'Cashier', username: 'cashier', plainTextPassword: password },
          { role: 'Captain', username: 'captain', plainTextPassword: password }
        ]
      });
      await client.save();
      console.log('Client created!');
    } else {
      console.log('Updating existing Client for Mr. Pizza in SuperAdmin DB...');
      client.restaurantName    = 'Mr. Pizza - Hot and Fresh';
      client.ownerName         = 'Mr. Pizza Management';
      client.plainTextPassword = password;
      client.licenseKey        = licenseKey;
      client.status            = 'Active';
      client.databaseName      = tenantDbName;
      client.hardwareId        = null;
      client.plan              = 'Lifetime Premium';
      client.location = {
        city: 'Proddatur', region: 'Andhra Pradesh',
        country: 'India', address: 'Proddatur, Andhra Pradesh'
      };
      client.features = {
        kds: true, inventory: true, crm: true, staff: true,
        analytics: true, daybook: true, qrcode: true,
        delivery: true, expenses: true
      };
      client.staffAccounts = [
        { role: 'Admin',   username: 'mrpizza', plainTextPassword: password },
        { role: 'Admin',   username: 'admin',   plainTextPassword: password },
        { role: 'Cashier', username: 'cashier', plainTextPassword: password },
        { role: 'Captain', username: 'captain', plainTextPassword: password }
      ];
      await client.save();
      console.log('Client updated!');
    }

    // ── Upsert License ────────────────────────────────────────────────
    let license = await License.findOne({ client: client._id });
    if (!license) {
      license = new License({
        key: licenseKey, client: client._id,
        plan: 'Lifetime Premium', validUntil, status: 'active'
      });
      await license.save();
      console.log('License created!');
    } else {
      license.key        = licenseKey;
      license.plan       = 'Lifetime Premium';
      license.validUntil = validUntil;
      license.status     = 'active';
      await license.save();
      console.log('License updated!');
    }

    await mongoose.disconnect();

    // ── 2. Seed Tenant (POS) Database ─────────────────────────────────
    console.log(`\n--- 2. Connecting to Tenant DB (${tenantDbName}) ---`);
    await mongoose.connect(tenantUri);

    const UserSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['Admin', 'Cashier', 'Captain'], default: 'Cashier' },
      activeSessions: Array
    }, { timestamps: true });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const MenuSchema = new mongoose.Schema({
      name: String, price: Number, category: String,
      isAvailable: { type: Boolean, default: true }, itemCode: String
    });
    const Menu = mongoose.models.Menu || mongoose.model('Menu', MenuSchema);

    const SettingSchema = new mongoose.Schema({
      key: { type: String, unique: true },
      value: mongoose.Schema.Types.Mixed
    });
    const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);

    // ── Seed Users ────────────────────────────────────────────────────
    const usersToSeed = [
      { username: 'mrpizza', password, role: 'Admin'   },
      { username: 'admin',   password, role: 'Admin'   },
      { username: 'cashier', password, role: 'Cashier' },
      { username: 'captain', password, role: 'Captain' }
    ];

    console.log('\nSeeding POS Users...');
    for (const u of usersToSeed) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await User.findOneAndUpdate(
        { username: u.username },
        { password: hashedPassword, role: u.role, activeSessions: [] },
        { upsert: true, new: true }
      );
      console.log(`  User "${u.username}" (${u.role}) seeded`);
    }

    // ── Seed Menu Items ────────────────────────────────────────────────
    const menuItems = [
      // Pizzas
      { name: 'Margherita Pizza (Small)',        price: 129, category: 'Pizzas',        itemCode: 'PZZ01' },
      { name: 'Margherita Pizza (Medium)',       price: 199, category: 'Pizzas',        itemCode: 'PZZ02' },
      { name: 'Margherita Pizza (Large)',        price: 279, category: 'Pizzas',        itemCode: 'PZZ03' },
      { name: 'Pepperoni Pizza (Small)',         price: 159, category: 'Pizzas',        itemCode: 'PZZ04' },
      { name: 'Pepperoni Pizza (Medium)',        price: 249, category: 'Pizzas',        itemCode: 'PZZ05' },
      { name: 'Pepperoni Pizza (Large)',         price: 349, category: 'Pizzas',        itemCode: 'PZZ06' },
      { name: 'BBQ Chicken Pizza (Medium)',      price: 279, category: 'Pizzas',        itemCode: 'PZZ07' },
      { name: 'BBQ Chicken Pizza (Large)',       price: 379, category: 'Pizzas',        itemCode: 'PZZ08' },
      { name: 'Veg Supreme Pizza (Medium)',      price: 229, category: 'Pizzas',        itemCode: 'PZZ09' },
      { name: 'Veg Supreme Pizza (Large)',       price: 319, category: 'Pizzas',        itemCode: 'PZZ10' },
      { name: 'Mr. Pizza Special (Large)',       price: 429, category: 'Pizzas',        itemCode: 'PZZ11' },
      // Burgers
      { name: 'Classic Chicken Burger',          price:  89, category: 'Burgers',       itemCode: 'BRG01' },
      { name: 'Spicy Crispy Chicken Burger',     price: 109, category: 'Burgers',       itemCode: 'BRG02' },
      { name: 'Double Decker Burger',            price: 149, category: 'Burgers',       itemCode: 'BRG03' },
      { name: 'Veg Aloo Tikki Burger',           price:  69, category: 'Burgers',       itemCode: 'BRG04' },
      { name: 'Paneer Zinger Burger',            price:  99, category: 'Burgers',       itemCode: 'BRG05' },
      // Fried Chicken
      { name: 'Crispy Fried Chicken (2 pcs)',    price: 129, category: 'Fried Chicken', itemCode: 'FRC01' },
      { name: 'Crispy Fried Chicken (4 pcs)',    price: 229, category: 'Fried Chicken', itemCode: 'FRC02' },
      { name: 'Fried Chicken Bucket (8 pcs)',    price: 399, category: 'Fried Chicken', itemCode: 'FRC03' },
      { name: 'Hot Wings (6 pcs)',               price: 149, category: 'Fried Chicken', itemCode: 'FRC04' },
      { name: 'Hot Wings (12 pcs)',              price: 269, category: 'Fried Chicken', itemCode: 'FRC05' },
      // Wraps & Rolls
      { name: 'Chicken Wrap',                    price:  99, category: 'Wraps & Rolls', itemCode: 'WRP01' },
      { name: 'Paneer Wrap',                     price:  89, category: 'Wraps & Rolls', itemCode: 'WRP02' },
      { name: 'Chicken Tikka Roll',              price: 109, category: 'Wraps & Rolls', itemCode: 'WRP03' },
      // Sides
      { name: 'French Fries (Regular)',          price:  59, category: 'Sides',         itemCode: 'SDE01' },
      { name: 'French Fries (Large)',            price:  89, category: 'Sides',         itemCode: 'SDE02' },
      { name: 'Cheese Fries',                   price: 109, category: 'Sides',         itemCode: 'SDE03' },
      { name: 'Coleslaw',                       price:  39, category: 'Sides',         itemCode: 'SDE04' },
      { name: 'Garlic Bread (4 pcs)',            price:  69, category: 'Sides',         itemCode: 'SDE05' },
      // Beverages
      { name: 'Pepsi (300 ml)',                  price:  40, category: 'Beverages',     itemCode: 'BEV01' },
      { name: 'Pepsi (600 ml)',                  price:  60, category: 'Beverages',     itemCode: 'BEV02' },
      { name: 'Fresh Lime Soda',                price:  50, category: 'Beverages',     itemCode: 'BEV03' },
      { name: 'Mango Lassi',                    price:  70, category: 'Beverages',     itemCode: 'BEV04' },
      { name: 'Mineral Water',                  price:  20, category: 'Beverages',     itemCode: 'BEV05' }
    ];

    console.log('\nSeeding Menu Items...');
    for (const item of menuItems) {
      await Menu.findOneAndUpdate(
        { name: item.name },
        { price: item.price, category: item.category, isAvailable: true, itemCode: item.itemCode },
        { upsert: true, new: true }
      );
    }
    console.log(`  ${menuItems.length} menu items seeded`);

    // ── Seed Restaurant Settings ──────────────────────────────────────
    console.log('\nSeeding Restaurant Settings...');
    const restaurantSettings = {
      restaurantName:  'Mr. Pizza - Hot and Fresh',
      restaurantType:  'Pizza & Fast Food Restaurant',
      address:         'Proddatur, Andhra Pradesh',
      phone:           '6399911011',
      secondaryPhone:  '',
      whatsappNumber:  '6399911011',
      email:           'mrpizza@msbilling.com',
      gstin:           '',
      tagline:         'Taste the Best, Forget the Rest',
      socialHandle:    '@mr.pizza.proddatur'
    };
    await Setting.findOneAndUpdate(
      { key: 'restaurantSettings' },
      { value: restaurantSettings },
      { upsert: true, new: true }
    );
    console.log('  Restaurant settings seeded');

    await mongoose.disconnect();

    // ── Summary ───────────────────────────────────────────────────────
    console.log('\n========================================================');
    console.log('       MR. PIZZA PROVISIONED SUCCESSFULLY!               ');
    console.log('========================================================');
    console.log('  Shop Name   : Mr. Pizza - Hot and Fresh');
    console.log('  Location    : Proddatur, Andhra Pradesh');
    console.log('  Database    :', tenantDbName);
    console.log('--------------------------------------------------------');
    console.log('  LICENSE / SUPERADMIN PANEL LOGIN');
    console.log('  Email       :', email);
    console.log('  Password    :', password);
    console.log('  License Key :', licenseKey);
    console.log('  Plan        : Lifetime Premium');
    console.log('  Valid Until : Lifetime (2126)');
    console.log('--------------------------------------------------------');
    console.log('  POS LOGIN CREDENTIALS (all use same password)');
    console.log('  mrpizza   -> Admin');
    console.log('  admin     -> Admin');
    console.log('  cashier   -> Cashier');
    console.log('  captain   -> Captain');
    console.log('  Password  :', password);
    console.log('========================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Error provisioning Mr. Pizza account:', err);
    process.exit(1);
  }
}

seedMrPizza();
