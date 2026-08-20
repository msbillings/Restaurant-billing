import DiscountDefault from '../models/Discount.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Get all discounts
export const getDiscounts = async (req, res) => {
  try {
    const Discount = getTenantModel(req, 'Discount', DiscountDefault);
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.status(200).json(discounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching discounts', error: error.message });
  }
};

// Create a new discount
export const createDiscount = async (req, res) => {
  try {
    const Discount = getTenantModel(req, 'Discount', DiscountDefault);
    const { name, type, value, isActive } = req.body;
    const newDiscount = new Discount({ name, type, value, isActive });
    await newDiscount.save();
    res.status(201).json(newDiscount);
  } catch (error) {
    res.status(500).json({ message: 'Error creating discount', error: error.message });
  }
};

// Update a discount
export const updateDiscount = async (req, res) => {
  try {
    const Discount = getTenantModel(req, 'Discount', DiscountDefault);
    const { id } = req.params;
    const updatedDiscount = await Discount.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedDiscount) {
      return res.status(404).json({ message: 'Discount not found' });
    }
    res.status(200).json(updatedDiscount);
  } catch (error) {
    res.status(500).json({ message: 'Error updating discount', error: error.message });
  }
};

// Delete a discount
export const deleteDiscount = async (req, res) => {
  try {
    const Discount = getTenantModel(req, 'Discount', DiscountDefault);
    const { id } = req.params;
    const deletedDiscount = await Discount.findByIdAndDelete(id);
    if (!deletedDiscount) {
      return res.status(404).json({ message: 'Discount not found' });
    }
    res.status(200).json(deletedDiscount);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting discount', error: error.message });
  }
};
