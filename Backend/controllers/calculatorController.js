import CalculationHistoryDefault from '../models/CalculationHistory.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Get calculation history for current tenant (auto-filtered to last 48 hours)
export const getCalculationHistory = async (req, res) => {
  try {
    const CalculationHistory = getTenantModel(req, 'CalculationHistory', CalculationHistoryDefault);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    // Purge items older than 48 hours
    await CalculationHistory.deleteMany({ createdAt: { $lt: twoDaysAgo } }).catch(() => {});

    const history = await CalculationHistory.find({ createdAt: { $gte: twoDaysAgo } })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching calculation history:', error);
    res.status(500).json({ message: 'Error fetching calculation history', error: error.message });
  }
};

// Save a calculation record for current tenant
export const saveCalculation = async (req, res) => {
  try {
    const { expression, result, details } = req.body;
    if (!expression || result === undefined) {
      return res.status(400).json({ message: 'Expression and result are required' });
    }

    const CalculationHistory = getTenantModel(req, 'CalculationHistory', CalculationHistoryDefault);
    
    const record = new CalculationHistory({
      expression: String(expression).trim(),
      result: String(result).trim(),
      details: details ? String(details).trim() : ''
    });

    await record.save();

    res.status(201).json(record);
  } catch (error) {
    console.error('Error saving calculation:', error);
    res.status(500).json({ message: 'Error saving calculation', error: error.message });
  }
};

// Clear all calculation history for current tenant
export const clearCalculationHistory = async (req, res) => {
  try {
    const CalculationHistory = getTenantModel(req, 'CalculationHistory', CalculationHistoryDefault);
    await CalculationHistory.deleteMany({});
    res.status(200).json({ message: 'Calculation history cleared successfully' });
  } catch (error) {
    console.error('Error clearing calculation history:', error);
    res.status(500).json({ message: 'Error clearing calculation history', error: error.message });
  }
};

// Delete single calculation record by ID
export const deleteSingleCalculation = async (req, res) => {
  try {
    const { id } = req.params;
    const CalculationHistory = getTenantModel(req, 'CalculationHistory', CalculationHistoryDefault);
    await CalculationHistory.findByIdAndDelete(id);
    res.status(200).json({ message: 'Calculation deleted successfully' });
  } catch (error) {
    console.error('Error deleting calculation record:', error);
    res.status(500).json({ message: 'Error deleting calculation record', error: error.message });
  }
};

