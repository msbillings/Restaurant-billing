import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_almandi_db?appName=Cluster0';

async function run() {
  try {
    const conn = await mongoose.createConnection(URI).asPromise();
    const User = conn.model('User', new mongoose.Schema({
      username: String,
      password: String, // Note: Schema uses 'password' here, not 'passwordHash' in client_almandi_db
      role: { type: String, default: 'Admin' },
      activeSessions: Array
    }));
    
    // Check if test user already exists
    let testUser = await User.findOne({ username: 'ms_test_admin' });
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('test_password123', salt);
    
    if (testUser) {
      testUser.password = passwordHash;
      await testUser.save();
    } else {
      testUser = new User({
        username: 'ms_test_admin',
        password: passwordHash,
        role: 'Admin',
        activeSessions: []
      });
      await testUser.save();
    }
    
    console.log('Successfully seeded ms_test_admin in client_almandi_db');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
