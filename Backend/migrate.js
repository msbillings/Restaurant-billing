import _crypto from 'crypto';
import dns from 'dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) { }
if (!globalThis.crypto) {
  try { Object.defineProperty(globalThis, 'crypto', { value: _crypto }); } catch (e) { }
}

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('d:/restaurant/Restaurant-billing/Backend/.env') });

const DB_NAME = 'client_seemaruchulu_6ab122';

async function migrateCluster() {
    let sourceConn, destConn, masterConn;
    try {
        console.log('Connecting to clusters...');
        sourceConn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
        destConn = await mongoose.createConnection(process.env.MONGO_URI_CLUSTER2).asPromise();
        
        // Also connect to master DB
        masterConn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();

        const sourceDb = sourceConn.useDb(DB_NAME);
        const destDb = destConn.useDb(DB_NAME);

        console.log(`Getting collections from source database ${DB_NAME} on cluster0...`);
        const collections = await sourceDb.db.listCollections().toArray();
        
        console.log(`Found ${collections.length} collections. Dropping target database on cluster2 first to ensure a clean migration...`);
        await destDb.db.dropDatabase();

        for (const col of collections) {
            const colName = col.name;
            console.log(`Migrating collection: ${colName}`);
            
            const docs = await sourceDb.collection(colName).find({}).toArray();
            if (docs.length > 0) {
                await destDb.collection(colName).insertMany(docs);
                console.log(`  -> Inserted ${docs.length} documents into ${colName}.`);
            } else {
                console.log(`  -> ${colName} is empty. Skipped.`);
            }
        }

        console.log('Data migration complete. Updating master registry to point to cluster2...');
        const mscurechainDb = masterConn.useDb('mscurechain');
        const updateResult = await mscurechainDb.collection('clients').updateOne(
            { databaseName: DB_NAME },
            { $set: { cluster: 'cluster2' } }
        );
        console.log(`Master registry update result: ${updateResult.modifiedCount > 0 ? 'Success' : 'No changes made'}`);
        
        console.log('Migration finished successfully!');

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        if (sourceConn) await sourceConn.close();
        if (destConn) await destConn.close();
        if (masterConn) await masterConn.close();
    }
}

migrateCluster();
