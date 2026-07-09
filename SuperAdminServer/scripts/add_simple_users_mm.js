import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGO_URI_SUPERADMIN = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
const MONGO_URI_CLIENT = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_mm_db?appName=Cluster0';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Cashier', 'Captain'], default: 'Cashier' },
  activeSessions: []
}, { timestamps: true });

async function run() {
  try {
    const usersToAdd = [
      { username: 'cashier', passwordPlain: 'cashier123', role: 'Cashier' },
      { username: 'captain', passwordPlain: 'captain123', role: 'Captain' },
      { username: 'admin', passwordPlain: 'admin123', role: 'Admin' }
    ];

    console.log('1. Adding simple users to client_mm_db...');
    const clientConn = await mongoose.createConnection(MONGO_URI_CLIENT).asPromise();
    const ClientUser = clientConn.model('User', userSchema);
    for (const u of usersToAdd) {
      const hashedPassword = await bcrypt.hash(u.passwordPlain, 10);
      await ClientUser.updateOne(
        { username: u.username },
        { $set: { username: u.username, password: hashedPassword, role: u.role, activeSessions: [] } },
        { upsert: true }
      );
      console.log(`   [✓] Added to client_mm_db: Username="${u.username}", Password="${u.passwordPlain}", Role="${u.role}"`);
    }
    await clientConn.close();

    console.log('2. Adding simple users to mscurechain (Cloud DB)...');
    const cloudConn = await mongoose.createConnection(MONGO_URI_SUPERADMIN).asPromise();
    const CloudUser = cloudConn.model('User', userSchema);
    for (const u of usersToAdd) {
      const hashedPassword = await bcrypt.hash(u.passwordPlain, 10);
      await CloudUser.updateOne(
        { username: u.username },
        { $set: { username: u.username, password: hashedPassword, role: u.role, activeSessions: [] } },
        { upsert: true }
      );
      console.log(`   [✓] Added to mscurechain: Username="${u.username}", Password="${u.passwordPlain}", Role="${u.role}"`);
    }
    await cloudConn.close();

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
