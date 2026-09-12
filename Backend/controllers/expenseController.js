import ExpenseDefault from '../models/Expense.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Add new expense
export const addExpense = async (req, res) => {
  try {
    const Expense = getTenantModel(req, 'Expense', ExpenseDefault);
    const { amount, description, category, paymentMode, date, timeHour, timeMinute, timeAmpm } = req.body;

    let parsedDate = new Date();

    if (date) {
      let dateStr = date;
      // Handle DD-MM-YYYY format
      if (typeof date === 'string' && date.split('-')[0].length === 2) {
        const [day, month, year] = date.split('-');
        dateStr = `${year}-${month}-${day}`;
      }

      // Build hour in 24h from 12h AM/PM
      let hours24 = 0;
      if (timeHour && timeMinute && timeAmpm) {
        let h = parseInt(timeHour, 10);
        const ampm = (timeAmpm || 'AM').toUpperCase();
        if (ampm === 'AM') {
          hours24 = h === 12 ? 0 : h;
        } else {
          hours24 = h === 12 ? 12 : h + 12;
        }
        const mins = parseInt(timeMinute, 10);
        // Compose as IST datetime string (IST = UTC+5:30)
        // We store in UTC so subtract 5h30m
        const istMs = new Date(`${dateStr}T${String(hours24).padStart(2,'0')}:${String(mins).padStart(2,'0')}:00+05:30`).getTime();
        parsedDate = new Date(istMs);
      } else {
        parsedDate = new Date(dateStr);
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

// Update an expense
export const updateExpense = async (req, res) => {
  try {
    const Expense = getTenantModel(req, 'Expense', ExpenseDefault);
    const { id } = req.params;
    const { amount, description, category, paymentMode, date, timeHour, timeMinute, timeAmpm } = req.body;

    let parsedDate;
    if (date) {
      let dateStr = date;
      if (typeof date === 'string' && date.split('-')[0].length === 2) {
        const [day, month, year] = date.split('-');
        dateStr = `${year}-${month}-${day}`;
      }
      if (timeHour && timeMinute && timeAmpm) {
        let h = parseInt(timeHour, 10);
        const ampm = (timeAmpm || 'AM').toUpperCase();
        const hours24 = ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
        const mins = parseInt(timeMinute, 10);
        const istMs = new Date(`${dateStr}T${String(hours24).padStart(2,'0')}:${String(mins).padStart(2,'0')}:00+05:30`).getTime();
        parsedDate = new Date(istMs);
      } else {
        parsedDate = new Date(dateStr);
      }
    }

    const updateFields = {};
    if (amount !== undefined) updateFields.amount = Number(amount);
    if (description !== undefined) updateFields.description = description;
    if (category !== undefined) updateFields.category = category;
    if (paymentMode !== undefined) updateFields.paymentMode = paymentMode;
    if (parsedDate) updateFields.date = parsedDate;

    const updated = await Expense.findByIdAndUpdate(id, { $set: updateFields }, { new: true, runValidators: true });

    if (!updated) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ message: 'Error updating expense', error: error.message });
  }
};

