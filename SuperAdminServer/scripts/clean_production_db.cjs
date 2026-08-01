const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI;

// List of restaurant names to keep (case-insensitive substrings)
const KEEP_RESTAURANTS = [
  'al mandi palace',
  'waffles',
  'star chicken',
  'test restaurant 1',
  'test restaurant 2',
  'test restaurant 3'
];

// Helper to check if a restaurant name should be kept
function shouldKeep(restaurantName) {
  if (!restaurantName) return false;
  const lowerName = restaurantName.toLowerCase();
  // Keep if the name exactly matches or contains any of the keep strings
  return KEEP_RESTAURANTS.some(keep => lowerName.includes(keep) || lowerName === keep);
}

// Master collections to clean up orphaned data
const COLLECTIONS_TO_DROP = [
  'bills', 'categories', 'customers', 'discounts', 'expenses',
  'feedbacks', 'floors', 'inventories', 'inventoryitems', 'menuitems',
  'menus', 'onlineconfigs', 'printerconfigs', 'pushorders', 'recipes',
  'reservations', 'servicerequests', 'settings', 'staffs', 'stocklogs', 'taxes',
  'cashlogs', 'broadcasts', 'contacts', 'creditaccounts'
];

async function cleanup() {
  if (!MONGO_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to Master Database');

  const db = mongoose.connection.db;

  try {
    // 1. Clean up `clients` collection
    console.log('\n--- Scanning `clients` collection ---');
    const clientsColl = db.collection('clients');
    const licensesColl = db.collection('licenses');
    const clients = await clientsColl.find({}).toArray();

    for (const client of clients) {
      if (shouldKeep(client.restaurantName)) {
        console.log(`✅ Keeping Client: ${client.restaurantName} (${client.databaseName || 'No DB'})`);
      } else {
        console.log(`❌ DELETING Client: ${client.restaurantName}`);
        
        // Drop the actual shop database
        if (client.databaseName) {
          console.log(`   -> Dropping database: ${client.databaseName}`);
          try {
            await mongoose.connection.useDb(client.databaseName).dropDatabase();
          } catch (e) {
             console.log(`      (Failed to drop database or didn't exist)`);
          }
        }

        // Delete associated licenses
        await licensesColl.deleteMany({ client: client._id });
        console.log(`   -> Deleted associated licenses`);

        // Delete from clients collection
        await clientsColl.deleteOne({ _id: client._id });
        console.log(`   -> Removed master record from clients`);
      }
    }

    // 2. Clean up `tenants` collection
    console.log('\n--- Scanning `tenants` collection ---');
    const tenantsColl = db.collection('tenants');
    const tenants = await tenantsColl.find({}).toArray();

    for (const tenant of tenants) {
      // Don't accidentally keep test restaurant 10 when "test restaurant 1" is in list.
      // So let's do a strict match for the "Test Restaurants" just in case.
      let keep = shouldKeep(tenant.restaurantName);
      // Extra safety for "test restaurant 1" vs "test restaurant 10"
      if (tenant.restaurantName && tenant.restaurantName.toLowerCase().includes('test restaurant 10')) {
         keep = false; 
      }
      
      if (keep) {
        console.log(`✅ Keeping Tenant: ${tenant.restaurantName} (${tenant.dbName || 'No DB'})`);
      } else {
        console.log(`❌ DELETING Tenant: ${tenant.restaurantName}`);
        
        // Drop the actual shop database
        if (tenant.dbName) {
          console.log(`   -> Dropping database: ${tenant.dbName}`);
          try {
             await mongoose.connection.useDb(tenant.dbName).dropDatabase();
          } catch (e) {
             console.log(`      (Failed to drop database or didn't exist)`);
          }
        }

        // Delete from tenants collection
        await tenantsColl.deleteOne({ _id: tenant._id });
        console.log(`   -> Removed master record from tenants`);
      }
    }

    // 3. Drop orphaned collections from the master database
    console.log('\n--- Cleaning up orphaned collections in master database ---');
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);

    for (const collName of COLLECTIONS_TO_DROP) {
      if (existingNames.includes(collName)) {
        console.log(`🗑️ Dropping orphaned collection: ${collName}`);
        await db.dropCollection(collName);
      }
    }

    console.log('\n🎉 Cleanup completely finished successfully!');

  } catch (error) {
    console.error('\n❌ An error occurred during cleanup:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

cleanup();
