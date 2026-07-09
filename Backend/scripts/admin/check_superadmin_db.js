import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb://narasimhaDln:728803Dln%40@ac-oooc0og-shard-00-00.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-01.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-02.btqf66f.mongodb.net:27017/superadmin?ssl=true&authSource=admin&replicaSet=atlas-4ixmxj-shard-0';

mongoose.connect(MONGO_URI).then(async () => {
  console.log('Connected to Superadmin DB');
  
  const clientSchema = new mongoose.Schema({
    restaurantName: String,
    email: String,
    plainTextPassword: String,
    databaseName: String
  });
  
  const Client = mongoose.model('Client', clientSchema, 'clients');
  
  const clients = await Client.find({});
  console.log('CLIENTS IN SUPERADMIN DB:', clients);
  
  process.exit(0);
});
