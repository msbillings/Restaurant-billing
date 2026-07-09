import dotenv from 'dotenv';
dotenv.config();
import { getTenantModels } from './utils/tenantManager.js';
import mongoose from 'mongoose';

async function testRouting() {
  try {
    console.log('--- Testing Multi-Tenant Database Routing ---');
    
    console.log('1. Loading models for tenant: client_maheer_db...');
    const maheerModels = await getTenantModels('client_maheer_db');
    const maheerSettingsDoc = await maheerModels.Setting.findOne({ key: 'restaurantSettings' });
    let maheerSettings = maheerSettingsDoc?.value;
    
    if (!maheerSettings || maheerSettings.restaurantName !== 'MAHEER RESTAURANT') {
      console.log('   Setting Maheer Restaurant name in client_maheer_db...');
      maheerSettings = {
        restaurantName: 'MAHEER RESTAURANT',
        restaurantType: 'Multi-Cuisine & Fine Dining',
        address: 'Banjara Hills, Hyderabad - 500034',
        phone: '9876543210',
        email: 'support@maheer-restaurant.com',
        gstin: '36MAHEER1234F1Z5'
      };
      await maheerModels.Setting.findOneAndUpdate(
        { key: 'restaurantSettings' },
        { value: maheerSettings },
        { upsert: true }
      );
    }
    console.log('   Maheer Restaurant Name:', maheerSettings.restaurantName);
    console.log('   Maheer Address:', maheerSettings.address);

    console.log('\n2. Loading models for tenant: client_mm_db...');
    const mmModels = await getTenantModels('client_mm_db');
    const mmSettingsDoc = await mmModels.Setting.findOne({ key: 'restaurantSettings' });
    const mmSettings = mmSettingsDoc?.value || { restaurantName: 'MM RESTAURANT (Default)' };
    console.log('   MM Restaurant Name:', mmSettings.restaurantName);
    console.log('   MM Phone:', mmSettings.phone);

    console.log('\n3. Verifying Isolation...');
    const maheerCheck = await maheerModels.Setting.findOne({ key: 'restaurantSettings' });
    console.log('   Re-checking Maheer DB after MM DB query:', maheerCheck.value.restaurantName);
    
    if (maheerCheck.value.restaurantName === 'MAHEER RESTAURANT' && mmSettings.restaurantName === 'MM RESTAURANT') {
      console.log('\nSUCCESS! Multi-Tenant Routing is 100% working and isolated!');
    } else {
      console.log('\nFAILURE: Data reflected between tenants!');
    }

    await maheerModels.connection.close();
    await mmModels.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testRouting();
