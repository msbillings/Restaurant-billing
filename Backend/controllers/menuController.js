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

    const query = req.query.availableOnly === 'true' ? { isAvailable: { $ne: false } } : {};
    const [rawItems, allCats] = await Promise.all([
      Menu.find(query).sort({ createdAt: -1, updatedAt: -1 }).lean(),
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

    // Check if item with this name already exists in this tenant to prevent duplicates
    const cleanName = (req.body.name || '').trim();
    const existing = await Menu.findOne({
      name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existing) {
      const updatedItem = await Menu.findByIdAndUpdate(
        existing._id,
        { ...req.body, category: categoryData },
        { new: true }
      ).populate('category', 'name');
      emitSocketEvent(req, 'menuUpdated', { action: 'update', item: updatedItem });
      return res.status(200).json(updatedItem);
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

export const bulkAddMenuItems = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const Category = getTenantModel(req, 'Category', CategoryDefault);
    const rawItems = req.body.items || [];

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ message: 'No items provided for bulk import' });
    }

    // 1. Gather all unique category names
    const categoryNameMap = new Map();
    for (const item of rawItems) {
      const catName = typeof item.category === 'string'
        ? item.category.trim()
        : (item.category?.name || 'General').trim();
      if (catName) {
        categoryNameMap.set(catName.toLowerCase(), catName);
      }
    }

    // Ensure 'General' category exists in map
    if (!categoryNameMap.has('general')) {
      categoryNameMap.set('general', 'General');
    }

    // 2. Fetch existing categories in one query
    const existingCategories = await Category.find({}).lean();
    const catDbMap = new Map();
    for (const cat of existingCategories) {
      if (cat && cat.name) {
        catDbMap.set(cat.name.trim().toLowerCase(), cat._id);
      }
    }

    // 3. Create any missing categories in bulk
    const missingCategories = [];
    for (const [lowerName, origName] of categoryNameMap.entries()) {
      if (!catDbMap.has(lowerName)) {
        missingCategories.push({ name: origName, description: '', isActive: true });
      }
    }

    if (missingCategories.length > 0) {
      try {
        const createdCategories = await Category.insertMany(missingCategories, { ordered: false });
        for (const cat of createdCategories) {
          catDbMap.set(cat.name.trim().toLowerCase(), cat._id);
        }
      } catch (catErr) {
        // If duplicates hit on category unique index, re-fetch categories
        const refreshedCats = await Category.find({}).lean();
        for (const cat of refreshedCats) {
          catDbMap.set(cat.name.trim().toLowerCase(), cat._id);
        }
      }
    }

    // 4. Fetch existing menu items in this tenant to match by name (case-insensitive deduplication)
    const existingMenuItems = await Menu.find({}, { name: 1 }).lean();
    const existingMenuMap = new Map();
    for (const mi of existingMenuItems) {
      if (mi && mi.name) {
        existingMenuMap.set(mi.name.trim().toLowerCase(), mi._id);
      }
    }

    // 5. Build bulkWrite operations
    const seenBatchNames = new Set();
    const bulkOps = [];
    let insertedCount = 0;
    let updatedCount = 0;

    for (const row of rawItems) {
      const cleanName = (row.name || '').trim();
      if (!cleanName) continue;
      const lowerName = cleanName.toLowerCase();

      // Avoid creating duplicates inside the same uploaded batch
      if (seenBatchNames.has(lowerName)) {
        continue;
      }
      seenBatchNames.add(lowerName);

      const catName = typeof row.category === 'string'
        ? row.category.trim().toLowerCase()
        : (row.category?.name || '').trim().toLowerCase();
      const resolvedCategoryId = catDbMap.get(catName) || catDbMap.get('general') || null;

      const itemPayload = {
        name: cleanName,
        price: Math.max(0, parseFloat(row.price) || 0),
        category: resolvedCategoryId,
        type: (row.type && String(row.type).toLowerCase().includes('non')) ? 'non-veg' : 'veg',
        description: (row.description || '').trim(),
        isAvailable: row.isAvailable !== false,
        taxRate: Math.max(0, parseFloat(row.taxRate) || 0),
        hsnCode: (row.hsnCode || '').trim(),
        image: (row.image || '').trim(),
        variants: Array.isArray(row.variants) ? row.variants : []
      };

      if (existingMenuMap.has(lowerName)) {
        // Update existing item
        bulkOps.push({
          updateOne: {
            filter: { _id: existingMenuMap.get(lowerName) },
            update: { $set: itemPayload }
          }
        });
        updatedCount++;
      } else {
        // Insert new item
        bulkOps.push({
          insertOne: {
            document: itemPayload
          }
        });
        insertedCount++;
      }
    }

    if (bulkOps.length > 0) {
      await Menu.bulkWrite(bulkOps, { ordered: false });
    }

    // 6. Emit single socket event to notify POS & screens
    emitSocketEvent(req, 'menuUpdated', { action: 'bulk', count: bulkOps.length });

    // 7. Auto-translate top items in non-blocking background queue
    const itemsToTranslate = rawItems.slice(0, 30);
    setTimeout(async () => {
      try {
        for (const item of itemsToTranslate) {
          if (item.name) {
            try {
              const trans = await translateMenuItem(item.name, item.description);
              await Menu.updateOne(
                { name: item.name },
                { $set: { nameTranslations: trans.nameTranslations, descriptionTranslations: trans.descriptionTranslations } }
              );
            } catch (e) {}
          }
        }
      } catch (err) {}
    }, 200);

    return res.status(200).json({
      success: true,
      message: `Bulk import complete: ${insertedCount} items added, ${updatedCount} items updated.`,
      inserted: insertedCount,
      updated: updatedCount,
      total: bulkOps.length
    });
  } catch (error) {
    console.error('[BulkImport] Error during bulk menu import:', error);
    return res.status(500).json({ message: error.message || 'Failed to bulk import menu items' });
  }
};

