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

async function fixTrailingSpace() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const client = await Client.findOne({ databaseName: 'client_seemaruchulu_6ab122' });
        if (client && client.restaurantName.endsWith(' ')) {
            console.log(`Found client: '${client.restaurantName}'`);
            client.restaurantName = client.restaurantName.trim();
            await client.save();
            console.log(`Fixed client name to: '${client.restaurantName}'`);
        } else {
            console.log('No trailing space found or client not found.');
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

fixTrailingSpace();
