import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_demo_db?appName=Cluster0';

async function run() {
  try {
    const conn = await mongoose.createConnection(URI).asPromise();
    const User = conn.model('User', new mongoose.Schema({
      username: String,
      password: String, // using 'password' now
      role: { type: String, default: 'Admin' },
      activeSessions: Array
    }));
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('demo123', salt);
    
    // Clear existing users 
    await User.deleteMany({});
    
    // Create new test user
    const user = new User({
      username: 'DemoAdmin',
      password: passwordHash, // CORRECT FIELD NAME
      role: 'Admin',
      activeSessions: []
    });
    
    await user.save();
    console.log('Successfully seeded DemoAdmin in client_demo_db with correct field');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
