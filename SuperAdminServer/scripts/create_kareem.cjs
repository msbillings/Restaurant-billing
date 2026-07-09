require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/superadmin_db').then(async () => {
  console.log("Connected to DB");
  
  const LicenseSchema = new mongoose.Schema({
    key: String,
    client: mongoose.Schema.Types.ObjectId,
    plan: String,
    validUntil: Date,
    status: { type: String, default: 'active' }
  }, { strict: false });
  const License = mongoose.model('License', LicenseSchema);
  
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
  const Client = mongoose.model('Client', ClientSchema);
  
  // Create client
  const generateKeySegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  const licenseKey = `MSBILL-${generateKeySegment()}-${generateKeySegment()}-${generateKeySegment()}`;
  
  const newClient = new Client({
    restaurantName: 'kareem',
    ownerName: 'kareem',
    email: 'kareem@msbillings.com',
    plainTextPassword: 'kareem',
    licenseKey: licenseKey,
    status: 'Active'
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
  
  console.log("SUCCESS_KEY:" + licenseKey);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
