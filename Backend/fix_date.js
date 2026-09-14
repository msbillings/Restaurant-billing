import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    // If tenant logic is used, we might need to get the specific DB, 
    // but the default mscurechain DB is likely the one for "Anand's Restaurant" if running locally or demo
    // Wait, let's just update across all DBs or the primary DB for MS0401
    const Bill = mongoose.model('Bill', new mongoose.Schema({}, { strict: false }));
    
    // Check primary db first
    let result = await Bill.updateOne({ billNumber: 'MS0401' }, { $set: { createdAt: new Date() } });
    console.log('Result primary:', result);
    
    // If not found, let's search all DBs just to be sure
    if (result.matchedCount === 0) {
      const admin = mongoose.connection.db.admin();
      const dbs = await admin.listDatabases();
      for (const dbInfo of dbs.databases) {
        if (dbInfo.name.startsWith('restaurant_billing_') || dbInfo.name === 'mscurechain') {
          const tenantDb = mongoose.connection.useDb(dbInfo.name);
          const TenantBill = tenantDb.model('Bill', new mongoose.Schema({}, { strict: false }));
          const res = await TenantBill.updateOne({ billNumber: 'MS0401' }, { $set: { createdAt: new Date() } });
          if (res.matchedCount > 0) {
            console.log(`Found and updated in ${dbInfo.name}`);
            break;
          }
        }
      }
    }

    process.exit(0);
  });
