import { MongoClient } from 'mongodb';
const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?retryWrites=true&w=majority";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('client_grandfeast_xyz');
    const users = await db.collection('users').find({}).toArray();
    console.log(users.map(u => ({ username: u.username, role: u.role, passwordLength: u.password.length })));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
