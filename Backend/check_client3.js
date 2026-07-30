import mongoose from 'mongoose';
const URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
async function run() {
  const conn = await mongoose.createConnection(URI).asPromise();
  const Client = conn.model('Client', new mongoose.Schema({ email: String, databaseName: String }, { strict: false }));
  const client = await Client.findOne({ email: 'admin@almandi.com' });
  console.log('Database:', client ? client.databaseName : 'not found');
  
  if (client && client.databaseName) {
    const restoConn = await mongoose.createConnection(`mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/${client.databaseName}?appName=Cluster0`).asPromise();
    const User = restoConn.model('User', new mongoose.Schema({ username: String, role: String }));
    const users = await User.find({});
    console.log('Users in resto DB:', users);
  }
  process.exit(0);
}
run();
