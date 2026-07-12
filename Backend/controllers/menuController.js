import MenuDefault from '../models/Menu.js';
import CategoryDefault from '../models/Category.js';
import { getTenantModel } from '../utils/tenantHelper.js';

const emitSocketEvent = (req, eventName, data) => {
  try {
    const io = req.app?.locals?.io;
    if (io) {
      const tenantDb = req.models?.connection?.name || req.headers['x-tenant-db'];
      if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
        io.to(tenantDb).emit(eventName, data);
        console.log(`[Socket] Broadcasted event ${eventName} securely to tenant room: ${tenantDb}`);
      } else {
        io.emit(eventName, data);
      }
    }
  } catch (err) {
    console.error('Socket emit error:', err);
  }
};

export const getAllMenuItems = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const items = await Menu.find({ isAvailable: true }).populate('category', 'name');
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addMenuItem = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    let categoryData = req.body.category;

    // If category is a string, find the category by name
    if (typeof categoryData === 'string') {
      let category = await Category.findOne({ name: categoryData });
      if (!category) {
        // Auto-create category if it doesn't exist
        category = new Category({ name: categoryData, description: '' });
        await category.save();
      }
      categoryData = category._id;
    }

    const newItem = new Menu({ ...req.body, category: categoryData });
    await newItem.save();
    const populatedItem = await Menu.findById(newItem._id).populate('category', 'name');
    emitSocketEvent(req, 'menuUpdated', { action: 'add', item: populatedItem });
    res.status(201).json(populatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateMenuItem = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    let updateData = req.body;

    // Security check: If non-Admin user (e.g. cashier/POS user), restrict updates exclusively to isFavorite status
    if (req.user && req.user.role !== 'Admin') {
      if (typeof updateData.isFavorite === 'boolean') {
        updateData = { isFavorite: updateData.isFavorite };
      } else {
        return res.status(403).json({ message: 'Only Admins can modify item details other than Favourites' });
      }
    }

    // If category is a string, find the category by name
    if (typeof updateData.category === 'string') {
      let category = await Category.findOne({ name: updateData.category });
      if (!category) {
        // Auto-create category if it doesn't exist
        category = new Category({ name: updateData.category, description: '' });
        await category.save();
      }
      updateData.category = category._id;
    }

    const updatedItem = await Menu.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('category', 'name');
    if (!updatedItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    emitSocketEvent(req, 'menuUpdated', { action: 'update', item: updatedItem });
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteMenuItem = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const deletedItem = await Menu.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    emitSocketEvent(req, 'menuUpdated', { action: 'delete', id: req.params.id });
    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteAllMenuItems = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    await Menu.deleteMany({});
    emitSocketEvent(req, 'menuUpdated', { action: 'deleteAll' });
    res.status(200).json({ message: 'All menu items deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
