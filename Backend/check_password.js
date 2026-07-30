import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('client_test1_db');
    const user = await db.collection('users').findOne({ username: 'SHAFFU' });
    if (user) {
      console.log('User found. Password hash:', user.password);
      const isMatch = await bcrypt.compare('TestPass@1', user.password);
      console.log('Password match TestPass@1:', isMatch);
      const isMatch2 = await bcrypt.compare('admin123', user.password);
      console.log('Password match admin123:', isMatch2);
    } else {
      console.log('User not found');
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
