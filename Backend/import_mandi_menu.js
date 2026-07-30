import mongoose from 'mongoose';
import fs from 'fs';

const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_almandi_db?appName=Cluster0';

const MenuCategorySchema = new mongoose.Schema({}, { strict: false });
const MenuItemSchema = new mongoose.Schema({}, { strict: false });

async function migrateMenu() {
  await mongoose.connect(uri);
  const MenuCategory = mongoose.model('MenuCategory', MenuCategorySchema);
  const MenuItem = mongoose.model('MenuItem', MenuItemSchema);

  // Read backup
  const backupData = JSON.parse(fs.readFileSync('backups/backup_2026-07-10.json', 'utf8'));
  
  if (!backupData.categories || !backupData.menuItems) {
    console.log("No categories or menu items found in backup.");
    process.exit(1);
  }

  console.log(`Found ${backupData.categories.length} categories and ${backupData.menuItems.length} menu items in backup.`);
  
  // Clear existing (it should be empty anyway)
  await MenuCategory.deleteMany({});
  await MenuItem.deleteMany({});

  // Insert Categories
  if (backupData.categories.length > 0) {
    const catsToInsert = backupData.categories.map(c => {
      let { _id, ...rest } = c;
      if (_id && _id.$oid) _id = _id.$oid;
      return { _id, ...rest };
    });
    await MenuCategory.insertMany(catsToInsert);
    console.log("Categories migrated.");
  }

  // Insert Menu Items
  if (backupData.menuItems.length > 0) {
    const itemsToInsert = backupData.menuItems.map(i => {
      let { _id, ...rest } = i;
      if (_id && _id.$oid) _id = _id.$oid;
      return { _id, ...rest };
    });
    await MenuItem.insertMany(itemsToInsert);
    console.log("Menu Items migrated.");
  }

  console.log("Migration complete!");
  mongoose.disconnect();
}
migrateMenu().catch(console.error);
