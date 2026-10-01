import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cron from 'node-cron';
import mongoose from 'mongoose';
import { getTenantModels } from './tenantManager.js';
import Client from '../models/Client.js';
import { encryptBackup, decryptBackup } from './cryptoUtil.js';

const RETENTION_LIMIT = 7;

// Setup Backup Directory
const getBackupDir = () => {
  const baseDir = process.env.APP_USER_DATA_PATH || process.cwd();
  const backupDir = path.join(baseDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
};

// Target Collections verified in Phase 4.1 Audit
const TARGET_COLLECTIONS = [
  'Menu', 'Bill', 'Setting', 'User', 'Category', 'Expense',
  'InventoryItem', 'Recipe', 'StockLog', 'Floor', 'Staff',
  'Customer', 'ServiceRequest', 'Camera', 'Tax', 'Discount',
  'CashLog', 'CreditAccount', 'Reservation', 'Feedback',
  'PushOrder', 'PrinterConfig', 'OnlineConfig', 'LoyaltyConfig',
  'Notification', 'WhatsAppAuth', 'Campaign'
];

/**
 * Perform a backup for a single tenant database
 * @param {string} databaseName - the tenant database name
 * @param {string} cluster - the tenant cluster name
 * @param {string} backupDir - directory to save the backup
 */
const backupTenant = async (databaseName, cluster, backupDir) => {
  const models = await getTenantModels(databaseName);
  const backupId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const payloadData = {};
  const metadataCollections = {};

  // Extract Data
  for (const modelName of TARGET_COLLECTIONS) {
    if (models[modelName]) {
      const Model = models[modelName];
      const docs = await Model.find({}).lean().exec();
      payloadData[modelName] = docs;
      metadataCollections[modelName] = { count: docs.length };
    }
  }

  // Checksum
  const payloadString = JSON.stringify(payloadData);
  const checksum = crypto.createHash('sha256').update(payloadString).digest('hex');

  // Metadata
  const metadata = {
    version: "1.0",
    backupId,
    createdAt,
    tenantId: databaseName,
    cluster,
    collections: metadataCollections,
    checksum
  };

  // Construct full JSON payload
  const fullPayload = JSON.stringify({ metadata, data: payloadData });

  // Encrypt
  const encryptedBuffer = encryptBackup(fullPayload);

  const tmpFilename = `backup_${backupId}.enc.tmp`;
  const finalFilename = `backup_${backupId}.enc`;
  const tmpPath = path.join(backupDir, tmpFilename);
  const finalPath = path.join(backupDir, finalFilename);

  // Atomic Write
  try {
    fs.writeFileSync(tmpPath, encryptedBuffer);

    // In Node.js, fs.renameSync on the same volume is atomic
    fs.renameSync(tmpPath, finalPath);

    return {
      backupId,
      filename: finalFilename,
      status: 'SUCCESS'
    };
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
    throw err;
  }
};

/**
 * Applies retention policy per tenant
 * @param {string} backupDir - Backup directory
 */
const applyRetentionPolicy = (backupDir) => {
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_') && f.endsWith('.enc'));

  const backupsByTenant = {};

  for (const file of files) {
    const filePath = path.join(backupDir, file);
    try {
      const buffer = fs.readFileSync(filePath);
      const decryptedString = decryptBackup(buffer);
      const parsed = JSON.parse(decryptedString);
      const metadata = parsed.metadata;

      if (!metadata || !metadata.tenantId || !metadata.createdAt) {
        continue; // Invalid/unparsable backup metadata
      }

      if (!backupsByTenant[metadata.tenantId]) {
        backupsByTenant[metadata.tenantId] = [];
      }

      backupsByTenant[metadata.tenantId].push({
        file,
        filePath,
        createdAt: new Date(metadata.createdAt)
      });
    } catch (e) {
      // Failed to decrypt or parse - leave it alone (fail-safe cleanup)
      console.warn(`[Backup] Retention warning: Could not validate metadata for ${file}`);
    }
  }

  // Clean up older files
  for (const [tenantId, backups] of Object.entries(backupsByTenant)) {
    // Sort descending by creation date (newest first)
    backups.sort((a, b) => b.createdAt - a.createdAt);

    if (backups.length > RETENTION_LIMIT) {
      const toDelete = backups.slice(RETENTION_LIMIT);
      for (const oldBackup of toDelete) {
        try {
          fs.unlinkSync(oldBackup.filePath);
          console.log(`[Backup] Retention cleanup: Removed old backup ${oldBackup.file}`);
        } catch (err) {
          console.error(`[Backup] Failed to remove old backup ${oldBackup.file}`);
        }
      }
    }
  }
};

export const performBackup = async () => {
  console.log('[Backup] BACKUP_STARTED');
  const summary = {
    discovered: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    results: []
  };

  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('[Backup] Skipping backup, Master DB not connected.');
      return summary;
    }

    // Ensure encryption key is valid before starting anything
    if (!process.env.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY.length !== 64) {
      throw new Error("BACKUP_ENCRYPTION_KEY missing or invalid");
    }

    const backupDir = getBackupDir();
    const activeClients = await Client.find({ status: 'Active' }).lean().exec();
    summary.discovered = activeClients.length;

    for (const client of activeClients) {
      if (!client.databaseName) {
        summary.skipped++;
        summary.results.push({ tenantId: 'UNKNOWN', status: 'SKIPPED', error: 'Missing databaseName' });
        continue;
      }

      try {
        const result = await backupTenant(client.databaseName, client.cluster || 'cluster0', backupDir);
        summary.successful++;
        summary.results.push({
          tenantId: client.databaseName,
          status: 'SUCCESS',
          backupId: result.backupId
        });
        console.log(`[Backup] BACKUP_TENANT_SUCCESS for tenant: ${client.databaseName}`);
      } catch (err) {
        summary.failed++;
        summary.results.push({
          tenantId: client.databaseName,
          status: 'FAILED',
          error: err.message
        });
        console.error(`[Backup] BACKUP_TENANT_FAILED for tenant: ${client.databaseName} - ${err.message}`);
      }
    }

    try {
      applyRetentionPolicy(backupDir);
    } catch (err) {
      console.error('[Backup] Failed to apply retention policy:', err.message);
    }

    console.log(`[Backup] BACKUP_COMPLETED - Discovered: ${summary.discovered}, Success: ${summary.successful}, Failed: ${summary.failed}, Skipped: ${summary.skipped}`);
    return summary;
  } catch (error) {
    console.error(`[Backup] BACKUP_FAILED: ${error.message}`);
    return summary;
  }
};

export const startBackupCron = () => {
  cron.schedule('0 3 * * *', async () => {
    const { default: redisClient } = await import('./redisClient.js');
    // Lock TTL: 1800s (30 minutes) to safely exceed maximum expected backup duration
    const lockToken = await redisClient.acquireLock('cron:backup:lock', 1800);

    // Fail safely if lock isn't acquired OR if Redis is down and returned a local fallback token
    // (We must not execute distributed crons on local fake locks if horizontal scaling is present)
    if (!lockToken || lockToken === 'local-fallback-token') {
      console.log('[Backup] Skipping backup (lock acquired by another worker node or Redis unavailable)');
      return;
    }

    try {
      console.log('[Backup] Running scheduled daily multi-tenant backup...');
      await performBackup();
    } finally {
      await redisClient.releaseLock('cron:backup:lock', lockToken);
    }
  });
};
