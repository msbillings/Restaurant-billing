import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import BackupLog from '../models/BackupLog.js';
import Client from '../models/Client.js';
import { decryptBackup } from './cryptoUtil.js';
import { putObject, headObject, isStorageEnabled } from './storageProvider.js';

export const migrateLocalBackups = async () => {
  console.log('[Migration] Starting local backup migration to durable storage...');
  
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Master DB must be connected to run migration.');
  }

  if (!isStorageEnabled()) {
    throw new Error('Storage provider must be configured and enabled to run migration.');
  }

  const baseDir = process.env.APP_USER_DATA_PATH || process.cwd();
  const backupDir = path.join(baseDir, 'backups');

  if (!fs.existsSync(backupDir)) {
    console.log('[Migration] No local backups directory found. Nothing to migrate.');
    return;
  }

  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_') && f.endsWith('.enc'));

  for (const file of files) {
    const filePath = path.join(backupDir, file);
    console.log(`[Migration] Processing ${file}...`);

    let encryptedBuffer;
    try {
      encryptedBuffer = fs.readFileSync(filePath);
    } catch (err) {
      console.error(`[Migration] Failed to read file ${file}: ${err.message}`);
      continue;
    }

    let decryptedString;
    try {
      decryptedString = decryptBackup(encryptedBuffer);
    } catch (err) {
      console.error(`[Migration] Failed to decrypt ${file}: ${err.message}`);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(decryptedString);
    } catch (err) {
      console.error(`[Migration] Failed to parse JSON for ${file}`);
      continue;
    }

    const { metadata, data } = parsed;
    if (!metadata || !data) {
      console.error(`[Migration] Invalid structure for ${file}`);
      continue;
    }

    // Verify Checksum
    const payloadString = JSON.stringify(data);
    const checksum = crypto.createHash('sha256').update(payloadString).digest('hex');
    if (checksum !== metadata.checksum) {
      console.error(`[Migration] Checksum mismatch for ${file}`);
      continue;
    }

    const tenantId = metadata.tenantId;
    const clientRecord = await Client.findOne({ databaseName: tenantId }).lean().exec();
    if (!clientRecord) {
      console.error(`[Migration] Tenant ${tenantId} not found for ${file}. Skipping.`);
      continue;
    }

    const backupId = metadata.backupId;
    const createdAt = metadata.createdAt;
    const datePrefix = createdAt.split('T')[0];
    const objectKey = `backups/${datePrefix}/${backupId}.enc`;

    // Idempotency check
    let log = await BackupLog.findOne({ backupId }).exec();
    
    if (log && log.status === 'COMPLETED' && log.objectKey === objectKey) {
      try {
        await headObject(objectKey);
        console.log(`[Migration] Backup ${backupId} already fully migrated. Renaming file.`);
        fs.renameSync(filePath, `${filePath}.migrated`);
        continue;
      } catch (err) {
        // Object missing in storage, need to re-upload
        console.log(`[Migration] Object missing in storage for ${backupId}. Will re-upload.`);
      }
    }

    if (!log) {
      log = new BackupLog({
        backupId,
        tenantId,
        objectKey,
        status: 'UPLOADING',
        createdAt: new Date(createdAt),
        size: encryptedBuffer.length,
        checksum: metadata.checksum,
        storageProvider: 's3'
      });
      await log.save();
    } else {
      log.status = 'UPLOADING';
      log.objectKey = objectKey;
      log.size = encryptedBuffer.length;
      log.checksum = metadata.checksum;
      await log.save();
    }

    try {
      await putObject(objectKey, encryptedBuffer);
    } catch (err) {
      log.status = 'FAILED_UPLOAD';
      log.failureReason = err.message;
      await log.save();
      console.error(`[Migration] Failed upload for ${file}: ${err.message}`);
      continue;
    }

    log.status = 'VERIFIED';
    await log.save();

    try {
      await headObject(objectKey);
    } catch (err) {
      log.status = 'FAILED_VERIFICATION';
      log.failureReason = err.message;
      await log.save();
      console.error(`[Migration] Failed verification for ${file}: ${err.message}`);
      continue;
    }

    log.status = 'COMPLETED';
    log.completedAt = new Date();
    await log.save();

    console.log(`[Migration] Successfully migrated ${file}`);
    fs.renameSync(filePath, `${filePath}.migrated`);
  }

  console.log('[Migration] Migration process complete.');
};
