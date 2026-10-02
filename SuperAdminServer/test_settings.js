import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import GlobalSettings from './models/GlobalSettings.js';

async function test() {
  try {
    let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restopos_superadmin';
    if (uri.includes('mongodb+srv')) {
      const parts = uri.split('?');
      const connectionPart = parts[0];
      const lastSlashIndex = connectionPart.lastIndexOf('/');
      uri = connectionPart.substring(0, lastSlashIndex) + '/mscurechain';
      if (parts[1]) uri += '?' + parts[1];
    }
    
    await mongoose.connect(uri);
    console.log('Connected to DB');
    
    let referrerSettings = await GlobalSettings.findOne({ key: 'REFERRER_REWARD_DAYS' });
    let refereeSettings = await GlobalSettings.findOne({ key: 'REFEREE_REWARD_DAYS' });
    
    if (!referrerSettings) referrerSettings = await GlobalSettings.create({ key: 'REFERRER_REWARD_DAYS', value: 7 });
    if (!refereeSettings) refereeSettings = await GlobalSettings.create({ key: 'REFEREE_REWARD_DAYS', value: 7 });
    
    console.log('Referrer:', referrerSettings);
    console.log('Referee:', refereeSettings);
    
  } catch (e) {
    console.error('Test Error:', e);
  } finally {
    process.exit(0);
  }
}
test();
