import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cron from 'node-cron';
import mongoose from 'mongoose';
import { getTenantModels } from './tenantManager.js';
import Client from '../models/Client.js';
import BackupLog from '../models/BackupLog.js';
import { encryptBackup, decryptBackup } from './cryptoUtil.js';
import { isStorageEnabled, putObject, headObject, deleteObject } from './storageProvider.js';

const RETENTION_LIMIT = 7;

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
 * Perform a backup for a single tenant database to durable storage
 */
const backupTenantToStorage = async (databaseName, cluster) => {
  const backupId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const datePrefix = createdAt.split('T')[0];
  const objectKey = `backups/${datePrefix}/${backupId}.enc`;

  const log = new BackupLog({
    backupId,
    tenantId: databaseName,
    objectKey,
    status: 'STARTED',
    storageProvider: 's3'
  });
  await log.save();

  try {
    log.status = 'GENERATING';
    await log.save();

    const models = await getTenantModels(databaseName);
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

    // Checksum (over plaintext data)
    const payloadString = JSON.stringify(payloadData);
    const checksum = crypto.createHash('sha256').update(payloadString).digest('hex');
    log.checksum = checksum;

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

    const fullPayload = JSON.stringify({ metadata, data: payloadData });

    log.status = 'ENCRYPTED';
    await log.save();

    // Encrypt
    const encryptedBuffer = encryptBackup(fullPayload);
    log.size = encryptedBuffer.length;

    log.status = 'UPLOADING';
    await log.save();

    try {
      await putObject(objectKey, encryptedBuffer);
    } catch (err) {
      log.status = 'FAILED_UPLOAD';
      log.failureReason = err.message;
      await log.save();
      throw err;
    }

    log.status = 'VERIFIED';
    await log.save();

    try {
      await headObject(objectKey);
    } catch (err) {
      log.status = 'FAILED_VERIFICATION';
      log.failureReason = err.message;
      await log.save();
      throw err;
    }

    log.status = 'COMPLETED';
    log.completedAt = new Date();
    await log.save();

    return {
      backupId,
      objectKey,
      status: 'SUCCESS'
    };
  } catch (err) {
    if (!log.status.startsWith('FAILED_')) {
      log.status = 'FAILED_GENERATION';
      log.failureReason = err.message;
      await log.save();
    }
    throw err;
  }
};

/**
 * Applies retention policy per tenant using BackupLog and StorageProvider
 */
const applyRetentionPolicy = async () => {
  const activeClients = await Client.find({ status: 'Active' }).lean().exec();

  for (const client of activeClients) {
    if (!client.databaseName) continue;

    // Find all COMPLETED backups for this tenant, sorted newest first
    const completedBackups = await BackupLog.find({
      tenantId: client.databaseName,
      status: 'COMPLETED'
    }).sort({ createdAt: -1 }).exec();

    if (completedBackups.length > RETENTION_LIMIT) {
      const candidatesForDeletion = completedBackups.slice(RETENTION_LIMIT);

      for (const log of candidatesForDeletion) {
        try {
          if (log.objectKey) {
            await deleteObject(log.objectKey);
          }
          // Only delete log if object deletion was successful (or didn't exist)
          await BackupLog.deleteOne({ _id: log._id });
          console.log(`[Backup] Retention cleanup: Removed old backup ${log.backupId}`);
        } catch (err) {
          console.error(`[Backup] Retention cleanup failed for ${log.backupId}: ${err.message}`);
          // Preserve BackupLog if deletion failed
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

    if (!isStorageEnabled()) {
      console.log('[Backup] Storage not configured. Failing safely.');
      throw new Error('Object storage is not configured.');
    }

    // Ensure encryption key is valid before starting anything
    if (!process.env.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY.length !== 64) {
      throw new Error("BACKUP_ENCRYPTION_KEY missing or invalid");
    }

    const activeClients = await Client.find({ status: 'Active' }).lean().exec();
    summary.discovered = activeClients.length;

    for (const client of activeClients) {
      if (!client.databaseName) {
        summary.skipped++;
        summary.results.push({ tenantId: 'UNKNOWN', status: 'SKIPPED', error: 'Missing databaseName' });
        continue;
      }

      try {
        const result = await backupTenantToStorage(client.databaseName, client.cluster || 'cluster0');
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
      await applyRetentionPolicy();
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
