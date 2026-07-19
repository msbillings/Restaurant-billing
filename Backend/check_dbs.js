import { MongoClient } from 'mongodb';
const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?retryWrites=true&w=majority";
async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const adminDb = client.db().admin();
    const result = await adminDb.command({ listDatabases: 1 });
    console.log("Total databases:", result.databases.length);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
