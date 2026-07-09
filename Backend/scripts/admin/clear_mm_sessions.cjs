const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_mm_db?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to client_mm_db");
  
  const UserSchema = new mongoose.Schema({
    username: String,
    activeSessions: Array
  }, { strict: false });
  const User = mongoose.model('User', UserSchema);
  
  // Clear ALL stale sessions for all MM users
  const result = await User.updateMany({}, { $set: { activeSessions: [] } });
  console.log("Cleared all sessions:", result);
  
  // Verify
  const users = await User.find({});
  users.forEach(u => {
    console.log(`${u.username}: ${u.activeSessions?.length || 0} sessions`);
  });
  
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
