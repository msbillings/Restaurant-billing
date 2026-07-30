import CashLog from '../models/CashLog.js';

// Get all cash logs
export const getCashLogs = async (req, res) => {
  try {
    const logs = await CashLog.find().sort({ date: -1 });
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cash logs', error: error.message });
  }
};

// Create a new cash log
export const createCashLog = async (req, res) => {
  try {
    const { type, amount, reason, performedBy } = req.body;
    const newLog = new CashLog({ type, amount, reason, performedBy });
    await newLog.save();
    res.status(201).json(newLog);
  } catch (error) {
    res.status(500).json({ message: 'Error logging cash', error: error.message });
  }
};

// Delete a cash log (for mistakes)
export const deleteCashLog = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLog = await CashLog.findByIdAndDelete(id);
    if (!deletedLog) {
      return res.status(404).json({ message: 'Log not found' });
    }
    res.status(200).json({ message: 'Log deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting cash log', error: error.message });
  }
};
