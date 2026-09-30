import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function runTest() {
  console.log('--- STARTING REALTIME METRICS TEST ---');
  
  try {
    // 1. Connect to DB to get a tenant
    await mongoose.connect(process.env.MONGO_URI);
    const clients = await mongoose.connection.db.collection('clients').find({ status: 'Active' }).toArray();
    
    if (clients.length === 0) {
      console.log('No active clients found to test.');
      process.exit(0);
    }
    
    const targetTenant = clients[0].databaseName;
    console.log(`[Test] Selected tenant: ${targetTenant} (${clients[0].restaurantName})`);
    
    // 2. Simulate 50 requests to the backend API for this tenant
    console.log(`[Test] Simulating 50 rapid API requests for ${targetTenant}...`);
    let successfulRequests = 0;
    
    for (let i = 0; i < 50; i++) {
      try {
        // Hit a lightweight endpoint like /api/health or any public route on backend
        // Wait, backend health route /api/health doesn't use tenantMiddleware if it's outside. 
        // Let's hit a route that does use tenantMiddleware. We can just hit a random route like GET /api/menu (even without auth, it will hit the middleware and return 401, but the middleware and response hook will still run!)
        await fetch('http://localhost:5002/api/menu', {
          headers: { 'x-tenant-db': targetTenant }
        });
        successfulRequests++;
      } catch (e) {
        // ignore network errors if backend is down
      }
    }
    
    console.log(`[Test] Sent ${successfulRequests} requests.`);
    
    // 3. Wait 12 seconds for the Backend metricsIngester (runs every 10s) to flush to DB
    console.log(`[Test] Waiting 12 seconds for metrics to flush to DB...`);
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    // 4. Check the DB directly to see if realtime_metrics updated
    const metrics = await mongoose.connection.db.collection('realtime_metrics').findOne({ tenantDb: targetTenant });
    
    console.log('\n--- TEST RESULTS ---');
    if (metrics) {
      console.log('✅ Metrics successfully recorded in DB!');
      console.log(`Tenant: ${metrics.tenantDb}`);
      console.log(`Total Requests Recorded: ${metrics.totalRequests}`);
      console.log(`Requests in current window (RPM pending): ${metrics.currentWindowRequests}`);
      console.log(`Total Data Transfer (Bytes): ${metrics.totalReqBytes + metrics.totalResBytes}`);
      console.log(`Last Active: ${metrics.lastActive}`);
      
      if (metrics.totalRequests > 0) {
        console.log('\n🎉 SUCCESS: The realtime metrics engine is actively tracking and flushing telemetry data!');
      } else {
        console.log('\n❌ FAILED: The metrics document exists but recorded 0 requests.');
      }
    } else {
      console.log('\n❌ FAILED: No metrics document found for this tenant in the DB.');
    }
    
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTest();
