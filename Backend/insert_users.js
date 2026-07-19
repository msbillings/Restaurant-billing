import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?retryWrites=true&w=majority";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('client_grandfeast_6a54bc');
    
    const cashierPasswordHash = await bcrypt.hash('GrandCashier@1', 10);
    const captainPasswordHash = await bcrypt.hash('GrandCaptain@1', 10);
    
    // Insert Cashier
    await db.collection('users').insertOne({
      username: 'GrandFeast@1_cashier',
      password: cashierPasswordHash,
      role: 'Cashier',
      createdAt: new Date(),
      updatedAt: new Date(),
      activeSessions: []
    });
    
    // Insert Captain
    await db.collection('users').insertOne({
      username: 'GrandFeast@1_captain',
      password: captainPasswordHash,
      role: 'Captain',
      createdAt: new Date(),
      updatedAt: new Date(),
      activeSessions: []
    });
    
    console.log("Users inserted successfully!");
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
