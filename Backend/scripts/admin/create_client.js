import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SUPERADMIN_URI = 'mongodb://narasimhaDln:728803Dln%40@ac-oooc0og-shard-00-00.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-01.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-02.btqf66f.mongodb.net:27017/superadmin?ssl=true&authSource=admin&replicaSet=atlas-4ixmxj-shard-0';
const RESTAURANT_URI = 'mongodb://narasimhaDln:728803Dln%40@ac-oooc0og-shard-00-00.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-01.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-02.btqf66f.mongodb.net:27017/restaurantbilling?ssl=true&authSource=admin&replicaSet=atlas-4ixmxj-shard-0';

const clientSchema = new mongoose.Schema({
  restaurantName: String,
  ownerName: String,
  email: String,
  plainTextPassword: String,
  licenseKey: String,
  hardwareId: String,
  status: { type: String, default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  username: String,
  passwordHash: String,
  role: { type: String, default: 'Admin' },
  activeSessions: [{
    deviceId: String,
    deviceInfo: String,
    accessToken: String,
    refreshToken: String,
    lastActive: Date
  }]
});

async function run() {
  try {
    // 1. Create in SuperAdmin Database
    console.log('Connecting to SuperAdmin DB...');
    const superAdminConn = await mongoose.createConnection(SUPERADMIN_URI).asPromise();
    const Client = superAdminConn.model('Client', clientSchema);
    
    // Check if client exists
    let client = await Client.findOne({ restaurantName: 'Al Mandi 29' });
    if (!client) {
      client = new Client({
        restaurantName: 'Al Mandi 29',
        ownerName: 'Al Mandi 29 Owner',
        email: 'almandi29@example.com',
        plainTextPassword: '786786'
      });
      await client.save();
      console.log('Created Client in SuperAdmin DB!');
    } else {
      console.log('Client already exists in SuperAdmin DB.');
    }
    await superAdminConn.close();

    // 2. Create in Restaurant Database
    console.log('Connecting to Restaurant DB...');
    const restaurantConn = await mongoose.createConnection(RESTAURANT_URI).asPromise();
    const User = restaurantConn.model('User', userSchema);
    
    let user = await User.findOne({ username: 'Al Mandi 29' });
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('786786', salt);
      user = new User({
        username: 'Al Mandi 29',
        passwordHash,
        role: 'Admin',
        activeSessions: []
      });
      await user.save();
      console.log('Created User in Restaurant DB!');
    } else {
      console.log('User already exists in Restaurant DB.');
    }
    await restaurantConn.close();
    
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
