import mongoose from 'mongoose';
const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_maheer_123?appName=Cluster0';

async function main() {
  await mongoose.connect(uri);
  const Menu = mongoose.model('Menu', new mongoose.Schema({}, { strict: false }));
  
  const count = await Menu.countDocuments();
  console.log(`Found ${count} items in 'menus' collection.`);
  
  await mongoose.disconnect();
}
main().catch(console.error);
