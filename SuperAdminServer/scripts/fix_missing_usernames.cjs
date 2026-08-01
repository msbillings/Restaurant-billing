const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const clientsColl = db.collection('clients');
  const clients = await clientsColl.find({}).toArray();
  
  let updated = 0;
  for (const c of clients) {
    if (!c.staffAccounts || c.staffAccounts.length === 0) {
      // Create a default admin user
      const prefix = c.email.split('@')[0];
      // special mapping for test users to look nice
      let username = prefix;
      if (prefix === 'admin') username = 'admin';
      
      const newStaff = [{
        role: 'Admin',
        username: username,
        plainTextPassword: c.plainTextPassword
      }];
      
      await clientsColl.updateOne(
        { _id: c._id },
        { $set: { staffAccounts: newStaff } }
      );
      console.log('Updated', c.restaurantName, 'with username:', username);
      updated++;
    }
  }
  console.log('Total updated:', updated);
  process.exit(0);
}
fix().catch(console.error);
