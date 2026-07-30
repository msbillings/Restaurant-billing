import mongoose from 'mongoose';

const sourceUri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_maheer_123?appName=Cluster0';
const targetUri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_almandi_db?appName=Cluster0';

async function migrate() {
  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  const targetConn = await mongoose.createConnection(targetUri).asPromise();

  // The collections we want to migrate
  const collectionsToMigrate = [
    'floors',
    'bills',
    'expenses',
    'customers',
    'inventoryitems',
    'recipes',
    'settings',
    'stocklogs'
  ];

  for (const collName of collectionsToMigrate) {
    console.log(`Migrating ${collName}...`);
    // Define generic schemas for both source and target
    const SourceModel = sourceConn.model(collName, new mongoose.Schema({}, { strict: false }), collName);
    const TargetModel = targetConn.model(collName, new mongoose.Schema({}, { strict: false }), collName);

    const docs = await SourceModel.find({}).lean();
    console.log(`Found ${docs.length} documents in ${collName}.`);

    if (docs.length > 0) {
      await TargetModel.deleteMany({});
      await TargetModel.insertMany(docs);
      console.log(`Successfully migrated ${collName}!`);
    } else {
      console.log(`Skipped ${collName} (no data).`);
    }
  }

  await sourceConn.close();
  await targetConn.close();
  console.log("Full migration finished.");
}

migrate().catch(console.error);
