import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8']);

const test = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    const conn = mongoose.createConnection(uri);
    await conn.asPromise();

    const tenantDb = conn.useDb('test_db_creation');
    const usersCol = tenantDb.collection('users');
    
    console.log("Got usersCol, type:", typeof usersCol, typeof usersCol.updateOne);

    await usersCol.updateOne(
      { username: 'test@example.com' },
      { $set: { username: 'test@example.com' } },
      { upsert: true }
    );
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit();
  }
};
test();
