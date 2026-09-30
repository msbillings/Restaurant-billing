import _crypto from 'crypto';
import dns from 'dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) { }
if (!globalThis.crypto) {
  try { Object.defineProperty(globalThis, 'crypto', { value: _crypto }); } catch (e) { }
}

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('d:/restaurant/Restaurant-billing/SuperAdminServer/.env') });

import Client from './models/Client.js';

async function fixCluster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const client = await Client.findOne({ databaseName: 'client_seemaruchulu_6ab122' });
        if (client) {
            console.log(`Current cluster: ${client.cluster}`);
            client.cluster = 'cluster0';
            await client.save();
            console.log(`Updated cluster to: ${client.cluster}`);
        } else {
            console.log('Client not found.');
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

fixCluster();
