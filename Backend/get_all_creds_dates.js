import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dns from 'dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const restaurants = [
  { name: 'Test Restaurant 1', db: 'client_test1_db', clusterKey: 'MONGO_URI' },
  { name: "Anand's Restaurant", db: 'client_test4_db', clusterKey: 'MONGO_URI_CLUSTER1' },
  { name: 'Mr. Pizza - Hot and Fresh', db: 'client_mrpizzahotandfresh_6a9927', clusterKey: 'MONGO_URI' },
  { name: "Thanvi's Café - Brews & Bites", db: 'client_udaivikas_db', clusterKey: 'MONGO_URI' },
  { name: 'Viraj Cafe', db: 'client_virajcafe_db', clusterKey: 'MONGO_URI' },
  { name: 'SA 7 Star Chickens', db: 'client_sa7starchickens_db', clusterKey: 'MONGO_URI' }
];

async function checkDates() {
  for (const r of restaurants) {
    let dateFound = null;
    let source = null;

    // Check Local File System first
    const localCredsPath = `./auth_info_baileys_${r.db}/creds.json`;
    if (fs.existsSync(localCredsPath)) {
      const stats = fs.statSync(localCredsPath);
      dateFound = stats.birthtime || stats.ctime; 
      // birthtime is creation, ctime is change time. Windows supports birthtime.
      source = 'Local File';
    }

    // Check MongoDB
    try {
      let clusterUri = process.env[r.clusterKey];
      const tenantUri = clusterUri.replace(/\/[a-zA-Z0-9_]+\?/, `/${r.db}?`);
      const conn = await mongoose.createConnection(tenantUri).asPromise();
      const WA = conn.model('WhatsAppAuth', new mongoose.Schema({ id: String }, { strict: false }));
      
      const creds = await WA.findOne({ id: 'creds' });
      if (creds) {
        // Prefer mongo if both exist
        dateFound = creds._id.getTimestamp();
        source = 'MongoDB';
      }
      await conn.close();
    } catch (err) {
      console.log(`Failed Mongo for ${r.name}: ${err.message}`);
    }

    if (dateFound) {
      console.log(`- ${r.name}: ${new Date(dateFound).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (Source: ${source})`);
    } else {
      console.log(`- ${r.name}: Date not found!`);
    }
  }

  process.exit(0);
}

checkDates().catch(console.error);
