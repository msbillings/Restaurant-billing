import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import mongoose from 'mongoose';

mongoose.connect(process.env.MONGO_URI)
  .then(() => mongoose.connection.db.collection('printerconfigs').updateOne(
    { bluetoothAddress: /C8478CF51148/i },
    { $set: { bluetoothAddress: 'C8478CE51148' } }
  ))
  .then(res => {
    console.log('Updated:', res.modifiedCount);
    process.exit(0);
  })
  .catch(console.error);
