import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';

const MONGO_URI_SUPERADMIN = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

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

async function createRestaurant(index) {
    const superAdminConn = await mongoose.createConnection(MONGO_URI_SUPERADMIN).asPromise();
    const Client = superAdminConn.model('Client', clientSchema);
    const License = superAdminConn.model('License', licenseSchema);
    const CloudUser = superAdminConn.model('User', userSchema);

    const email = `test${index}@restaurant.com`;
    const password = `TestPass@${index}`;
    const restName = `Test Restaurant ${index}`;

    // Clean up if exists
    await Client.deleteMany({ email });

    const generateKeySegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    const licenseKey = `MSBILL-${generateKeySegment()}-${generateKeySegment()}-${generateKeySegment()}`;
    const databaseName = `client_test${index}_db`;

    const client = new Client({
      restaurantName: restName,
      ownerName: `Owner ${index}`,
      email: email,
      phone: `98765432${index.toString().padStart(2, '0')}`,
      plan: 'Lifetime Premium',
      plainTextPassword: password,
      licenseKey: licenseKey,
      status: 'Active',
      databaseName: databaseName
    });
    await client.save();

    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 100);

    const license = new License({
      key: licenseKey,
      client: client._id,
      plan: 'Lifetime Premium',
      validUntil: validUntil,
      status: 'active'
    });
    await license.save();

    const MONGO_URI_CLIENT = `mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/${databaseName}?appName=Cluster0`;
    const clientConn = await mongoose.createConnection(MONGO_URI_CLIENT).asPromise();
    const User = clientConn.model('User', userSchema);

    await User.deleteMany({});
    
    // Create Users
    const roles = [
      { username: `admin${index}`, role: 'Admin', password: password },
      { username: `cashier${index}`, role: 'Cashier', password: `CashierPass@${index}` },
      { username: `captain${index}`, role: 'Captain', password: `CaptainPass@${index}` }
    ];

    for (let u of roles) {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        const userDoc = new User({
            username: u.username,
            password: hashedPassword,
            role: u.role,
            activeSessions: []
        });
        await userDoc.save();

        await CloudUser.updateOne(
            { username: u.username },
            { $set: { username: u.username, password: hashedPassword, role: u.role, activeSessions: [] } },
            { upsert: true }
        );
    }

    await clientConn.close();
    await superAdminConn.close();

    return {
        restaurantName: restName,
        email: email,
        password: password,
        licenseKey: licenseKey,
        users: roles
    };
}

async function run() {
    console.log("Starting generation...");
    const results = [];
    for (let i = 1; i <= 10; i++) {
        const res = await createRestaurant(i);
        results.push(res);
        console.log(`Created ${i}/10: ${res.restaurantName}`);
    }
    
    fs.writeFileSync('10_restaurants_with_roles.json', JSON.stringify(results, null, 2));
    console.log("Done!");
    process.exit(0);
}

run();
