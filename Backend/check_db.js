import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    
    // Check test1 db
    const db = client.db('client_test1_db');
    const users = await db.collection('users').find({}).toArray();
    
    console.log("Users in client_test1_db:", users.map(u => ({ username: u.username, role: u.role })));
    
    // Check demo db
    const demoDb = client.db('client_demo_db');
    const demoUsers = await demoDb.collection('users').find({}).toArray();
    console.log("Users in client_demo_db:", demoUsers.map(u => ({ username: u.username, role: u.role })));

  } finally {
    await client.close();
  }
}

run().catch(console.dir);
