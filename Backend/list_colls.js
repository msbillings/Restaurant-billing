import mongoose from 'mongoose';
const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_maheer_123?appName=Cluster0';

async function main() {
  await mongoose.connect(uri);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections in client_maheer_123:");
  collections.forEach(c => console.log(c.name));
  await mongoose.disconnect();
}
main().catch(console.error);
