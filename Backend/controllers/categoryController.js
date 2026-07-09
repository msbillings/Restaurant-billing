import CategoryDefault from '../models/Category.js';
import { getTenantModel } from '../utils/tenantHelper.js';

export const getAllCategories = async (req, res) => {
  try {
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllCategoriesAdmin = async (req, res) => {
  try {
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    const categories = await Category.find().sort({ sortOrder: 1, name: 1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    const category = new Category(req.body);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};