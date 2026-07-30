import mongoose from 'mongoose';
const baseUri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net';

async function checkDB(dbName) {
  const uri = `${baseUri}/${dbName}?appName=Cluster0`;
  const conn = await mongoose.createConnection(uri).asPromise();
  
  const MenuCategory = conn.model('MenuCategory', new mongoose.Schema({}, { strict: false }));
  const MenuItem = conn.model('MenuItem', new mongoose.Schema({}, { strict: false }));
  
  const cats = await MenuCategory.countDocuments();
  const items = await MenuItem.countDocuments();
  
  // Try to find if there are any Mandi items
  const mandiItems = await MenuItem.find({ 
    name: { $regex: /mandi/i } 
  });
  
  console.log(`DB [${dbName}]: ${cats} categories, ${items} items. Mandi items found: ${mandiItems.length}`);
  if (mandiItems.length > 0) {
    console.log("Found Mandi items in:", dbName);
  }
  
  await conn.close();
}

async function main() {
  await checkDB('msbillings');
  await checkDB('msbillings_msbillings');
  await checkDB('client_demo_db');
}
main().catch(console.error);
