import mongoose from 'mongoose';
const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

async function listDBs() {
  await mongoose.connect(uri);
  const admin = mongoose.connection.db.admin();
  const dbs = await admin.listDatabases();
  console.log("Databases:");
  dbs.databases.forEach(db => console.log(db.name));
  mongoose.disconnect();
}
listDBs();
