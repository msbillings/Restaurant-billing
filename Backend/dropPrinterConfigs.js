import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_test1_db?appName=Cluster0';

mongoose.connect(MONGO_URI).then(async () => {
  console.log('Connected to DB');
  try {
    await mongoose.connection.db.dropCollection('printerconfigs');
    console.log('Dropped printerconfigs collection');
  } catch (err) {
    console.error('Error dropping collection', err.message);
  }
  mongoose.connection.close();
});
