import mongoose from 'mongoose';
import Client from './models/Client.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const clients = await Client.find({ restaurantName: /ya habibi/i });
    if (clients.length === 0) {
      console.log('No clients found with name Ya Habibi');
    } else {
      clients.forEach(client => {
        console.log(`Restaurant Name: ${client.restaurantName}`);
        console.log(`Owner Name: ${client.ownerName}`);
        console.log(`Email: ${client.email}`);
        console.log(`Password: ${client.plainTextPassword}`);
        console.log(`Status: ${client.status}`);
      });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
