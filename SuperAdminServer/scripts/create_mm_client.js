import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI_SUPERADMIN = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
const MONGO_URI_CLIENT = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_mm_db?appName=Cluster0';

const clientSchema = new mongoose.Schema({
  restaurantName: String,
  ownerName: String,
  email: String,
  phone: String,
  plan: String,
  plainTextPassword: String,
  licenseKey: String,
  status: { type: String, default: 'Active' },
  databaseName: String,
  createdAt: { type: Date, default: Date.now }
});

const licenseSchema = new mongoose.Schema({
  key: String,
  client: mongoose.Schema.Types.ObjectId,
  plan: String,
  validUntil: Date,
  status: { type: String, default: 'active' }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Cashier', 'Captain'], default: 'Cashier' },
  activeSessions: []
}, { timestamps: true });

async function run() {
  try {
    console.log('1. Connecting to SuperAdmin DB...');
    const superAdminConn = await mongoose.createConnection(MONGO_URI_SUPERADMIN).asPromise();
    const Client = superAdminConn.model('Client', clientSchema);
    const License = superAdminConn.model('License', licenseSchema);

    const licenseKey = 'MSBILL-MM01-REST-2026';
    const databaseName = 'client_mm_db';

    // Remove old MM Client/License if any to ensure clean setup
    await Client.deleteMany({ $or: [{ restaurantName: /MM/i }, { email: 'info@mmrestaurant.com' }] });
    await License.deleteMany({ key: licenseKey });

    const client = new Client({
      restaurantName: 'MM Restaurant',
      ownerName: 'MM Owner',
      email: 'info@mmrestaurant.com',
      phone: '9876543211',
      plan: '1 Month Starter',
      plainTextPassword: 'MMrest@123',
      licenseKey: licenseKey,
      status: 'Active',
      databaseName: databaseName
    });
    await client.save();
    console.log('   [✓] Created Client: MM Restaurant in SuperAdmin DB');

    // Exactly 1 month from today (July 6, 2026 -> August 6, 2026)
    const validUntil = new Date('2026-08-06T23:59:59Z');
    const license = new License({
      key: licenseKey,
      client: client._id,
      plan: '1 Month Starter',
      validUntil: validUntil,
      status: 'active'
    });
    await license.save();
    console.log('   [✓] Created 1-Month License Key: ' + licenseKey + ' (Valid until Aug 6, 2026)');

    await superAdminConn.close();

    console.log('\n2. Connecting to Client Restaurant DB (' + databaseName + ')...');
    const clientConn = await mongoose.createConnection(MONGO_URI_CLIENT).asPromise();
    const User = clientConn.model('User', userSchema);

    // Clear old users in client_mm_db
    await User.deleteMany({});

    const usersToCreate = [
      { username: 'MM Restaurant', passwordPlain: 'MMrest@123', role: 'Admin' },
      { username: 'mm_admin', passwordPlain: 'mm_admin123', role: 'Admin' },
      { username: 'mm_cashier', passwordPlain: 'MMcash@123', role: 'Cashier' },
      { username: 'mm_captain', passwordPlain: 'MMcapt@123', role: 'Captain' }
    ];

    for (const u of usersToCreate) {
      const hashedPassword = await bcrypt.hash(u.passwordPlain, 10);
      const userDoc = new User({
        username: u.username,
        password: hashedPassword,
        role: u.role,
        activeSessions: []
      });
      await userDoc.save();
      console.log(`   [✓] Seeded Role [${u.role}] in client_mm_db: Username="${u.username}", Password="${u.passwordPlain}"`);
    }

    await clientConn.close();

    console.log('\n3. Syncing MM credentials into Cloud DB (mscurechain) for Mobile & Cloud Access...');
    const cloudConn = await mongoose.createConnection(MONGO_URI_SUPERADMIN).asPromise();
    const CloudUser = cloudConn.model('User', userSchema);
    for (const u of usersToCreate) {
      const hashedPassword = await bcrypt.hash(u.passwordPlain, 10);
      await CloudUser.updateOne(
        { username: u.username },
        { $set: { username: u.username, password: hashedPassword, role: u.role, activeSessions: [] } },
        { upsert: true }
      );
      console.log(`   [✓] Synced to Cloud DB: Username="${u.username}"`);
    }
    await cloudConn.close();

    console.log('\n========================================================');
    console.log('🎉 MM RESTAURANT (CLIENT ACCOUNT) SETUP COMPLETE 🎉');
    console.log('========================================================');
    console.log('🔑 LICENSE KEY:      ' + licenseKey);
    console.log('📅 PLAN / EXPIRY:    1 Month Starter (Valid until Aug 6, 2026)');
    console.log('🗄️ DATABASE NAME:    ' + databaseName);
    console.log('--------------------------------------------------------');
    console.log('👤 ADMIN ROLE (Option 1 - Main):');
    console.log('   • Username: MM Restaurant');
    console.log('   • Password: MMrest@123');
    console.log('--------------------------------------------------------');
    console.log('👤 ADMIN ROLE (Option 2 - Short):');
    console.log('   • Username: mm_admin');
    console.log('   • Password: mm_admin123');
    console.log('--------------------------------------------------------');
    console.log('🛒 CASHIER ROLE (POS / Billing Only):');
    console.log('   • Username: mm_cashier');
    console.log('   • Password: MMcash@123');
    console.log('--------------------------------------------------------');
    console.log('📱 CAPTAIN ROLE (Order Taking / Waiter Only):');
    console.log('   • Username: mm_captain');
    console.log('   • Password: MMcapt@123');
    console.log('========================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Error during setup:', err);
    process.exit(1);
  }
}

run();
