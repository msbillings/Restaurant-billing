const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to SuperAdmin DB");
  
  const LicenseSchema = new mongoose.Schema({
    key: String,
    client: mongoose.Schema.Types.ObjectId
  }, { strict: false });
  const License = mongoose.model('License', LicenseSchema);
  
  const ClientSchema = new mongoose.Schema({
    hardwareId: String,
    restaurantName: String
  }, { strict: false });
  const Client = mongoose.model('Client', ClientSchema);
  
  // Find MM Restaurant
  const license = await License.findOne({ key: 'MSBILL-MM01-REST-2026' });
  if (!license) {
     console.log("License not found");
     process.exit(1);
  }
  
  const client = await Client.findOne({ _id: license.client });
  console.log("Found client:", client.restaurantName, "with hardwareId:", client.hardwareId);
  
  // Clear it
  const result = await Client.updateOne({ _id: license.client }, { $set: { hardwareId: null } });
  console.log("Cleared hardwareId for MM Restaurant:", result);
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
