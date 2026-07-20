import ExpenseDefault from '../models/Expense.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Add new expense
export const addExpense = async (req, res) => {
  try {
    const Expense = getTenantModel(req, 'Expense', ExpenseDefault);
    const { amount, description, category, paymentMode, date } = req.body;
    
    let parsedDate = new Date();
    if (date) {
      if (typeof date === 'string' && date.split('-')[0].length === 2) {
        // Handle DD-MM-YYYY
        const [day, month, year] = date.split('-');
        parsedDate = new Date(`${year}-${month}-${day}`);
      } else {
        parsedDate = new Date(date);
      }
    }

    const newExpense = new Expense({
      amount: Number(amount),
      description,
      category,
      paymentMode,
      date: parsedDate
    });

    const savedExpense = await newExpense.save();
    res.status(201).json(savedExpense);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ message: 'Error adding expense', error: error.message });
  }
};

// Get all expenses (with optional filtering by date range)
export const getExpenses = async (req, res) => {
  try {
    const Expense = getTenantModel(req, 'Expense', ExpenseDefault);
    const { startDate, endDate } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Error fetching expenses', error: error.message });
  }
};

// Delete an expense
export const deleteExpense = async (req, res) => {
  try {
    const Expense = getTenantModel(req, 'Expense', ExpenseDefault);
    const { id } = req.params;
    const deletedExpense = await Expense.findByIdAndDelete(id);
    
    if (!deletedExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    res.status(200).json({ message: 'Expense deleted successfully', id });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ message: 'Error deleting expense', error: error.message });
  }
};
