import mongoose from 'mongoose';
const URI = 'mongodb://narasimhaDln:728803Dln%40@ac-oooc0og-shard-00-00.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-01.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-02.btqf66f.mongodb.net:27017/client_demo_db?ssl=true&authSource=admin&replicaSet=atlas-4ixmxj-shard-0';
async function run() {
  const conn = await mongoose.createConnection(URI).asPromise();
  const User = conn.model('User', new mongoose.Schema({ username: String, role: String }));
  const users = await User.find({});
  console.log('Demo Users:', users);
  process.exit(0);
}
run();
