import mongoose from 'mongoose';
const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_maheer_123?appName=Cluster0';

async function main() {
  await mongoose.connect(uri);
  const Cat = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));
  
  const count = await Cat.countDocuments();
  console.log(`Found ${count} items in 'categories' collection.`);
  
  await mongoose.disconnect();
}
main().catch(console.error);
