import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Bill from './models/Bill.js';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function fixBuggedBills() {
  const uri = process.env.MONGO_URI_CLUSTER5;
  const dbUri = uri.replace(/\/[^/?]+\?/, '/client_thearabianlabandubai_6abdf6?');

  console.log('Connecting to', dbUri);
  try {
    const conn = await mongoose.createConnection(dbUri).asPromise();
    const BillModel = conn.model('Bill', Bill.schema);

    // Find bills from MS0001 to MS0029
    const buggedBills = await BillModel.find({
      billNumber: { $in: Array.from({length: 29}, (_, i) => `MS${String(i+1).padStart(4, '0')}`) }
    });

    console.log(`Found ${buggedBills.length} bugged bills.`);

    let fixedCount = 0;
    for (const bill of buggedBills) {
      // check if it's already fixed (e.g. if the UTC hour is less than 12, it's definitely fixed)
      // Actually, if MS0001 was 5:32 PM IST, the true UTC is 12:02 PM.
      // Bugged UTC is 17:32.
      // Let's only fix bills where UTC hour is >= 17 (meaning they are in the evening UTC, which corresponds to 10:30 PM+ IST)
      if (bill.createdAt.getUTCHours() >= 17 || bill.createdAt.getUTCDate() > 2) {
        const offsetMs = 5.5 * 60 * 60 * 1000;
        const newCreatedAt = new Date(bill.createdAt.getTime() - offsetMs);
        const newUpdatedAt = new Date(bill.updatedAt.getTime() - offsetMs);
        
        console.log(`Fixing ${bill.billNumber} from ${bill.createdAt.toISOString()} to ${newCreatedAt.toISOString()}`);
        
        await conn.collection('bills').updateOne(
          { _id: bill._id },
          { $set: { createdAt: newCreatedAt, updatedAt: newUpdatedAt } }
        );
        fixedCount++;
      } else {
        console.log(`Skipping ${bill.billNumber} - seems already correct: ${bill.createdAt.toISOString()}`);
      }
    }

    console.log(`Fixed ${fixedCount} bills.`);
    await conn.close();
  } catch(e) {
    console.error(e);
  }
}
fixBuggedBills();
