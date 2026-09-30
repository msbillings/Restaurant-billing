const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const masterUri = process.env.MONGO_URI;
  const masterConn = mongoose.createConnection(masterUri);
  
  const clientSchema = new mongoose.Schema({ databaseName: String, cluster: String, restaurantName: String });
  const Client = masterConn.model('Client', clientSchema);

  const clients = await Client.find({ status: { $ne: 'Inactive' } });
  
  let connected = 0;
  console.log(`Found ${clients.length} active clients.`);

  for (const client of clients) {
    if (!client.databaseName) continue;
    let clusterUri = process.env.MONGO_URI;
    if (client.cluster === 'cluster1') clusterUri = process.env.MONGO_URI_CLUSTER1;
    if (client.cluster === 'cluster2') clusterUri = process.env.MONGO_URI_CLUSTER2;
    if (client.cluster === 'cluster3') clusterUri = process.env.MONGO_URI_CLUSTER3;
    if (client.cluster === 'cluster4') clusterUri = process.env.MONGO_URI_CLUSTER4;

    const tenantUri = clusterUri.replace('/msbillings?', `/${client.databaseName}?`).replace('/mscurechain?', `/${client.databaseName}?`);
    
    const tenantConn = mongoose.createConnection(tenantUri);
    const WA = tenantConn.model('WhatsAppAuth', new mongoose.Schema({}, { strict: false }));
    const count = await WA.countDocuments();
    if (count > 0) {
      console.log(`- ${client.restaurantName} (DB: ${client.databaseName}) HAS WhatsAppAuth records: ${count}`);
      connected++;
    }
    await tenantConn.close();
  }
  
  console.log(`\nTotal restaurants with WhatsApp connected: ${connected}`);
  await masterConn.close();
  process.exit(0);
}

run().catch(console.error);
