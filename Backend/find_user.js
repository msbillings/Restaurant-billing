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
      const User = conn.model('User', new mongoose.Schema({}, { strict: false }));
      
      const users = await User.find({ username: { $regex: /mandi/i } });
      if (users.length > 0) {
        console.log(`FOUND IN [${dbName}]:`);
        users.forEach(u => console.log('  - ' + u.username));
      }
      await conn.close();
    } catch (e) {
      // ignore
    }
  }
}
main().catch(console.error);
