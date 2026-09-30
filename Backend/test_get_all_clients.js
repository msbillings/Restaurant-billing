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

import Client from './models/Client.js';
import License from './models/License.js';

async function testGetAllClients() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const clients = await Client.find().lean().sort({ createdAt: -1 });
        
        const clientsWithLicense = await Promise.all(clients.map(async (client) => {
          const license = await License.findOne({ client: client._id });
          return { 
            ...client, 
            validUntil: license ? license.validUntil : null,
            plan: license ? license.plan : 'Unknown',
            licenseCreatedAt: license ? license.createdAt : client.createdAt
          };
        }));
        
        const seema = clientsWithLicense.find(c => JSON.stringify(c).toLowerCase().includes('seemaruchulu'));
        console.log('Seema client returned by API logic:', JSON.stringify(seema, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

testGetAllClients();
