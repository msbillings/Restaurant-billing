const dns = require('dns');
try { dns.setServers(['8.8.8.8']); } catch(e) {}
const mongoose = require('mongoose');
require('dotenv').config();

async function checkCollections() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/restopos_superadmin');
  const Client = mongoose.connection.collection('clients');
  // cluster0 or primary cluster
  const clients = await Client.find({ status: 'Active', cluster: { $in: ['cluster0', null, undefined] } }).toArray();
  
  let totalCollections = 0;
  console.log('Found ' + clients.length + ' clients in primary cluster.');
  
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restopos_superadmin';
  const connectionPart = baseUri.split('?')[0];
  const lastSlashIndex = connectionPart.lastIndexOf('/');
  const uriPrefix = connectionPart.substring(0, lastSlashIndex);
  const queryPart = baseUri.includes('?') ? '?' + baseUri.split('?')[1] : '';

  for (const client of clients) {
    if (!client.databaseName) continue;
    
    const tenantUri = uriPrefix + '/' + client.databaseName + queryPart;
    
    try {
      const tenantConn = await mongoose.createConnection(tenantUri).asPromise();
      const stats = await tenantConn.db.stats();
      totalCollections += (stats.collections || 0);
      await tenantConn.close();
    } catch (e) {
      console.log('Error on ' + client.databaseName + ': ' + e.message);
    }
  }
  console.log('Total collections in primary cluster: ' + totalCollections);
  process.exit();
}

checkCollections().catch(console.error);
