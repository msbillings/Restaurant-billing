import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(URI);
  
  // Connect to tenant DB
  const tenantConn = mongoose.connection.useDb('client_test1_db');
  const User = tenantConn.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({});
  console.log("Users in client_test1_db:");
  users.forEach(u => console.log('Username:', u.get('username') || u.get('name'), 'Role:', u.get('role'), 'Password:', u.get('password')));
  process.exit(0);
}
run().catch(console.error);
