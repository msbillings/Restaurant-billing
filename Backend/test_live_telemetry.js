import { io } from 'socket.io-client';
import mongoose from 'mongoose';

const testTelemetry = async () => {
  console.log('--- STARTING TELEMETRY TEST ---');

  // 1. Establish a WebSocket Connection
  const socket = io('http://localhost:5002', {
    transports: ['websocket']
  });
  socket.on('connect', () => {
    console.log('WebSocket Connected (Socket ID:', socket.id, ')');
    socket.emit('joinTenant', 'mscurechain_test');
  });

  // 2. Simulate API Calls (Success - 200 OK)
  console.log('Sending 10 Successful Requests...');
  for (let i = 0; i < 10; i++) {
    try {
      await fetch('http://localhost:5002/api/health', {
        headers: { 'x-tenant-db': 'mscurechain_test' }
      });
    } catch (e) {}
  }

  // 3. Simulate API Errors (404/500)
  console.log('Sending 5 Error Requests...');
  for (let i = 0; i < 5; i++) {
    try {
      await fetch('http://localhost:5002/api/this-route-does-not-exist', {
        headers: { 'x-tenant-db': 'mscurechain_test' }
      });
    } catch (e) {}
  }

  // 4. Simulate Live Revenue
  console.log('Connecting to DB to insert a dummy Bill to simulate live revenue...');
  await mongoose.connect('mongodb://localhost:27017/mscurechain');
  const Client = mongoose.model('Client', new mongoose.Schema({ databaseName: String, status: String }), 'clients');
  
  // Find a valid active client
  const client = await Client.findOne({ status: 'Active', databaseName: { $exists: true } });
  if (client) {
    const tenantDb = mongoose.connection.useDb(client.databaseName);
    const billsCol = tenantDb.collection('bills');
    
    await billsCol.insertOne({
      total: 5000,
      grandTotal: 5250,
      paymentStatus: 'Paid',
      createdAt: new Date()
    });
    console.log(`Inserted INR 5,250 bill into tenant database: ${client.databaseName}`);
  }

  console.log('--- WAITING 15 SECONDS FOR METRICS TO FLUSH ---');
  setTimeout(async () => {
    try {
      // Query SuperAdmin Analytics API
      const res = await fetch('http://localhost:4001/api/analytics/realtime');
      const data = await res.json();
      console.log('=== REALTIME ANALYTICS RESULTS ===');
      console.log('RPM:', data.totalRPM);
      console.log('Errors:', data.totalErrors);
      console.log('Avg Latency:', data.avgSystemLatency, 'ms');
      console.log('Active Sockets:', data.activeWebSockets);
      console.log('Live Revenue:', data.liveRevenue);
      console.log('==================================');
    } catch (e) {
      console.error('Failed to get stats', e.message);
    }
    
    socket.disconnect();
    mongoose.disconnect();
    process.exit(0);
  }, 15000);
};

testTelemetry();
