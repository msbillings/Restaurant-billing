import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from './models/Bill.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  // Find a Billed order
  const order = await Bill.findOne({ status: 'Billed' }).sort({ createdAt: -1 });
  if (!order) {
    console.log('No billed order found');
    process.exit(0);
  }
  
  console.log('Found order:', order.billNumber, order.tableNo);
  
  // Reopen it
  order.status = 'Open';
  await order.save();
  
  // Simulate saveOrder
  const previousState = {
    items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
    subtotal: order.subtotal,
    totalDiscount: order.discount || 0,
    totalTax: order.tax || 0,
    total: order.total
  };

  // Change quantity of first item
  const updatedItems = order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total }));
  if (updatedItems.length > 0) {
    updatedItems[0].quantity += 1;
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
  console.log('Has changed?', hasChanged);
  
  if (hasChanged && order.kots && order.kots.length > 0) {
    order.editHistory = order.editHistory || [];
    order.editHistory.push({
      editedAt: new Date(),
      previousState,
      newState
    });
    order.isEdited = true;
    console.log('Edit history added!');
  }
  
  order.items = updatedItems;
  await order.save();
  
  console.log('Saved. isEdited:', order.isEdited);
  
  process.exit(0);
}
run();
