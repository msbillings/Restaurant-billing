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
      
      // Get all databases in the cluster
      const admin = conn.db.admin();
      const { databases } = await admin.listDatabases();
      
      console.log(`Found ${databases.length} databases in Cluster ${i}`);

      for (const dbInfo of databases) {
        const dbName = dbInfo.name;
        // Skip default mongo DBs
        if (['admin', 'config', 'local'].includes(dbName)) continue;
        
        // Connect to the specific database
        const dbUri = uri.replace(/\/[^/?]+\?/, `/${dbName}?`);
        const dbConn = await mongoose.createConnection(dbUri).asPromise();
        
        // Check if bills collection exists
        const collections = await dbConn.db.listCollections().toArray();
        if (!collections.some(c => c.name === 'bills')) {
          await dbConn.close();
          continue;
        }

        const BillModel = dbConn.model('Bill', Bill.schema);

        const futureBills = await BillModel.find({ createdAt: { $gt: futureDateThreshold } });
        
        if (futureBills.length > 0) {
          console.log(`Found ${futureBills.length} future bills in Cluster ${i} -> Database: ${dbName}`);
        }

        for (const bill of futureBills) {
          // We know the offset is exactly 5.5 hours because 5.5 hours was added twice.
          // Wait! The previous script said 11 hours. I will check the offset dynamically.
          // If the bill was created at 1:44 AM (Oct 3rd), which is 25:44, and the real time was 8:14 PM (20:14) on Oct 2nd, the difference is 5.5 hours.
          // Wait! Let me just subtract 5.5 hours!
          const offsetMs = 5.5 * 60 * 60 * 1000;
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
        await dbConn.close();
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
