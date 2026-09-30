import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import dns from 'dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch(e){}
dotenv.config();

async function runTest() {
  console.log('--- STARTING REALTIME METRICS TEST ---');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0');
    const clients = await mongoose.connection.db.collection('clients').find({ status: 'Active' }).toArray();
    
    if (clients.length === 0) {
      console.log('No active clients found to test.');
      process.exit(0);
    }
    
    const targetClient = clients.find(c => c.restaurantName.includes('Star Chicken')) || clients[0];
    const targetTenant = targetClient.databaseName;
    console.log(`[Test] Selected tenant: ${targetTenant} (${targetClient.restaurantName})`);
    
    console.log(`[Test] Simulating 100 rapid API requests for ${targetTenant}...`);
    let successfulRequests = 0;
    
    for (let i = 0; i < 100; i++) {
      try {
        const response = await fetch('http://localhost:5002/api/menu', {
          headers: { 'x-tenant-db': targetTenant }
        });
        successfulRequests++;
      } catch (e) {
      }
    }
    
    console.log(`[Test] Sent ${successfulRequests} requests.`);
    
    console.log(`[Test] Waiting 12 seconds for metrics to flush to DB...`);
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    const clientRecord = await mongoose.connection.db.collection('clients').findOne({ databaseName: targetTenant });
    const metrics = clientRecord?.realtimeMetrics;
    
    console.log('\n--- TEST RESULTS ---');
    if (metrics) {
      console.log('✅ Metrics successfully recorded in DB!');
      console.log(`Total Requests Recorded: ${metrics.totalRequests}`);
      console.log(`Total Data Transfer (Bytes): ${metrics.totalReqBytes + metrics.totalResBytes}`);
      console.log(`Last Active: ${metrics.lastActive}`);
      
      if (metrics.totalRequests > 0) {
        console.log('\n🎉 SUCCESS: The realtime metrics engine is actively tracking and flushing telemetry data!');
      } else {
        console.log('\n❌ FAILED: The metrics document exists but recorded 0 requests.');
      }
    } else {
      console.log('\n❌ FAILED: No metrics document found for this tenant in the DB. `realtimeMetrics` property is missing.');
    }
    
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTest();
