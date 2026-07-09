import mongoose from 'mongoose';
import Client from './models/Client.js';

mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0')
  .then(async () => {
    try {
      const client = await Client.findOne({ email: 'maheer05.11.2001@gmail.com' });
      if (client) {
        client.licenseKey = 'MSBILL-A591-7C7B-7D03';
        await client.save();
        console.log("Client updated with licenseKey!");
      } else {
        console.log("Client not found.");
      }
    } catch(e) {
      console.error(e);
    }
    process.exit(0);
  });
