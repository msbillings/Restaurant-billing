import { MongoClient } from 'mongodb';
const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?retryWrites=true&w=majority";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('client_grandfeast_xyz');
    
    // Update Cashier
    await db.collection('users').updateOne(
      { role: 'Cashier' },
      { $set: { username: 'GrandFeast@1_cashier' } }
    );
    
    // Update Captain
    await db.collection('users').updateOne(
      { role: 'Captain' },
      { $set: { username: 'GrandFeast@1_captain' } }
    );
    
    console.log("Usernames updated successfully!");
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
