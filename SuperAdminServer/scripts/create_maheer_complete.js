import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI_SUPERADMIN = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
const MONGO_URI_RESTAURANT = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_maheer_db?appName=Cluster0';

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

    const licenseKey = 'MSBILL-MAH1-EER2-2026';
    const databaseName = 'client_maheer_db';

    // Remove old Maheer Client/License if any to ensure clean credentials
    await Client.deleteMany({ $or: [{ restaurantName: /Maheer/i }, { email: 'maheer@msbillings.com' }] });
    await License.deleteMany({ key: licenseKey });

    const client = new Client({
      restaurantName: 'Maheer Restaurant',
      ownerName: 'Maheer',
      email: 'maheer@msbillings.com',
      phone: '9876543210',
      plan: 'Lifetime Premium',
      plainTextPassword: 'Maheer@123',
      licenseKey: licenseKey,
      status: 'Active',
      databaseName: databaseName
    });
    await client.save();
    console.log('   [✓] Created Client: Maheer Restaurant in SuperAdmin DB');

    const validUntil = new Date('2126-07-06T23:59:59Z');
    const license = new License({
      key: licenseKey,
      client: client._id,
      plan: 'Lifetime Premium',
      validUntil: validUntil,
      status: 'active'
    });
    await license.save();
    console.log('   [✓] Created Lifetime License Key: ' + licenseKey);

    await superAdminConn.close();

    console.log('\n2. Connecting to Restaurant DB (' + databaseName + ')...');
    const restaurantConn = await mongoose.createConnection(MONGO_URI_RESTAURANT).asPromise();
    const User = restaurantConn.model('User', userSchema);

    // Clear old test users in client_maheer_db
    await User.deleteMany({});

    const usersToCreate = [
      { username: 'Maheer Restaurant', passwordPlain: 'Maheer@123', role: 'Admin' },
      { username: 'admin', passwordPlain: 'admin123', role: 'Admin' },
      { username: 'cashier', passwordPlain: 'cashier123', role: 'Cashier' },
      { username: 'captain', passwordPlain: 'captain123', role: 'Captain' }
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
      console.log(`   [✓] Seeded Role [${u.role}]: Username="${u.username}", Password="${u.passwordPlain}"`);
    }

    await restaurantConn.close();

    console.log('\n========================================================');
    console.log('🎉 MAHEER RESTAURANT SETUP & CREDENTIALS COMPLETE 🎉');
    console.log('========================================================');
    console.log('🔑 LICENSE KEY:      ' + licenseKey);
    console.log('📅 PLAN / EXPIRY:    Lifetime Premium (Valid until 2126)');
    console.log('🗄️ DATABASE NAME:    ' + databaseName);
    console.log('--------------------------------------------------------');
    console.log('👤 ADMIN ROLE (Option 1):');
    console.log('   • Username: Maheer Restaurant');
    console.log('   • Password: Maheer@123');
    console.log('--------------------------------------------------------');
    console.log('👤 ADMIN ROLE (Option 2):');
    console.log('   • Username: admin');
    console.log('   • Password: admin123');
    console.log('--------------------------------------------------------');
    console.log('🛒 CASHIER ROLE (POS / Billing):');
    console.log('   • Username: cashier');
    console.log('   • Password: cashier123');
    console.log('--------------------------------------------------------');
    console.log('📱 CAPTAIN ROLE (Order Taking / Waiter):');
    console.log('   • Username: captain');
    console.log('   • Password: captain123');
    console.log('========================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Error during setup:', err);
    process.exit(1);
  }
}

run();
