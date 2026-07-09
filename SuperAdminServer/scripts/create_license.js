import mongoose from 'mongoose';
import License from './models/License.js';
import Client from './models/Client.js';
import crypto from 'crypto';

mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0')
  .then(async () => {
    try {
      const client = new Client({
        restaurantName: 'Maheer Restaurant',
        ownerName: 'Maheer',
        email: 'maheer05.11.2001@gmail.com',
        phone: '1234567890',
        plan: 'Premium',
        status: 'Active',
        databaseName: 'client_maheer_123',
        plainTextPassword: 'admin'
      });
      await client.save();
      
      const license = new License({
        client: client._id,
        key: 'MSBILL-A591-7C7B-7D03',
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });
      await license.save();

      console.log("Created Client and License!");
    } catch(e) {
      console.error("DB Error:", e);
    }
    process.exit(0);
  });
