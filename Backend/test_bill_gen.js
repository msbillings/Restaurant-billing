import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Bill from './models/Bill.js';
import { generateUniqueBillNumber } from './controllers/orderController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const CLUSTERS = [
  process.env.MONGO_URI,
  process.env.MONGO_URI_CLUSTER1,
  process.env.MONGO_URI_CLUSTER2,
  process.env.MONGO_URI_CLUSTER3,
].filter(Boolean);

async function test() {
  for (let i = 0; i < CLUSTERS.length; i++) {
    console.log(`Connecting to cluster ${i}...`);
    try {
      // Parse URI and replace the database name with client_test4_db
      let uri = CLUSTERS[i];
      if (uri.includes('?')) {
        uri = uri.replace(/\/[^/?]+\?/, '/client_test4_db?');
      } else {
        uri = uri.endsWith('/') ? uri + 'client_test4_db' : uri + '/client_test4_db';
      }
      const conn = await mongoose.createConnection(uri).asPromise();
      const BillModel = conn.model('Bill', Bill.schema);
      
      const newBillNo = await generateUniqueBillNumber(BillModel);
      console.log(`Cluster ${i} generateUniqueBillNumber returns:`, newBillNo);
      
      const topBills = await BillModel.find().sort({createdAt:-1}).limit(5).select('billNumber createdAt');
      console.log(`Cluster ${i} Top Bills:`, topBills);
      
      conn.close();
    } catch(e) {
      console.error(`Cluster ${i} failed:`, e);
    }
  }
}
test();
