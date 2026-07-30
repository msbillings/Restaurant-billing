const mongoose = require('mongoose');
async function test() {
  try {
    console.log("Testing with j...");
    await mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0');
    console.log("SUCCESS WITH j");
    process.exit(0);
  } catch(e) {
    console.log("Failed with j");
  }
  
  try {
    console.log("Testing without j...");
    await mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0');
    console.log("SUCCESS WITHOUT j");
    process.exit(0);
  } catch(e) {
    console.log("Failed without j");
    process.exit(1);
  }
}
test();
