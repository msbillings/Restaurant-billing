import mongoose from 'mongoose';
const baseUri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net';

async function main() {
  const adminConn = await mongoose.createConnection(baseUri + '/admin?appName=Cluster0').asPromise();
  const adminDb = adminConn.db.admin();
  const dbs = await adminDb.listDatabases();
  await adminConn.close();

  for (const dbInfo of dbs.databases) {
    const dbName = dbInfo.name;
    if (dbName === 'admin' || dbName === 'local' || dbName === 'config') continue;
    
    try {
      const uri = `${baseUri}/${dbName}?appName=Cluster0`;
      const conn = await mongoose.createConnection(uri).asPromise();
      const MenuItem = conn.model('MenuItem', new mongoose.Schema({}, { strict: false }));
      
      const mandiItems = await MenuItem.find({ name: { $regex: /mandi/i } }).limit(1);
      if (mandiItems.length > 0) {
        const count = await MenuItem.countDocuments();
        console.log(`FOUND IN [${dbName}]: ${count} total items. (e.g. ${mandiItems[0].name})`);
      }
      await conn.close();
    } catch (e) {
      // ignore
    }
  }
}
main().catch(console.error);
