import mongoose from 'mongoose';
const URI = 'mongodb://narasimhaDln:728803Dln%40@ac-oooc0og-shard-00-00.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-01.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-02.btqf66f.mongodb.net:27017/superadmin?ssl=true&authSource=admin&replicaSet=atlas-4ixmxj-shard-0';
async function run() {
  const conn = await mongoose.createConnection(URI).asPromise();
  const Client = conn.model('Client', new mongoose.Schema({ email: String, plainTextPassword: String, status: String }, { strict: false }));
  const clients = await Client.find({ email: 'almandi29@example.com' });
  console.log('Clients:', clients);
  process.exit(0);
}
run();
