import mongoose from 'mongoose';

const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

async function run() {
  const conn = await mongoose.createConnection(uri).asPromise();
  const admin = conn.db.admin();
  const dbs = await admin.listDatabases();
  
  let deleted = 0;
  for (const dbInfo of dbs.databases) {
    if (dbInfo.name.startsWith('client_') && dbInfo.name !== 'client_grandfeast_xyz') {
      const db = conn.useDb(dbInfo.name);
      const bills = await db.collection('bills').countDocuments();
      if (bills === 0) {
        console.log('Dropping empty test DB:', dbInfo.name);
        await db.dropDatabase();
        deleted++;
      }
    }
  }
  console.log(`Deleted ${deleted} empty databases.`);
  process.exit(0);
}
run();
