import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from './models/Bill.js';
import { generateKOT } from './controllers/billController.js'; // Can't easily call express controller

dotenv.config();

async function run() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  const BillModel = mongoose.connection.useDb('client_maheer_db').model('Bill', Bill.schema);
  
  // Find MS0033
  const order = await BillModel.findOne({ billNumber: 'MS0033' });
  if (!order) {
    console.log('MS0033 not found');
    process.exit(0);
  }
  
  // Fake a KOT if it doesn't have one
  if (!order.kots || order.kots.length === 0) {
    order.kots = [{ kotNumber: 'KOT-1', items: order.items, createdAt: new Date() }];
    await order.save();
    console.log('Added initial KOT to MS0033');
  }
  
  const previousState = {
    items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
    subtotal: order.subtotal,
    totalDiscount: order.discount || 0,
    totalTax: order.tax || 0,
    total: order.total
  };

  // Change quantity
  const updatedItems = order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total }));
  if (updatedItems.length > 0) {
    updatedItems[0].quantity += 1; // increase qty
    updatedItems[0].total = updatedItems[0].quantity * updatedItems[0].price;
  }
  
  const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);

  const newState = {
    items: updatedItems,
    subtotal: subtotal,
    totalDiscount: order.discount || 0,
    totalTax: order.tax || 0,
    total: subtotal
  };

  const hasChanged = JSON.stringify(previousState) !== JSON.stringify(newState);
  
  if (hasChanged && order.kots && order.kots.length > 0) {
    order.editHistory = order.editHistory || [];
    order.editHistory.push({
      editedAt: new Date(),
      previousState,
      newState
    });
    order.isEdited = true;
    console.log('Edit history pushed! isEdited = true');
  }
  
  order.items = updatedItems;
  order.subtotal = subtotal;
  order.total = subtotal;
  await order.save();
  
  console.log('Successfully simulated edit on MS0033!');
  process.exit(0);
}
run();
