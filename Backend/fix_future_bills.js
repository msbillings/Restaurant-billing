import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Bill from './models/Bill.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const CLUSTERS = [
  process.env.MONGO_URI,
  process.env.MONGO_URI_CLUSTER1,
  process.env.MONGO_URI_CLUSTER2,
  process.env.MONGO_URI_CLUSTER3,
  process.env.MONGO_URI_CLUSTER4,
  process.env.MONGO_URI_CLUSTER5,
  process.env.MONGO_URI_CLUSTER6,
  process.env.MONGO_URI_CLUSTER7,
  process.env.MONGO_URI_CLUSTER8,
  process.env.MONGO_URI_CLUSTER9
].filter(Boolean);

async function fixFutureBills() {
  const futureDateThreshold = new Date(Date.now() + 60 * 60 * 1000); // anything more than 1 hour in the future

  console.log(`Searching for bills with createdAt > ${futureDateThreshold.toISOString()} across ${CLUSTERS.length} clusters...`);

  let totalFixed = 0;

  for (let i = 0; i < CLUSTERS.length; i++) {
    const uri = CLUSTERS[i];
    console.log(`\n--- Connecting to Cluster ${i} ---`);
    try {
      const conn = await mongoose.createConnection(uri).asPromise();
      const BillModel = conn.model('Bill', Bill.schema);

      const futureBills = await BillModel.find({ createdAt: { $gt: futureDateThreshold } });
      
      console.log(`Found ${futureBills.length} future bills in Cluster ${i}`);

      for (const bill of futureBills) {
        // We know the offset is exactly 11 hours
        const offsetMs = 11 * 60 * 60 * 1000;
        const newCreatedAt = new Date(bill.createdAt.getTime() - offsetMs);
        const newUpdatedAt = new Date(bill.updatedAt.getTime() - offsetMs);
        
        console.log(`Fixing Bill #${bill.billNumber} from ${bill.createdAt.toISOString()} to ${newCreatedAt.toISOString()}`);
        
        await BillModel.updateOne(
          { _id: bill._id },
          { 
            $set: { 
              createdAt: newCreatedAt,
              updatedAt: newUpdatedAt 
            }
          }
        );
        totalFixed++;
      }
      
      await conn.close();
    } catch (err) {
      console.error(`Error processing Cluster ${i}:`, err.message);
    }
  }

  console.log(`\nDone! Total bills fixed: ${totalFixed}`);
  process.exit(0);
}

fixFutureBills();
