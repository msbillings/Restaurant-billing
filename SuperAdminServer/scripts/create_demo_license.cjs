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
  const licenseKey = `MSBILL-DEMO-${generateKeySegment()}-${generateKeySegment()}`;
  
  const username = "demo restaurant";
  const password = "demopassword123";
  const email = "demo@msbillings.com";
  
  const newClient = new Client({
    restaurantName: username,
    ownerName: "Demo User",
    email: email,
    plainTextPassword: password,
    licenseKey: licenseKey,
    status: 'Active',
    databaseName: `client_demo_${Date.now()}`
  });
  const savedClient = await newClient.save();
  
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 10); // 10 Days Demo
  
  const newLicense = new License({
    key: licenseKey,
    client: savedClient._id,
    plan: '10 Days Demo',
    validUntil: validUntil
  });
  await newLicense.save();
  
  console.log("====================================");
  console.log("DEMO ACCOUNT CREATED SUCCESSFULLY (10 DAYS)");
  console.log("====================================");
  console.log("Restaurant Name / Username:", username);
  console.log("Password:", password);
  console.log("License Key:", licenseKey);
  console.log("Expires On:", validUntil.toISOString());
  console.log("====================================");
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
