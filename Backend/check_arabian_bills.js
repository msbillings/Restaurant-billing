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

async function checkBills() {
  const uri = process.env.MONGO_URI_CLUSTER5;
  const dbUri = uri.replace(/\/[^/?]+\?/, '/client_thearabianlabandubai_6abdf6?');

  console.log('Connecting to', dbUri);
  try {
    const conn = await mongoose.createConnection(dbUri).asPromise();
    const BillModel = conn.model('Bill', Bill.schema);

    const bills = await BillModel.find({
      billNumber: { $in: ['MS0001', 'MS0002', 'MS0003', 'MS0029', 'MS0219'] }
    }).select('billNumber createdAt').lean();

    console.log(bills);
    await conn.close();
  } catch(e) {
    console.error(e);
  }
}
checkBills();
