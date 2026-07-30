import mongoose from 'mongoose';
import ExpenseDefault from './models/Expense.js';

const uri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_almandi_db?appName=Cluster0';

async function main() {
  await mongoose.connect(uri);
  
  // Create an explicit model for client_almandi_db
  const Expense = mongoose.connection.model('Expense', ExpenseDefault.schema);
  
  try {
    const newExpense = new Expense({
      amount: 10,
      description: 'Test',
      category: 'Miscellaneous',
      paymentMode: 'Cash',
      date: new Date()
    });
    const saved = await newExpense.save();
    console.log("Success!", saved);
  } catch (err) {
    console.error("Error saving:", err.message);
  }
  
  await mongoose.disconnect();
}
main();
