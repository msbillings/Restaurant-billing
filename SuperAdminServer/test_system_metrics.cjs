const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch(e) {}
const mongoose = require('mongoose');
require('dotenv').config();

async function updateSystemMetrics() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Atlas DB');
  
  await mongoose.connection.db.collection('system_metrics').updateOne(
    { _id: 'global' },
    { $set: { activeSockets: 42, lastUpdated: new Date() } },
    { upsert: true }
  );

  const clients = await mongoose.connection.db.collection('clients').find({ status: 'Active' }).toArray();
  const anand = clients.find(c => c.restaurantName && c.restaurantName.includes('Anand'));
  if (anand) {
    await mongoose.connection.db.collection('clients').updateOne(
      { _id: anand._id },
      { $set: { 'realtimeMetrics.lastMinuteErrors': 12 } }
    );
    console.log('Inserted 12 API errors for Anand');
  }

  console.log('Inserted dummy system_metrics!');
  process.exit();
}
updateSystemMetrics().catch(console.error);
