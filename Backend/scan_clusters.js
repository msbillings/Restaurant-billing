import _crypto from 'crypto';
import dns from 'dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) { }
if (!globalThis.crypto) {
  try { Object.defineProperty(globalThis, 'crypto', { value: _crypto }); } catch (e) { }
}

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('d:/restaurant/Restaurant-billing/Backend/.env') });

async function scanAllClusters() {
    const envs = Object.keys(process.env).filter(k => k.startsWith('MONGO_URI'));
    
    for (const envKey of envs) {
        const uri = process.env[envKey];
        if (!uri) continue;
        
        console.log(`\nScanning ${envKey}...`);
        try {
            const conn = await mongoose.createConnection(uri).asPromise();
            const adminDb = conn.db.admin();
            const dbs = await adminDb.listDatabases();
            const matchingDbs = dbs.databases.filter(d => d.name.toLowerCase().includes('seema'));
            
            if (matchingDbs.length > 0) {
                console.log(`FOUND databases on ${envKey}:`);
                for (const d of matchingDbs) {
                    console.log(`- ${d.name}`);
                    const tenantDb = conn.useDb(d.name);
                    const menuCount = await tenantDb.collection('menus').countDocuments();
                    const billsCount = await tenantDb.collection('bills').countDocuments();
                    console.log(`  -> Menus: ${menuCount}, Bills: ${billsCount}`);
                }
            } else {
                console.log(`No matching databases found.`);
            }
            await conn.close();
        } catch (e) {
            console.error(`Error connecting to ${envKey}:`, e.message);
        }
    }
}

scanAllClusters();
