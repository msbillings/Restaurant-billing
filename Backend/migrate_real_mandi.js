import mongoose from 'mongoose';
const sourceUri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_maheer_123?appName=Cluster0';
const targetUri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_almandi_db?appName=Cluster0';

async function migrate() {
  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  const targetConn = await mongoose.createConnection(targetUri).asPromise();
  
  const SMenu = sourceConn.model('Menu', new mongoose.Schema({}, { strict: false }));
  const SCat = sourceConn.model('Category', new mongoose.Schema({}, { strict: false }));
  
  const TMenu = targetConn.model('Menu', new mongoose.Schema({}, { strict: false }));
  const TCat = targetConn.model('Category', new mongoose.Schema({}, { strict: false }));

  console.log("Reading data from source...");
  const menus = await SMenu.find({}).lean();
  const cats = await SCat.find({}).lean();
  
  console.log(`Found ${menus.length} menus and ${cats.length} categories.`);
  
  if (menus.length > 0) {
    await TMenu.deleteMany({});
    await TMenu.insertMany(menus);
    console.log("Migrated menus!");
  }
  
  if (cats.length > 0) {
    await TCat.deleteMany({});
    await TCat.insertMany(cats);
    console.log("Migrated categories!");
  }

  await sourceConn.close();
  await targetConn.close();
  console.log("Migration finished.");
}
migrate().catch(console.error);
