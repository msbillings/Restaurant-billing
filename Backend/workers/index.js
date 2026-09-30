import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { startWhatsAppWorker } from './whatsappWorker.js';
import { startReportWorker } from './reportWorker.js';
import { buildTenantClusterMap } from '../utils/tenantManager.js';

// Setup uncaught exception handling for the worker process
process.on('uncaughtException', (err) => {
  console.error('[Worker Process] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Worker Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize Workers
const initWorkers = async () => {
  console.log('[Worker Process] Booting up background workers...');

  // 1. Connect to Database
  try {
    // connectDB already uses process.env.MONGO_URI internally
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 20
    });
    console.log('[Worker Process] Connected to MongoDB');

    // Pre-build tenant cluster map before processing jobs
    await buildTenantClusterMap();
    console.log('[Worker Process] Pre-built tenant cluster map');
  } catch (dbErr) {
    console.error('[Worker Process] Startup error (MongoDB or tenant mapping):', dbErr);
    process.exit(1);
  }

  // 2. Start BullMQ Workers
  const whatsappWorker = startWhatsAppWorker();
  const reportWorker = startReportWorker();

  // 3. Graceful Shutdown
  const shutdown = async () => {
    console.log('[Worker Process] Shutting down workers gracefully...');
    await Promise.all([
      whatsappWorker.close(),
      reportWorker.close()
    ]);
    await mongoose.connection.close();
    console.log('[Worker Process] Shutdown complete. Exiting.');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

initWorkers();
