import MenuDefault from '../models/Menu.js';
import CategoryDefault from '../models/Category.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { translateMenuItem } from '../services/translationService.js';
import { emitNotification } from '../utils/notificationHelper.js';
import { emitSocketEvent } from '../utils/socket.js';

export const getAllMenuItems = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const Category = getTenantModel(req, 'Category', CategoryDefault);

    // Fetch items and categories in parallel with lean() for maximum speed (<100ms)
    const [rawItems, allCats] = await Promise.all([
      Menu.find({ isAvailable: { $ne: false } }).lean(),
      Category.find({}).lean()
    ]);

    const catMap = new Map();
    (allCats || []).forEach(c => {
      if (c && c._id) catMap.set(c._id.toString(), c.name);
      if (c && c.name) catMap.set(c.name, c.name);
    });

    const items = (rawItems || []).map(item => {
      let resolvedCategory = item.category;
      if (item.category && catMap.has(item.category.toString())) {
        resolvedCategory = { _id: item.category, name: catMap.get(item.category.toString()) };
      } else if (typeof item.category === 'string') {
        resolvedCategory = { name: item.category };
      }
      return {
        ...item,
        category: resolvedCategory || { name: 'General' }
      };
    });

    res.status(200).json(items);
  } catch (error) {
    console.error('Error fetching menu items:', error);
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

    // Auto-translate in background (non-blocking)
    translateMenuItem(req.body.name, req.body.description).then(async (translations) => {
      try {
        await Menu.findByIdAndUpdate(newItem._id, {
          nameTranslations: translations.nameTranslations,
          descriptionTranslations: translations.descriptionTranslations
        });
        console.log(`[Translation] Auto-translated menu item: ${req.body.name}`);
        // Emit updated item with translations
        const updatedWithTranslations = await Menu.findById(newItem._id).populate('category', 'name');
        emitSocketEvent(req, 'menuUpdated', { action: 'update', item: updatedWithTranslations });
        // Send notification to bell icon
        const langCount = Object.values(translations.nameTranslations).filter(v => v && v.length > 0).length;
        emitNotification(req, '🌐 Translation Complete', `"${req.body.name}" has been auto-translated into ${langCount} languages`, 'success', ['Admin']);
      } catch (err) {
        console.error('[Translation] Failed to save translations:', err.message);
        emitNotification(req, '⚠️ Translation Failed', `Could not translate "${req.body.name}": ${err.message}`, 'warning', ['Admin']);
      }
    }).catch(err => {
      console.error('[Translation] Background translate error:', err.message);
      emitNotification(req, '⚠️ Translation Failed', `Could not translate "${req.body.name}": ${err.message}`, 'warning', ['Admin']);
    });
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

    // Re-translate if name or description changed (non-blocking)
    if (updateData.name || updateData.description) {
      const nameToTranslate = updateData.name || updatedItem.name;
      const descToTranslate = updateData.description || updatedItem.description;
      translateMenuItem(nameToTranslate, descToTranslate).then(async (translations) => {
        try {
          await Menu.findByIdAndUpdate(req.params.id, {
            nameTranslations: translations.nameTranslations,
            descriptionTranslations: translations.descriptionTranslations
          });
          console.log(`[Translation] Re-translated menu item: ${nameToTranslate}`);
          const refreshed = await Menu.findById(req.params.id).populate('category', 'name');
          emitSocketEvent(req, 'menuUpdated', { action: 'update', item: refreshed });
          // Send notification to bell icon
          const langCount = Object.values(translations.nameTranslations).filter(v => v && v.length > 0).length;
          emitNotification(req, '🌐 Translation Updated', `"${nameToTranslate}" has been re-translated into ${langCount} languages`, 'success', ['Admin']);
        } catch (err) {
          console.error('[Translation] Failed to save re-translations:', err.message);
          emitNotification(req, '⚠️ Translation Failed', `Could not re-translate "${nameToTranslate}": ${err.message}`, 'warning', ['Admin']);
        }
      }).catch(err => {
        console.error('[Translation] Background re-translate error:', err.message);
        emitNotification(req, '⚠️ Translation Failed', `Could not re-translate "${nameToTranslate}": ${err.message}`, 'warning', ['Admin']);
      });
    }
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
