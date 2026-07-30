import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

// Schemas
const ClientSchema = new mongoose.Schema({}, { strict: false });
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'Cashier' },
  activeSessions: []
});
UserSchema.pre('save', async function() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});
const LicenseSchema = new mongoose.Schema({}, { strict: false });
const StaffSchema = new mongoose.Schema({}, { strict: false });

async function provisionAlMandi() {
  await mongoose.connect(MONGO_URI);
  const Client = mongoose.model('Client', ClientSchema);
  const License = mongoose.model('License', LicenseSchema);

  const c = {
    name: 'Al Mandi Palace',
    owner: 'Al Mandi Admin',
    email: 'admin@almandi.com',
    pass: 'almandi123',
    db: 'client_almandi_db',
    license: 'ALMANDI-PALACE-2026',
    staff: [
      { role: 'Captain', username: 'captain_mandi' },
      { role: 'Cashier', username: 'cashier_mandi' }
    ]
  };

  console.log(`Provisioning ${c.name}...`);
  
  let clientDoc = await Client.findOne({ email: c.email });
  if (clientDoc) {
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
    status: 'Active',
    plan: 'Premium',
    staffAccounts: c.staff.map(s => ({
      role: s.role,
      username: s.username,
      plainTextPassword: c.pass
    }))
  });

  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  await License.create({
    key: c.license,
    client: clientDoc._id,
    plan: 'Premium',
    validUntil,
    status: 'Active'
  });

  const tenantUri = MONGO_URI.replace('/mscurechain?', `/${c.db}?`);
  const tenantConn = await mongoose.createConnection(tenantUri).asPromise();
  const User = tenantConn.model('User', UserSchema);
  const Staff = tenantConn.model('Staff', StaffSchema);

  await User.deleteMany({});
  await Staff.deleteMany({});

  await User.create({ username: c.email, password: c.pass, role: 'Admin' });
  for (const s of c.staff) {
    await User.create({ username: s.username, password: c.pass, role: s.role });
  }

  console.log('Successfully provisioned Al Mandi Palace!');
  tenantConn.close();
  mongoose.disconnect();
}
provisionAlMandi();
