const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_mm_db?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to client_mm_db");
  
  const UserSchema = new mongoose.Schema({
    username: String,
    role: String,
    activeSessions: Array
  }, { strict: false });
  const User = mongoose.model('User', UserSchema);
  
  const users = await User.find({});
  console.log("Users in MM DB:", users.map(u => ({ username: u.username, role: u.role, activeSessionsCount: u.activeSessions?.length })));
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
