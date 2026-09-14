import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { getTenantModels } from '../utils/tenantManager.js';

async function run() {
  await mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0');
  const models = await getTenantModels('client_test4_db');

  const Setting = models.Setting;
  const Bill = models.Bill;
  const Customer = models.Customer;

  console.log('Querying bills...');
  const bills = await Bill.find({
    status: 'Paid',
    feedbackProcessed: { $ne: true },
    customerPhone: { $exists: true, $ne: '' }
  }).sort({ settledAt: -1 }).limit(10).lean();

  console.log('Found bills:', bills.length);
  for (const b of bills) {
    console.log(`- Bill #${b.billNumber} | Phone: "${b.customerPhone}" | Status: ${b.status} | FeedbackProcessed: ${b.feedbackProcessed}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
