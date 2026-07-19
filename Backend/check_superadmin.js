import { MongoClient } from 'mongodb';
const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?retryWrites=true&w=majority";
async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('mscurechain');
    const clients = await db.collection('clients').find({ email: 'Grandfeast@restaurant.com' }).toArray();
    console.log("Client data:", JSON.stringify(clients, null, 2));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
