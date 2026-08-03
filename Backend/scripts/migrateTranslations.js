/**
 * Migration Script: Translate all existing menu items across all tenants.
 * 
 * Usage: node scripts/migrateTranslations.js
 * 
 * This script:
 * 1. Connects to the main MongoDB database
 * 2. Finds all tenant databases
 * 3. For each tenant, finds all menu items without translations
 * 4. Translates each item's name and description
 * 5. Updates the item in the database
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { translateMenuItem } from '../services/translationService.js';

dotenv.config();

const BATCH_DELAY = 2000; // 2 seconds between items to avoid rate limiting

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function migrateTranslations() {
  try {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Migration] Connected!');

    const mainDb = mongoose.connection.db;

    // Get all databases (tenants)
    const adminDb = mainDb.admin();
    let databases = [];
    try {
      const result = await adminDb.listDatabases();
      databases = result.databases
        .map(db => db.name)
        .filter(name => !['admin', 'local', 'config'].includes(name));
    } catch (err) {
      // If we can't list databases (permissions), just use the current one
      console.log('[Migration] Cannot list all databases, using current connection only');
      databases = [mongoose.connection.db.databaseName];
    }

    console.log(`[Migration] Found ${databases.length} databases to process`);

    for (const dbName of databases) {
      console.log(`\n[Migration] Processing database: ${dbName}`);
      
      let tenantConn;
      try {
        tenantConn = mongoose.createConnection(process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`));
        await tenantConn.asPromise();
      } catch (err) {
        console.error(`[Migration] Failed to connect to ${dbName}:`, err.message);
        continue;
      }

      const menuCollection = tenantConn.db.collection('menus');
      
      // Find items that don't have translations yet
      const items = await menuCollection.find({
        $or: [
          { nameTranslations: { $exists: false } },
          { 'nameTranslations.hi': '' },
          { 'nameTranslations.hi': { $exists: false } }
        ]
      }).toArray();

      console.log(`[Migration] Found ${items.length} items to translate in ${dbName}`);

      let translated = 0;
      let failed = 0;

      for (const item of items) {
        try {
          console.log(`  Translating: "${item.name}"...`);
          const translations = await translateMenuItem(item.name, item.description);

          await menuCollection.updateOne(
            { _id: item._id },
            {
              $set: {
                nameTranslations: translations.nameTranslations,
                descriptionTranslations: translations.descriptionTranslations
              }
            }
          );

          translated++;
          console.log(`  ✅ Done (${translated}/${items.length})`);

          // Delay to avoid rate limiting
          await sleep(BATCH_DELAY);
        } catch (err) {
          failed++;
          console.error(`  ❌ Failed for "${item.name}":`, err.message);
        }
      }

      console.log(`[Migration] ${dbName}: ${translated} translated, ${failed} failed`);
      
      await tenantConn.close();
    }

    console.log('\n[Migration] ✅ All done!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Fatal error:', err);
    process.exit(1);
  }
}

migrateTranslations();
