import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bill from './models/Bill.js';

dotenv.config();

async function run() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  const BillModel = mongoose.connection.useDb('client_maheer_db').model('Bill', Bill.schema);
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const recentBills = await BillModel.find({ createdAt: { $gte: todayStart } }).sort({ updatedAt: -1 }).limit(5).lean();
  
  console.log('Recent 5 bills:');
  recentBills.forEach(b => {
    console.log(`- ${b.billNumber} | Table: ${b.tableNo} | Status: ${b.status} | isEdited: ${b.isEdited} | KOTs: ${b.kots?.length} | editHistory: ${b.editHistory?.length}`);
  });
  
  const edited = await BillModel.find({ isEdited: true, createdAt: { $gte: todayStart } }).lean();
  console.log(`\nFound ${edited.length} edited bills for today.`);
  
  process.exit(0);
}
run();
