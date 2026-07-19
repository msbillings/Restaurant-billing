import { MongoClient } from 'mongodb';
const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?retryWrites=true&w=majority";
async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('mscurechain');
    const result = await db.collection('clients').updateOne(
      { email: 'Grandfeast@restaurant.com' },
      { $set: { databaseName: 'client_grandfeast_6a54bc' } }
    );
    console.log("Update result:", result);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
