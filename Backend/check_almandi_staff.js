import mongoose from 'mongoose';
const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_almandi_db?appName=Cluster0';

async function main() {
  await mongoose.connect(uri);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  
  const users = await User.find({}).lean();
  console.log("Users in client_almandi_db:");
  users.forEach(u => console.log(`  - Username: ${u.username}, Role: ${u.role}`));
  
  await mongoose.disconnect();
}
main().catch(console.error);
