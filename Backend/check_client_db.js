import { MongoClient } from 'mongodb';
const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?retryWrites=true&w=majority";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('mscurechain');
    const clients = await db.collection('clients').find({}).toArray();
    console.log(clients.map(c => ({ name: c.restaurantName, dbName: c.databaseName, id: c._id })));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
