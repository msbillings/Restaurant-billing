import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Define schemas explicitly for the script
const ClientSchema = new mongoose.Schema({
  restaurantName: String,
  ownerName: String,
  email: String,
  plainTextPassword: String,
  databaseName: String,
  staffAccounts: Array,
  licenseKey: String,
  hardwareId: { type: String, default: null },
  status: { type: String, default: 'Active' }
}, { timestamps: true });

const LicenseSchema = new mongoose.Schema({
  key: String,
  client: mongoose.Schema.Types.ObjectId,
  plan: String,
  validUntil: Date,
  status: String
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Cashier', 'Captain'], default: 'Cashier' },
  activeSessions: Array
}, { timestamps: true });

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

const StaffSchema = new mongoose.Schema({
  name: String,
  role: String,
  pin: String,
  status: { type: String, default: 'Active' }
}, { timestamps: true });

// Data
const clients = [
  {
    name: 'Star Chicken',
    owner: 'Star Owner',
    email: 'admin@starchicken.com',
    pass: 'starchicken',
    db: 'starchicken_db',
    license: 'STAR-CHICKEN-2026',
    staff: [
      { role: 'Captain', username: 'captain_star' },
      { role: 'Cashier', username: 'cashier_star' }
    ],
    waiter: { name: 'Rahul', pin: '1111' }
  },
  {
    name: 'Waffles Restaurant',
    owner: 'Waffle Owner',
    email: 'admin@waffles.com',
    pass: 'waffles',
    db: 'waffles_db',
    license: 'WAFFLES-REST-2026',
    staff: [
      { role: 'Captain', username: 'captain_waffle' },
      { role: 'Cashier', username: 'cashier_waffle' }
    ],
    waiter: { name: 'Suresh', pin: '2222' }
  }
];

async function run() {
  const MONGO_URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
  
  console.log('Connecting to SuperAdmin DB...');
  const adminConn = await mongoose.createConnection(MONGO_URI).asPromise();
  const Client = adminConn.model('Client', ClientSchema);
  const License = adminConn.model('License', LicenseSchema);

  for (const c of clients) {
    console.log(`\nProvisioning ${c.name}...`);
    
    // 1. Create Client
    let clientDoc = await Client.findOne({ email: c.email });
    if (clientDoc) {
      console.log('Client already exists, deleting old record for fresh start...');
      await Client.deleteOne({ _id: clientDoc._id });
      await License.deleteOne({ client: clientDoc._id });
    }

    clientDoc = await Client.create({
      restaurantName: c.name,
      ownerName: c.owner,
      email: c.email,
      plainTextPassword: c.pass,
      databaseName: c.db,
      licenseKey: c.license,
      staffAccounts: c.staff.map(s => ({
        role: s.role,
        username: s.username,
        plainTextPassword: c.pass
      }))
    });

    // 2. Create License (1 year)
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);
    await License.create({
      key: c.license,
      client: clientDoc._id,
      plan: 'Premium',
      validUntil,
      status: 'Active'
    });

    // 3. Connect to Tenant DB
    console.log(`Connecting to Tenant DB: ${c.db}...`);
    const tenantUri = MONGO_URI.replace('/mscurechain?', `/${c.db}?`);
    const tenantConn = await mongoose.createConnection(tenantUri).asPromise();
    const User = tenantConn.model('User', UserSchema);
    const Staff = tenantConn.model('Staff', StaffSchema);

    // Clear old users/staff
    await User.deleteMany({});
    await Staff.deleteMany({});

    // 4. Create Tenant Admin
    await User.create({
      username: c.email,
      password: c.pass,
      role: 'Admin'
    });

    // 5. Create Captain & Cashier
    for (const s of c.staff) {
      await User.create({
        username: s.username,
        password: c.pass,
        role: s.role
      });
    }

    // 6. Create Staff (for PIN)
    await Staff.create({
      name: c.waiter.name,
      role: 'Waiter',
      pin: c.waiter.pin
    });

    await tenantConn.close();
    console.log(`✅ ${c.name} provisioned successfully!`);
  }

  await adminConn.close();
  console.log('\nAll done! Exiting...');
  process.exit(0);
}

run().catch(console.error);
