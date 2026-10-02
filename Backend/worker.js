import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import startSessionCleanupJob from './utils/sessionCleanup.js';
import { startBackupCron } from './utils/backupManager.js';
import { startSecureReportCleanupJob } from './utils/secureReportCleanup.js';
import { startWhatsAppScheduler } from './utils/whatsappScheduler.js';
import redisManager from './utils/redisClient.js';
import { buildTenantClusterMap } from './utils/tenantManager.js';

async function startWorker() {
  console.log('[Worker] Initializing worker process...');
  
  // 1. Connect to Redis
  await redisManager.connect();
  
  // 2. Connect to MongoDB
  let MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('[FATAL] MONGO_URI missing.');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 5,
  });
  console.log('[Worker] Connected to MongoDB');

  // Pre-load tenant map
  await buildTenantClusterMap().catch(e => console.warn('[tenantManager] buildTenantClusterMap:', e.message));
  
  // 3. Start Jobs
  console.log('[Worker] Starting cron jobs and schedulers...');
  startSessionCleanupJob();
  startBackupCron();
  startSecureReportCleanupJob();
  startWhatsAppScheduler();
  
  console.log('[Worker] Initialization complete.');
}

startWorker().catch(err => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
