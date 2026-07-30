const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?appName=Cluster0";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log("Databases:");
    dbs.databases.forEach(db => console.log(` - ${db.name}`));
    
    // Check if there is a 'superadmin' database or 'mscurechain' database containing clients
    for (let db of dbs.databases) {
      if (db.name.toLowerCase().includes('admin') || db.name.toLowerCase().includes('super')) {
        const collections = await client.db(db.name).listCollections().toArray();
        console.log(`\nCollections in ${db.name}:`);
        collections.forEach(col => console.log(` - ${col.name}`));
      }
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
