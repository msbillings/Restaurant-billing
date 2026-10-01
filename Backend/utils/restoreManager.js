import fs from 'fs';
import crypto from 'crypto';
import { getTenantModels } from './tenantManager.js';
import { decryptBackup } from './cryptoUtil.js';
import mongoose from 'mongoose';
import BackupLog from '../models/BackupLog.js';
import Client from '../models/Client.js';
import { getObject } from './storageProvider.js';

/**
 * Restores a tenant backup into a target database.
 * 
 * @param {string} source - Absolute path to the .enc backup file OR a backupId string.
 * @param {string} targetDb - Target database name.
 * @param {Object} options - Restore options.
 * @param {string[]} options.collections - Array of collection names to restore (defaults to all).
 * @param {boolean} options.force - If true, bypass existing data check (DANGEROUS).
 */
export const restoreTenant = async (source, targetDb, options = {}) => {
  const { collections = null, force = false } = options;

  console.log(`[Restore] RESTORE_STARTED for target database: ${targetDb}`);

  let encryptedBuffer;
  let backupLogRecord = null;

  // 1. Locate backup & Obtain payload
  if (fs.existsSync(source)) {
    encryptedBuffer = fs.readFileSync(source);
  } else {
    // Treat source as a backupId
    backupLogRecord = await BackupLog.findOne({ backupId: source }).exec();
    if (!backupLogRecord) {
      throw new Error(`Backup source not found locally and not found in BackupLog: ${source}`);
    }
    if (backupLogRecord.status !== 'COMPLETED') {
      throw new Error(`Backup is not in COMPLETED state. Current state: ${backupLogRecord.status}`);
    }
    if (!backupLogRecord.objectKey) {
      throw new Error(`BackupLog is missing objectKey for backupId: ${source}`);
    }
    try {
      encryptedBuffer = await getObject(backupLogRecord.objectKey);
    } catch (err) {
      throw new Error(`Failed to download backup object from storage: ${err.message}`);
    }
  }

  // 2. Decrypt Payload
  let decryptedString;
  try {
    decryptedString = decryptBackup(encryptedBuffer);
  } catch (err) {
    throw new Error(`Failed to decrypt backup: ${err.message}`);
  }

  // 3. Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(decryptedString);
  } catch (err) {
    throw new Error('Failed to parse decrypted backup JSON');
  }

  const { metadata, data } = parsed;
  if (!metadata || !data) {
    throw new Error('Invalid backup format: Missing metadata or data payload');
  }

  // 4. Verify Checksum
  const payloadString = JSON.stringify(data);
  const checksum = crypto.createHash('sha256').update(payloadString).digest('hex');
  if (checksum !== metadata.checksum) {
    throw new Error(`Checksum mismatch! Backup is corrupted. Expected: ${metadata.checksum}, Got: ${checksum}`);
  }

  // 5. Verify Tenant Boundary (Zero-write Validation)
  if (metadata.tenantId !== targetDb) {
    throw new Error("Backup tenant identity does not match the restore target.");
  }

  if (backupLogRecord && backupLogRecord.tenantId !== targetDb) {
    throw new Error("Backup tenant identity does not match the restore target.");
  }

  // Verify targetDb is a legitimate tenant database
  const clientRecord = await Client.findOne({ databaseName: targetDb, status: 'Active' }).lean().exec();
  if (!clientRecord) {
    throw new Error("Backup tenant identity does not match the restore target.");
  }

  // 6. Resolve Target Models (Only after all validations pass)
  const models = await getTenantModels(targetDb);
  
  const collectionsToRestore = collections && collections.length > 0 
    ? collections 
    : Object.keys(data);

  const results = {
    successful: 0,
    failed: 0,
    details: []
  };

  // 7. Check for Existing Data and Restore
  for (const modelName of collectionsToRestore) {
    if (!data[modelName]) {
      console.warn(`[Restore] Collection ${modelName} not found in backup data.`);
      continue;
    }

    if (!models[modelName]) {
      console.warn(`[Restore] Model ${modelName} not supported by tenant schema.`);
      continue;
    }

    const Model = models[modelName];
    const docsToInsert = data[modelName];
    const expectedCount = metadata.collections[modelName]?.count || docsToInsert.length;

    try {
      // Safety check: Prevent accidental overwrite
      const existingCount = await Model.countDocuments();
      if (existingCount > 0 && !force) {
        throw new Error(`Target collection '${modelName}' already contains ${existingCount} documents. Use force=true to override.`);
      }

      // If forcing, clear the collection first to prevent duplicate _id conflicts
      if (force && existingCount > 0) {
        await Model.deleteMany({});
      }

      // Restore data. Mongoose insertMany handles ObjectId and Date casting automatically
      // based on the Model's schema definitions.
      if (docsToInsert.length > 0) {
        await Model.insertMany(docsToInsert, { ordered: false });
      }

      // Validation
      const postInsertCount = await Model.countDocuments();
      if (postInsertCount !== expectedCount) {
        throw new Error(`Count mismatch after restore. Expected: ${expectedCount}, Actual: ${postInsertCount}`);
      }

      console.log(`[Restore] RESTORE_COLLECTION_SUCCESS: ${modelName} (${postInsertCount} docs)`);
      results.successful++;
      results.details.push({ collection: modelName, status: 'SUCCESS', count: postInsertCount });

    } catch (err) {
      console.error(`[Restore] RESTORE_COLLECTION_FAILED: ${modelName} - ${err.message}`);
      results.failed++;
      results.details.push({ collection: modelName, status: 'FAILED', error: err.message });
      // We do not throw here to allow other collections to attempt restoration
    }
  }

  console.log(`[Restore] RESTORE_COMPLETED. Success: ${results.successful}, Failed: ${results.failed}`);
  return results;
};
