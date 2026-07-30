import mongoose from 'mongoose';
const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

async function fetchClients() {
  await mongoose.connect(uri);
  const Client = mongoose.model('Client', new mongoose.Schema({}, { strict: false }));
  const clients = await Client.find({});
  
  console.log("All Clients:");
  clients.forEach(c => {
    const obj = c.toObject();
    console.log(`- Name: ${obj.restaurantName}, Email: ${obj.email}, DB: ${obj.databaseName}`);
  });
  mongoose.disconnect();
}
fetchClients();
