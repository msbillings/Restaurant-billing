require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

mongoose.connect(mongoUri).then(async () => {
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
  
  const generateKeySegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  const licenseKey = `MSBILL-${generateKeySegment()}-${generateKeySegment()}-${generateKeySegment()}`;
  
  // Here restaurantName becomes the initial login username on Desktop app startup
  const username = "admin";
  const password = "adminpassword123";
  const email = "newclient@msbillings.com";
  
  const newClient = new Client({
    restaurantName: username,
    ownerName: "New User",
    email: email,
    plainTextPassword: password,
    licenseKey: licenseKey,
    status: 'Active',
    databaseName: `client_admin_${Date.now()}`
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
  console.log("SIMPLE ACCOUNT CREATED SUCCESSFULLY");
  console.log("====================================");
  console.log("Username:", username);
  console.log("Password:", password);
  console.log("License Key:", licenseKey);
  console.log("====================================");
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
