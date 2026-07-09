import mongoose from 'mongoose';
import dotenv from 'dotenv';
import InventoryItem from './models/InventoryItem.js';
import StockLog from './models/StockLog.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.useDb('client_maheer_db');
  const InventoryItemModel = db.model('InventoryItem', InventoryItem.schema);
  const StockLogModel = db.model('StockLog', StockLog.schema);
  
  const items = await InventoryItemModel.find();
  for (const item of items) {
    const logs = await StockLogModel.find({ item: item._id });
    let totalPurchased = 0;
    let totalUsed = 0;
    for (const log of logs) {
      if (log.type === 'Stock-In' || log.type === 'Initial Stock') {
        totalPurchased += log.quantityChange;
      } else if (log.type === 'POS Deduction' || log.type === 'Wastage/Adjustment') {
        // quantityChange is negative for these
        totalUsed += Math.abs(log.quantityChange);
      } else if (log.type === 'Audit') {
        if (log.quantityChange > 0) totalPurchased += log.quantityChange;
        else if (log.quantityChange < 0) totalUsed += Math.abs(log.quantityChange);
      }
    }
    item.totalPurchased = totalPurchased;
    item.totalUsed = totalUsed;
    await item.save();
    console.log(`Updated ${item.name}: Purchased=${totalPurchased}, Used=${totalUsed}`);
  }
  process.exit();
}
run();
