import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8']);

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const mscurechain = mongoose.connection.useDb('mscurechain');
    const client = await mscurechain.collection('clients').findOne({ email: 'ramesh@gmail.com' });
    console.log("Client Found:", client?._id, client?.databaseName, client?.cluster);
    
    if(client && client.databaseName) {
      const tenantDb = mongoose.connection.useDb(client.databaseName);
      
      const collections = await tenantDb.db.listCollections().toArray();
      console.log("Collections in", client.databaseName, ":", collections.map(c => c.name));

      const users = await tenantDb.collection('users').find({}).toArray();
      console.log("Users in tenant DB:", users);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
check();
