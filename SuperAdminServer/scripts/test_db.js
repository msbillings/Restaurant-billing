import mongoose from 'mongoose';
import License from './models/License.js';
mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0')
  .then(async () => {
    try {
      const l = await License.findOne({ key: 'MSBILL-A591-7C7B-7D03' });
      console.log("License found:", !!l);
      if(l) console.log("Client ID:", l.client);
    } catch(e) {
      console.error("DB Error:", e);
    }
    process.exit(0);
  });
