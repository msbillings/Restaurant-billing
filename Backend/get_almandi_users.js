import mongoose from 'mongoose';
const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

async function fetchUsers() {
  await mongoose.connect(uri);
  // Find Al Mandi client in superadmin db
  const Client = mongoose.model('Client', new mongoose.Schema({}, { strict: false }));
  const clients = await Client.find({});
  let almandi = clients.find(c => c.toObject().restaurantName && c.toObject().restaurantName.toLowerCase().includes('mandi'));
  if (!almandi) {
    almandi = clients.find(c => c.toObject().email && c.toObject().email.toLowerCase().includes('mandi'));
  }
  
  if (almandi) {
    const cObj = almandi.toObject();
    console.log('Client found:');
    console.log('Email:', cObj.email);
    console.log('Password:', cObj.plainTextPassword || 'Not found in plain text');
    console.log('License:', cObj.licenseKey);
    console.log('Database:', cObj.databaseName);
    
    // Now fetch users from their tenant DB
    const tenantUri = uri.replace('/mscurechain?', `/${cObj.databaseName}?`);
    const tenantConn = await mongoose.createConnection(tenantUri).asPromise();
    const User = tenantConn.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({});
    console.log('\nTenant Users:');
    users.forEach(u => {
      console.log(`- ${u.toObject().role}: ${u.toObject().username}`);
    });
    tenantConn.close();
  } else {
    console.log('Al Mandi client not found in SuperAdmin DB.');
  }
  mongoose.disconnect();
}
fetchUsers();
