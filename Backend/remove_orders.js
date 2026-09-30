import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MarketOrder from './models/MarketOrder.js';

dotenv.config();

const deleteOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    const result = await MarketOrder.deleteMany({});
    console.log(`Deleted ${result.deletedCount} orders`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

deleteOrders();
