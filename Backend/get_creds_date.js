import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkDate() {
  const uri = process.env.MONGO_URI.replace('/mscurechain?', '/client_mrpizzahotandfresh_6a9927?');
  const conn = await mongoose.createConnection(uri).asPromise();
  
  const authSchema = new mongoose.Schema({ id: String, data: String }, { strict: false });
  const WA = conn.model('WhatsAppAuth', authSchema);
  
  const creds = await WA.findOne({ id: 'creds' });
  if (creds) {
    console.log('Creds ID:', creds.id);
    console.log('Creds _id generation time:', creds._id.getTimestamp());
  } else {
    console.log('No creds doc found. Searching for any doc to see structure...');
    const anyDoc = await WA.findOne();
    console.log('First doc id:', anyDoc ? anyDoc.id : 'None');
  }
  
  process.exit(0);
}
checkDate().catch(console.error);
