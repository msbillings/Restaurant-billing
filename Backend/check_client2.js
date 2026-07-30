import mongoose from 'mongoose';
const URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
async function run() {
  const conn = await mongoose.createConnection(URI).asPromise();
  const Client = conn.model('Client', new mongoose.Schema({ email: String, plainTextPassword: String, status: String }, { strict: false }));
  const clients = await Client.find({});
  console.log('Clients:', clients.map(c => ({email: c.email, pass: c.plainTextPassword})));
  process.exit(0);
}
run();
