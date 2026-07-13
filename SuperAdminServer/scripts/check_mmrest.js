import mongoose from 'mongoose';

const MONGO_URI_SUPERADMIN = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

const clientSchema = new mongoose.Schema({}, { strict: false });
const userSchema = new mongoose.Schema({}, { strict: false });

async function checkClient() {
  try {
    const superAdminConn = await mongoose.createConnection(MONGO_URI_SUPERADMIN).asPromise();
    const Client = superAdminConn.model('Client', clientSchema, 'clients');
    
    const client = await Client.findOne({ email: 'mmrest@gmail.com' });
    if (!client) {
      console.log('Client not found');
      process.exit(1);
    }
    
    console.log('--- Client Found ---');
    console.log('Email:', client.email);
    console.log('License Key:', client.licenseKey);
    console.log('Database Name:', client.databaseName);
    
    const dbName = client.databaseName;
    const MONGO_URI_CLIENT = `mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/${dbName}?appName=Cluster0`;
    
    const clientConn = await mongoose.createConnection(MONGO_URI_CLIENT).asPromise();
    const User = clientConn.model('User', userSchema, 'users');
    
    const users = await User.find({});
    console.log('\n--- Users in ' + dbName + ' ---');
    users.forEach(u => {
      console.log(`Role: ${u.role} | Username: ${u.username}`);
    });
    
    await clientConn.close();
    await superAdminConn.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkClient();
