import InventoryItemDefault from '../models/InventoryItem.js';
import RecipeDefault from '../models/Recipe.js';
import StockLogDefault from '../models/StockLog.js';
import MenuDefault from '../models/Menu.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Helper to get models from request (for multi-tenancy)
const getModels = (req) => ({
  InventoryItem: getTenantModel(req, 'InventoryItem', InventoryItemDefault),
  Recipe: getTenantModel(req, 'Recipe', RecipeDefault),
  StockLog: getTenantModel(req, 'StockLog', StockLogDefault),
  Menu: getTenantModel(req, 'Menu', MenuDefault)
});

// 1. Get all inventory items
export const getItems = async (req, res) => {
  try {
    const { InventoryItem } = getModels(req);
    const items = await InventoryItem.find().sort({ name: 1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching inventory items' });
  }
};

// 2. Add new inventory item
export const addItem = async (req, res) => {
  try {
    const { InventoryItem, StockLog } = getModels(req);
    const { name, category, unit, currentStock = 0, minStockAlert = 5, unitCost = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    const newItem = new InventoryItem({
      name,
      category,
      unit,
      currentStock: Number(currentStock),
      minStockAlert: Number(minStockAlert),
      unitCost: Number(unitCost),
      lastRestocked: new Date()
    });

    await newItem.save();

    if (Number(currentStock) > 0) {
      await StockLog.create({
        item: newItem._id,
        itemName: newItem.name,
        type: 'Initial Stock',
        quantityChange: Number(currentStock),
        finalStock: Number(currentStock),
        unit: newItem.unit,
        notes: 'Initial stock added upon item creation',
        performedBy: req.body.performedBy || 'Admin'
      });
      // Initial stock counts as purchased
      if (Number(currentStock) > 0) {
        newItem.totalPurchased += Number(currentStock);
        await newItem.save();
      }
    }

    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error creating inventory item' });
  }
};

// 3. Update inventory item
export const updateItem = async (req, res) => {
  try {
    const { InventoryItem, StockLog } = getModels(req);
    const { id } = req.params;
    const { name, category, unit, minStockAlert, unitCost, currentStock, notes, performedBy } = req.body;

    const existingItem = await InventoryItem.findById(id);
    if (!existingItem) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const oldStock = existingItem.currentStock;
    const newStock = currentStock !== undefined ? Number(currentStock) : oldStock;

    existingItem.name = name || existingItem.name;
    existingItem.category = category || existingItem.category;
    existingItem.unit = unit || existingItem.unit;
    if (minStockAlert !== undefined) existingItem.minStockAlert = Number(minStockAlert);
    if (unitCost !== undefined) existingItem.unitCost = Number(unitCost);
    existingItem.currentStock = newStock;

    if (newStock !== oldStock) {
      existingItem.lastRestocked = new Date();
      const diff = newStock - oldStock;
      if (diff > 0) {
        existingItem.totalPurchased += diff;
      } else if (diff < 0) {
        existingItem.totalUsed += Math.abs(diff);
      }
      
      await StockLog.create({
        item: existingItem._id,
        itemName: existingItem.name,
        type: 'Audit',
        quantityChange: diff,
        finalStock: newStock,
        unit: existingItem.unit,
        notes: notes || 'Manual stock audit / correction',
        performedBy: performedBy || 'Admin'
      });
    }

    await existingItem.save();
    res.status(200).json(existingItem);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error updating inventory item' });
  }
};

// 4. Delete inventory item
export const deleteItem = async (req, res) => {
  try {
    const { InventoryItem, Recipe, StockLog } = getModels(req);
    const { id } = req.params;

    const deleted = await InventoryItem.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Remove from any recipe maps
    await Recipe.updateMany(
      { 'ingredients.inventoryItem': id },
      { $pull: { ingredients: { inventoryItem: id } } }
    );

    await StockLog.create({
      item: null,
      itemName: deleted.name,
      type: 'Wastage/Adjustment',
      quantityChange: -deleted.currentStock,
      finalStock: 0,
      unit: deleted.unit,
      notes: 'Item deleted from inventory system',
      performedBy: req.body?.performedBy || 'Admin'
    });

    res.status(200).json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting inventory item' });
  }
};

// 5. Stock-In (Quick Restock from supplier)
export const stockIn = async (req, res) => {
  try {
    const { InventoryItem, StockLog } = getModels(req);
    const { id } = req.params;
    const { quantity, unitCost, notes, performedBy } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Valid restock quantity is required' });
    }

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const addedQty = Number(quantity);
    item.currentStock += addedQty;
    item.totalPurchased += addedQty;
    
    if (unitCost !== undefined && Number(unitCost) >= 0) {
      item.unitCost = Number(unitCost);
    }
    item.lastRestocked = new Date();
    await item.save();

    const log = await StockLog.create({
      item: item._id,
      itemName: item.name,
      type: 'Stock-In',
      quantityChange: addedQty,
      finalStock: item.currentStock,
      unit: item.unit,
      notes: notes || 'Supplier delivery / stock restocked',
      performedBy: performedBy || 'Store Manager'
    });

    res.status(200).json({ item, log });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error processing Stock-In' });
  }
};

// 6. Record Wastage / Spoilage
export const recordWastage = async (req, res) => {
  try {
    const { InventoryItem, StockLog } = getModels(req);
    const { id } = req.params;
    const { quantity, notes, performedBy } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Valid wastage quantity is required' });
    }

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const deductQty = Number(quantity);
    item.currentStock = Math.max(0, item.currentStock - deductQty);
    item.totalUsed += deductQty;
    await item.save();

    const log = await StockLog.create({
      item: item._id,
      itemName: item.name,
      type: 'Wastage/Adjustment',
      quantityChange: -deductQty,
      finalStock: item.currentStock,
      unit: item.unit,
      notes: notes || 'Wastage / spoilage logged',
      performedBy: performedBy || 'Kitchen Chef'
    });

    res.status(200).json({ item, log });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error recording wastage' });
  }
};

// 6.5 Staff Withdrawal
export const staffWithdraw = async (req, res) => {
  try {
    const { InventoryItem, StockLog } = getModels(req);
    const { id } = req.params;
    const { quantity, staffName, designation, notes } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Valid withdrawal quantity is required' });
    }

    if (!staffName || !designation) {
      return res.status(400).json({ message: 'Staff name and designation are required' });
    }

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const deductQty = Number(quantity);
    item.currentStock = Math.max(0, item.currentStock - deductQty);
    item.totalUsed += deductQty;
    await item.save();

    const performedByStr = `Staff: ${staffName} (${designation})`;

    const log = await StockLog.create({
      item: item._id,
      itemName: item.name,
      type: 'Staff Withdrawal',
      quantityChange: -deductQty,
      finalStock: item.currentStock,
      unit: item.unit,
      notes: notes || `Stock taken by ${staffName}`,
      performedBy: performedByStr
    });

    res.status(200).json({ item, log });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error recording staff withdrawal' });
  }
};

// 7. Get all recipes (with populated menu item and ingredients)
export const getRecipes = async (req, res) => {
  try {
    const { Recipe } = getModels(req);
    const recipes = await Recipe.find()
      .populate('menuItem', 'name price category isAvailable')
      .populate('ingredients.inventoryItem', 'name unit unitCost currentStock minStockAlert');
    
    // Filter out recipes where menuItem was deleted
    const validRecipes = recipes.filter(r => r.menuItem != null);
    res.status(200).json(validRecipes);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching recipes' });
  }
};

// 8. Save (Create or Update) Recipe Map
export const saveRecipe = async (req, res) => {
  try {
    const { Recipe } = getModels(req);
    const { menuItem, ingredients } = req.body;

    if (!menuItem || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ message: 'Menu item and at least one ingredient are required' });
    }

    const updatedRecipe = await Recipe.findOneAndUpdate(
      { menuItem },
      { menuItem, ingredients },
      { upsert: true, new: true }
    )
    .populate('menuItem', 'name price category')
    .populate('ingredients.inventoryItem', 'name unit unitCost currentStock');

    res.status(200).json(updatedRecipe);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error saving recipe map' });
  }
};

// 9. Delete Recipe Map
export const deleteRecipe = async (req, res) => {
  try {
    const { Recipe } = getModels(req);
    const { id } = req.params;

    const deleted = await Recipe.findByIdAndDelete(id) || await Recipe.findOneAndDelete({ menuItem: id });
    if (!deleted) {
      return res.status(404).json({ message: 'Recipe map not found' });
    }

    res.status(200).json({ message: 'Recipe map deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting recipe map' });
  }
};

// 10. Get Stock Logs (Audit Trail)
export const getLogs = async (req, res) => {
  try {
    const { StockLog } = getModels(req);
    const logs = await StockLog.find().sort({ createdAt: -1 }).limit(200);
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching stock logs' });
  }
};

// 11. Helper: Automatically deduct stock when a bill is created / settled
export const deductStockForBillItems = async (req, billItems, performedBy = 'POS Billing Counter') => {
  try {
    if (!billItems || !Array.isArray(billItems) || billItems.length === 0) return;
    const { Menu, InventoryItem, StockLog } = getModels(req);

    for (const item of billItems) {
      const menuItemId = item.menuItem?._id || item.menuItem || item._id || item.id;
      const orderQty = Number(item.quantity || 1);
      if (!menuItemId) continue;

      const menuDoc = await Menu.findById(menuItemId).populate('recipe.ingredientId');
      if (!menuDoc || !menuDoc.recipe || menuDoc.recipe.length === 0) continue;

      for (const ing of menuDoc.recipe) {
        const invItem = ing.ingredientId;
        if (!invItem || !invItem._id) continue;

        const deductQty = Number(ing.quantityRequired) * orderQty;
        invItem.currentStock = Math.max(0, invItem.currentStock - deductQty);
        invItem.totalUsed += deductQty;
        await invItem.save();

        await StockLog.create({
          item: invItem._id,
          itemName: invItem.name,
          type: 'POS Deduction',
          quantityChange: -deductQty,
          finalStock: invItem.currentStock,
          unit: invItem.unit,
          notes: `Auto-deducted for ${orderQty}x ${item.name || 'dish'} on POS Bill`,
          performedBy
        });
      }
    }
  } catch (err) {
    console.error('[InventoryController] Error in deductStockForBillItems:', err);
  }
};

// 12. AI Restock Prediction — Analyze last 7 days of deductions & predict tomorrow's needs
export const getRestockPredictions = async (req, res) => {
  try {
    const { StockLog, InventoryItem } = getModels(req);

    // Get all POS deductions from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deductions = await StockLog.find({
      type: 'POS Deduction',
      createdAt: { $gte: sevenDaysAgo }
    }).lean();

    // Group deductions by ingredient
    const usageMap = {};
    for (const log of deductions) {
      const key = log.item?.toString() || log.itemName;
      if (!usageMap[key]) {
        usageMap[key] = {
          itemId: log.item,
          itemName: log.itemName,
          unit: log.unit || 'units',
          dailyUsage: {},
          totalUsed: 0
        };
      }
      const dayKey = new Date(log.createdAt).toISOString().split('T')[0];
      usageMap[key].dailyUsage[dayKey] = (usageMap[key].dailyUsage[dayKey] || 0) + Math.abs(log.quantityChange);
      usageMap[key].totalUsed += Math.abs(log.quantityChange);
    }

    // Calculate predictions
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const isWeekend = tomorrowDay === 0 || tomorrowDay === 5 || tomorrowDay === 6;
    const weekendMultiplier = isWeekend ? 1.35 : 1.0; // 35% surge on weekends

    const allItems = await InventoryItem.find().lean();
    const itemStockMap = {};
    allItems.forEach(item => {
      itemStockMap[item._id.toString()] = item;
    });

    const predictions = [];
    for (const [key, usage] of Object.entries(usageMap)) {
      const daysWithData = Object.keys(usage.dailyUsage).length || 1;
      const avgDaily = usage.totalUsed / Math.max(daysWithData, 1);
      const predicted = Math.ceil(avgDaily * weekendMultiplier * 10) / 10;

      const currentItem = itemStockMap[key];
      const currentStock = currentItem?.currentStock || 0;
      const deficit = predicted - currentStock;

      let urgency = 'ok';
      if (currentStock <= 0) urgency = 'critical';
      else if (deficit > 0) urgency = 'low';
      else if (currentStock < predicted * 2) urgency = 'medium';

      predictions.push({
        itemId: usage.itemId,
        itemName: usage.itemName,
        unit: usage.unit,
        avgDailyUsage: Math.round(avgDaily * 10) / 10,
        predictedTomorrow: predicted,
        currentStock,
        deficit: Math.max(0, Math.round(deficit * 10) / 10),
        urgency,
        isWeekendSurge: isWeekend,
        daysOfData: daysWithData
      });
    }

    // Sort by urgency: critical > low > medium > ok
    const urgencyOrder = { critical: 0, low: 1, medium: 2, ok: 3 };
    predictions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    res.status(200).json({
      predictions,
      meta: {
        analyzedDays: 7,
        tomorrowDate: tomorrow.toISOString().split('T')[0],
        isWeekend,
        weekendMultiplier
      }
    });
  } catch (error) {
    console.error('[InventoryController] Prediction error:', error);
    res.status(500).json({ message: error.message || 'Error generating predictions' });
  }
};
