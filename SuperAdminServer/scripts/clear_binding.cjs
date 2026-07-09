require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/superadmin_db').then(async () => {
  console.log("Connected to DB");
  const LicenseSchema = new mongoose.Schema({
    key: String,
    boundMachineId: String,
    status: String
  }, { strict: false });
  const License = mongoose.model('License', LicenseSchema);
  
  const result = await License.updateOne({ key: 'MSBILL-A591-7C7B-7D03' }, { $set: { boundMachineId: null, status: 'active' } });
  console.log(result);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
