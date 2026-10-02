import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8']);

const cleanUp = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    const conn = mongoose.createConnection(uri);
    await conn.asPromise();

    const dbsToDrop = [
      'client_test1_db',
      'client_test2_db',
      'client_test3_db',
      'client_test4_db',
      'client_rameshrestaurant_6abd1b', // Delete this so we can test again
      'test'
    ];

    let dropped = 0;
    for (const dbName of dbsToDrop) {
      try {
        console.log(`Dropping test database: ${dbName}...`);
        const targetDb = conn.useDb(dbName);
        await targetDb.dropDatabase();
        dropped++;
      } catch (e) {
        console.error(`Failed to drop ${dbName}`, e);
      }
    }
    
    const mscurechain = conn.useDb('mscurechain');
    const clientsCol = mscurechain.collection('clients');
    const licensesCol = mscurechain.collection('licenses');
    
    await clientsCol.deleteMany({ databaseName: { $in: dbsToDrop } });
    
    console.log(`Successfully freed up collections from ${dropped} test databases!`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
};
cleanUp();
