const dns = require('dns');
try { dns.setServers(['8.8.8.8']); } catch(e) {}
const mongoose = require('mongoose');
require('dotenv').config();

async function testStats() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.useDb('client_test1_db');
  const stats = await db.db.stats();
  console.log('Collections:', stats.collections);
  process.exit();
}
testStats().catch(console.error);
