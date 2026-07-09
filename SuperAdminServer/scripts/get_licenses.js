import mongoose from 'mongoose';
import License from './models/License.js';
mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0')
  .then(async () => {
    try {
      const licenses = await License.find({});
      console.log("Total Licenses in DB:", licenses.length);
      licenses.forEach(l => {
         console.log("Key:", l.key, "Valid Until:", l.validUntil, "Client:", l.client);
      });
    } catch(e) {
      console.error("DB Error:", e);
    }
    process.exit(0);
  });
