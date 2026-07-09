require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0').then(async () => {
  console.log("Connected to DB");
  
  const LicenseSchema = new mongoose.Schema({
    key: String,
    client: mongoose.Schema.Types.ObjectId,
    plan: String,
    validUntil: Date,
    status: { type: String, default: 'active' }
  }, { strict: false });
  const License = mongoose.models.License || mongoose.model('License', LicenseSchema);
  
  const ClientSchema = new mongoose.Schema({
    restaurantName: String,
    ownerName: String,
    email: String,
    plainTextPassword: String,
    licenseKey: String,
    status: { type: String, default: 'Active' },
    hardwareId: String,
    databaseName: String
  }, { strict: false });
  const Client = mongoose.models.Client || mongoose.model('Client', ClientSchema);
  
  // Create client
  const generateKeySegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  const licenseKey = `MSBILL-${generateKeySegment()}-${generateKeySegment()}-${generateKeySegment()}`;
  
  const newClient = new Client({
    restaurantName: 'ya habibi restaurant',
    ownerName: 'ya habibi',
    email: 'yahabibi@msbillings.com',
    plainTextPassword: 'yahabibi@1',
    licenseKey: licenseKey,
    status: 'Active',
    databaseName: 'client_yahabibi'
  });
  const savedClient = await newClient.save();
  
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 100); // Lifetime
  
  const newLicense = new License({
    key: licenseKey,
    client: savedClient._id,
    plan: 'Lifetime',
    validUntil: validUntil
  });
  await newLicense.save();
  
  console.log("====================================");
  console.log("SUCCESS_KEY:" + licenseKey);
  console.log("Username (Email): yahabibi@msbillings.com");
  console.log("Password: yahabibi@1");
  console.log("====================================");
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
