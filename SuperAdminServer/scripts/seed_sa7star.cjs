require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superAdminUri = process.env.MONGODB_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
const tenantDbName = 'client_sa7starchickens_db';
const tenantUri = superAdminUri.replace('/mscurechain?', `/${tenantDbName}?`);

async function seedSA7StarChickens() {
  try {
    console.log('========================================================');
    console.log('   SA 7 STAR CHICKENS - CLIENT & TENANT PROVISIONING    ');
    console.log('========================================================');

    console.log('\n--- 1. Connecting to SuperAdmin DB (mscurechain) ---');
    await mongoose.connect(superAdminUri);

    // Schemas for SuperAdmin DB
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

    // Client Details & Credentials
    const restaurantName = 'SA 7 Star Chickens';
    const ownerName      = 'Ghouse Basha';
    const shopAddress    = 'Room No 5, Taiba Complex, Municipal Office Rd, Rameswaram, Proddatur, Andhra Pradesh 516360';
    const email          = 'sa7star@msbilling.com';
    const password       = 'Sa7star@2026';
    const licenseKey     = 'MSBILL-SA7STAR-PRODDATUR-2026';
    const validUntil     = new Date('2126-12-31T23:59:59Z'); // Lifetime 100-year validity

    const clientData = {
      restaurantName: restaurantName,
      ownerName: ownerName,
      email: email,
      plainTextPassword: password,
      licenseKey: licenseKey,
      status: 'Active',
      databaseName: tenantDbName,
      hardwareId: null, // Exempt from HWID lock
      plan: 'Lifetime Premium',
      location: {
        address: shopAddress,
        city: 'Proddatur',
        postalCode: '516360',
        region: 'Andhra Pradesh',
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
        { role: 'Admin',   username: email,         plainTextPassword: password },
        { role: 'Admin',   username: 'sa7star',      plainTextPassword: password },
        { role: 'Admin',   username: 'ghousebasha',  plainTextPassword: password },
        { role: 'Admin',   username: 'admin',        plainTextPassword: password },
        { role: 'Cashier', username: 'cashier',      plainTextPassword: password },
        { role: 'Captain', username: 'captain',      plainTextPassword: password }
      ]
    };

    let client = await Client.findOne({ email });
    if (!client) {
      console.log(`Creating new Client for "${restaurantName}" in SuperAdmin DB...`);
      client = new Client(clientData);
      await client.save();
      console.log('✅ Client created in SuperAdmin DB!');
    } else {
      console.log(`Updating existing Client for "${restaurantName}" in SuperAdmin DB...`);
      Object.assign(client, clientData);
      await client.save();
      console.log('✅ Client updated in SuperAdmin DB!');
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
      console.log('✅ License created in SuperAdmin DB!');
    } else {
      license.key        = licenseKey;
      license.plan       = 'Lifetime Premium';
      license.validUntil = validUntil;
      license.status     = 'active';
      await license.save();
      console.log('✅ License updated in SuperAdmin DB!');
    }

    await mongoose.disconnect();

    // ── 2. Seed Tenant (POS) Database ─────────────────────────────────
    console.log(`\n--- 2. Connecting to Tenant DB (${tenantDbName}) ---`);
    await mongoose.connect(tenantUri);
    const db = mongoose.connection;

    // Tenant Schemas
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

    // 2.1 Seed Users
    const usersToSeed = [
      { username: email,         password: password, role: 'Admin'   },
      { username: 'sa7star',      password: password, role: 'Admin'   },
      { username: 'ghousebasha',  password: password, role: 'Admin'   },
      { username: 'admin',        password: password, role: 'Admin'   },
      { username: 'cashier',      password: password, role: 'Cashier' },
      { username: 'captain',      password: password, role: 'Captain' }
    ];

    console.log('\nSeeding POS Users in Tenant DB...');
    for (const u of usersToSeed) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await User.findOneAndUpdate(
        { username: u.username },
        { password: hashedPassword, role: u.role, activeSessions: [] },
        { upsert: true, new: true }
      );
      console.log(`  User "${u.username}" (${u.role}) ready`);
    }

    // 2.2 Seed Restaurant Settings
    console.log('\nSeeding Restaurant Settings in Tenant DB...');
    const restaurantSettings = {
      restaurantName:  restaurantName,
      restaurantType:  'Fresh Chicken & Poultry Mart',
      ownerName:       ownerName,
      address:         shopAddress,
      city:            'Proddatur',
      pincode:         '516360',
      phone:           '',
      whatsappNumber:  '',
      secondaryPhone:  '',
      email:           email,
      gstin:           '',
      fssai:           '',
      upiId:           '',
      ownerPin:        '',
      footerMessage:   '*** THANK YOU FOR CHOOSING SA 7 STAR CHICKENS! VISIT AGAIN ***',
      kotPrinter:      '',
      billingPrinter:  '',
      silentPrinting:  true,
      enableQrPayment: false,
      enableCgst:      false,
      cgstRate:        0,
      enableSgst:      false,
      sgstRate:        0,
      enableGst:       false,
      gstRate:         0,
      logo:            '',
      printFormat:     '80mm'
    };

    await Setting.findOneAndUpdate(
      { key: 'restaurantSettings' },
      { value: restaurantSettings },
      { upsert: true, new: true }
    );
    console.log('✅ Restaurant settings seeded successfully');

    // 2.3 Seed License Expiry in Tenant Settings
    await Setting.findOneAndUpdate(
      { key: 'licenseExpiry' },
      { value: validUntil.toISOString() },
      { upsert: true, new: true }
    );

    // 2.4 Seed Chicken Categories & Starter Products
    console.log('\nSeeding Chicken Categories and Menu Items...');
    const CategorySchema = new mongoose.Schema({
      name: { type: String, required: true, unique: true },
      description: String,
      color: String
    });
    const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

    const MenuSchema = new mongoose.Schema({
      name: { type: String, required: true },
      price: { type: Number, required: true },
      category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
      type: { type: String, default: 'non-veg' },
      description: String,
      isAvailable: { type: Boolean, default: true },
      isFavorite: { type: Boolean, default: false },
      taxRate: { type: Number, default: 0 }
    }, { timestamps: true });
    const Menu = mongoose.models.Menu || mongoose.model('Menu', MenuSchema);

    const categoriesData = [
      { name: 'Fresh Broiler Chicken', color: '#EF4444', description: 'Daily fresh cut broiler chicken' },
      { name: 'Boneless & Cuts',       color: '#F97316', description: 'Tender boneless chicken & prime cuts' },
      { name: 'Country Chicken (Natu Kodi)', color: '#84CC16', description: 'Traditional healthy country chicken' },
      { name: 'Special Organs',        color: '#A855F7', description: 'Liver, gizzard and special parts' },
      { name: 'Eggs & Tray Packs',     color: '#EAB308', description: 'Fresh farm & country eggs' },
      { name: 'Marinated Specials',    color: '#06B6D4', description: 'Ready-to-cook spiced chicken cuts' }
    ];

    const categoryMap = {};
    for (const cat of categoriesData) {
      const savedCat = await Category.findOneAndUpdate(
        { name: cat.name },
        { name: cat.name, description: cat.description, color: cat.color },
        { upsert: true, new: true }
      );
      categoryMap[cat.name] = savedCat._id;
    }

    const initialMenuItems = [
      // Fresh Broiler Chicken
      { name: 'Broiler Chicken - Skin Out (1 Kg)',    price: 240, categoryName: 'Fresh Broiler Chicken', description: 'Freshly dressed tender chicken without skin' },
      { name: 'Broiler Chicken - Skin Out (500g)',    price: 120, categoryName: 'Fresh Broiler Chicken', description: 'Freshly dressed tender chicken without skin' },
      { name: 'Broiler Chicken - With Skin (1 Kg)',   price: 220, categoryName: 'Fresh Broiler Chicken', description: 'Fresh dressed chicken with cleaned skin' },
      { name: 'Chicken Curry Cut (1 Kg)',             price: 240, categoryName: 'Fresh Broiler Chicken', description: 'Medium cut chicken pieces ideal for curries' },
      { name: 'Chicken Biryani Cut (1 Kg)',           price: 260, categoryName: 'Fresh Broiler Chicken', description: 'Large juicy cuts ideal for dum biryani' },
      { name: 'Whole Dressed Chicken (Live Wt/Kg)',   price: 160, categoryName: 'Fresh Broiler Chicken', description: 'Whole live bird weighed and dressed' },

      // Boneless & Cuts
      { name: 'Chicken Breast Boneless (1 Kg)',       price: 380, categoryName: 'Boneless & Cuts', description: 'Pure lean boneless breast fillet' },
      { name: 'Chicken Breast Boneless (500g)',       price: 190, categoryName: 'Boneless & Cuts', description: 'Pure lean boneless breast fillet' },
      { name: 'Chicken Boneless Curry Cut (1 Kg)',    price: 360, categoryName: 'Boneless & Cuts', description: 'Bite-sized boneless chicken cubes' },
      { name: 'Chicken Drumsticks / Leg Pieces (1 Kg)', price: 320, categoryName: 'Boneless & Cuts', description: 'Juicy whole chicken drumsticks' },
      { name: 'Chicken Lollipop Cut / Wings (1 Kg)',  price: 280, categoryName: 'Boneless & Cuts', description: 'Cleaned wings and lollipop cuts' },
      { name: 'Chicken Keema / Minced (1 Kg)',        price: 400, categoryName: 'Boneless & Cuts', description: 'Freshly minced fine chicken meat' },
      { name: 'Chicken Keema / Minced (500g)',        price: 200, categoryName: 'Boneless & Cuts', description: 'Freshly minced fine chicken meat' },

      // Country Chicken (Natu Kodi)
      { name: 'Country Chicken / Natu Kodi (1 Kg)',   price: 550, categoryName: 'Country Chicken (Natu Kodi)', description: 'Authentic free-range country chicken' },
      { name: 'Country Chicken / Natu Kodi (500g)',   price: 280, categoryName: 'Country Chicken (Natu Kodi)', description: 'Authentic free-range country chicken' },
      { name: 'Live Natu Kodi (Per Kg Live Weight)',  price: 380, categoryName: 'Country Chicken (Natu Kodi)', description: 'Live country bird weighed and dressed' },

      // Special Organs
      { name: 'Chicken Liver (500g)',                 price: 100, categoryName: 'Special Organs', description: 'Fresh and cleaned tender chicken liver' },
      { name: 'Chicken Gizzard / Pota (500g)',        price: 100, categoryName: 'Special Organs', description: 'Cleaned and washed chicken gizzard' },
      { name: 'Chicken Liver & Gizzard Mix (500g)',   price: 100, categoryName: 'Special Organs', description: 'Combined mix of liver and gizzard' },

      // Eggs
      { name: 'Farm White Eggs (Tray - 30 Pcs)',      price: 180, categoryName: 'Eggs & Tray Packs', description: 'Full crate of 30 fresh farm eggs' },
      { name: 'Farm White Eggs (12 Pcs Pack)',        price: 75,  categoryName: 'Eggs & Tray Packs', description: 'Carton of 12 fresh farm eggs' },
      { name: 'Farm White Eggs (6 Pcs Pack)',         price: 40,  categoryName: 'Eggs & Tray Packs', description: 'Pack of 6 fresh farm eggs' },
      { name: 'Country Chicken Eggs (Pack of 6)',     price: 70,  categoryName: 'Eggs & Tray Packs', description: 'Desi / Natu Kodi pure eggs' },

      // Marinated
      { name: 'Marinated Chicken 65 (500g)',          price: 220, categoryName: 'Marinated Specials', description: 'Ready to fry spiced chicken 65 marinade' },
      { name: 'Marinated Pepper Chicken (500g)',      price: 230, categoryName: 'Marinated Specials', description: 'South Indian black pepper spiced chicken marinade' },
      { name: 'Marinated Tandoori Chicken (500g)',    price: 230, categoryName: 'Marinated Specials', description: 'Rich yogurt and red masala marinade' }
    ];

    for (const item of initialMenuItems) {
      const categoryId = categoryMap[item.categoryName];
      await Menu.findOneAndUpdate(
        { name: item.name },
        {
          name: item.name,
          price: item.price,
          category: categoryId,
          type: 'non-veg',
          description: item.description,
          isAvailable: true,
          isFavorite: false,
          taxRate: 0
        },
        { upsert: true, new: true }
      );
    }
    console.log(`✅ Seeded ${initialMenuItems.length} starter chicken items across ${categoriesData.length} categories`);

    await mongoose.disconnect();

    // ── 3. Final Summary Display ───────────────────────────────────────
    console.log('\n========================================================');
    console.log('       SA 7 STAR CHICKENS PROVISIONED SUCCESSFULLY!     ');
    console.log('========================================================');
    console.log('  Shop Name      : SA 7 Star Chickens');
    console.log('  Owner Name     : Ghouse Basha');
    console.log('  Address        : Room No 5, Taiba Complex, Municipal Office Rd,');
    console.log('                   Rameswaram, Proddatur, Andhra Pradesh 516360');
    console.log('  Database Name  :', tenantDbName);
    console.log('--------------------------------------------------------');
    console.log('  1. TERMINAL / SOFTWARE ACTIVATION CREDENTIALS');
    console.log('     Email       :', email);
    console.log('     Password    :', password);
    console.log('     License Key :', licenseKey);
    console.log('     Plan        : Lifetime Premium');
    console.log('     Valid Until : Lifetime (Year 2126)');
    console.log('--------------------------------------------------------');
    console.log('  2. POS BILLING LOGIN (all use password: ' + password + ')');
    console.log('     sa7star     -> Admin');
    console.log('     ghousebasha -> Admin');
    console.log('     ' + email + ' -> Admin');
    console.log('     admin       -> Admin');
    console.log('     cashier     -> Cashier');
    console.log('     captain     -> Captain');
    console.log('========================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error provisioning SA 7 Star Chickens account:', err);
    process.exit(1);
  }
}

seedSA7StarChickens();
