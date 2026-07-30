import Tax from '../models/Tax.js';

// Get all taxes
export const getTaxes = async (req, res) => {
  try {
    const taxes = await Tax.find().sort({ createdAt: -1 });
    res.status(200).json(taxes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching taxes', error: error.message });
  }
};

// Create a new tax
export const createTax = async (req, res) => {
  try {
    const { name, percentage, type, isActive } = req.body;
    const newTax = new Tax({ name, percentage, type, isActive });
    await newTax.save();
    res.status(201).json(newTax);
  } catch (error) {
    res.status(500).json({ message: 'Error creating tax', error: error.message });
  }
};

// Update a tax
export const updateTax = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTax = await Tax.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedTax) {
      return res.status(404).json({ message: 'Tax not found' });
    }
    res.status(200).json(updatedTax);
  } catch (error) {
    res.status(500).json({ message: 'Error updating tax', error: error.message });
  }
};

// Delete a tax
export const deleteTax = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTax = await Tax.findByIdAndDelete(id);
    if (!deletedTax) {
      return res.status(404).json({ message: 'Tax not found' });
    }
    res.status(200).json({ message: 'Tax deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting tax', error: error.message });
  }
};
