import { io } from 'socket.io-client';

console.log('--- STARTING CONTINUOUS TELEMETRY STRESS TEST ---');
console.log('Keep this script running in the background.');

// 1. Establish 3 Persistent WebSocket Connections
for (let i = 0; i < 3; i++) {
  const socket = io('http://localhost:5002', { transports: ['websocket'] });
  socket.on('connect', () => {
    console.log(`WebSocket ${i+1} Connected (Socket ID: ${socket.id})`);
    socket.emit('joinTenant', 'mscurechain');
  });
}

// 2. Continually generate API Errors and Traffic every 5 seconds
setInterval(async () => {
  try {
    // Generate an API Error (404)
    await fetch('http://localhost:5002/api/this-route-does-not-exist', {
      headers: { 'x-tenant-db': 'mscurechain' }
    });
    // Generate a successful request
    await fetch('http://localhost:5002/api/health', {
      headers: { 'x-tenant-db': 'mscurechain' }
    });
    console.log('Sent simulated background load (1 error, 1 success)...');
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}, 5000);
