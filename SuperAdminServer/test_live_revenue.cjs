const mongoose = require('mongoose');
const Client = require('./models/Client.js').default || require('./models/Client.js');
const { getTenantDb } = require('./utils/clusterManager.js');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Atlas DB');
  
  const clients = await Client.find({ status: 'Active' }).lean();
  let totalRevenue = 0;
  
  const today = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(today.getTime() + istOffset);
  istTime.setUTCHours(0, 0, 0, 0);
  const startOfDayUTC = new Date(istTime.getTime() - istOffset);
  console.log('Start of day UTC:', startOfDayUTC);

  for (const client of clients) {
    if (!client.databaseName) continue;
    try {
      const tenantDb = await getTenantDb(client.cluster, client.databaseName);
      const billsCollection = tenantDb.collection('bills');
      
      const billCount = await billsCollection.countDocuments();
      if (billCount > 0) {
        console.log(`DB ${client.databaseName} has ${billCount} total bills.`);
        const sample = await billsCollection.findOne({}, { sort: { createdAt: -1 } });
        console.log(`Sample status: ${sample.status}, createdAt: ${sample.createdAt}`);
      }

      const todayBills = await billsCollection.find({ 
        createdAt: { $gte: startOfDayUTC },
        status: 'Paid'
      }).toArray();
      
      const revenue = todayBills.reduce((acc, bill) => acc + (bill.grandTotal || bill.total || 0), 0);
      if (revenue > 0) {
        console.log(`Client ${client.databaseName} has ${todayBills.length} paid bills today. Revenue: ${revenue}`);
      }
      totalRevenue += revenue;
    } catch(e) {
      console.log('Error for', client.databaseName, e.message);
    }
  }
  
  console.log('Total Live Revenue:', totalRevenue);

  // INSERT DUMMY BILL SO WE CAN SEE IT IN UI
  const targetDb = await getTenantDb('cluster0', 'mscurechain_test');
  await targetDb.collection('bills').insertOne({
    total: 10000,
    grandTotal: 10500,
    status: 'Paid',
    createdAt: new Date()
  });
  console.log('Inserted dummy bill into mscurechain_test');

  process.exit();
}

test().catch(console.error);
