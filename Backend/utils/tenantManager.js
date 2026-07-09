import mongoose from 'mongoose';
import MenuDefault from '../models/Menu.js';
import BillDefault from '../models/Bill.js';
import SettingDefault from '../models/Setting.js';
import UserDefault from '../models/User.js';
import CategoryDefault from '../models/Category.js';
import ExpenseDefault from '../models/Expense.js';
import InventoryItemDefault from '../models/InventoryItem.js';
import RecipeDefault from '../models/Recipe.js';
import StockLogDefault from '../models/StockLog.js';
import FloorDefault from '../models/Floor.js';

const connectionPool = new Map();

export const getTenantModels = async (databaseName) => {
  if (!databaseName) {
    return null; // Fallback to default global models
  }

  // Check if we already have an open connection in the pool
  let conn = connectionPool.get(databaseName);
  if (!conn || conn.readyState === 0) {
    // Generate URI for this tenant
    const baseUri = process.env.MONGO_URI || 'mongodb://localhost:27017/restaurantbilling';
    const parts = baseUri.split('?');
    const connectionPart = parts[0];
    const queryPart = parts.length > 1 ? `?${parts[1]}` : '';
    
    const lastSlashIndex = connectionPart.lastIndexOf('/');
    const newConnectionPart = connectionPart.substring(0, lastSlashIndex) + '/' + databaseName;
    const newUri = newConnectionPart + queryPart;

    console.log(`[TenantManager] Establishing connection for tenant: ${databaseName}`);
    conn = mongoose.createConnection(newUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });

    connectionPool.set(databaseName, conn);
  }

  // Compile models on this tenant connection if not already compiled
  const Menu = conn.models.Menu || conn.model('Menu', MenuDefault.schema);
  const Bill = conn.models.Bill || conn.model('Bill', BillDefault.schema);
  const Setting = conn.models.Setting || conn.model('Setting', SettingDefault.schema);
  const User = conn.models.User || conn.model('User', UserDefault.schema);
  const Category = conn.models.Category || conn.model('Category', CategoryDefault.schema);
  const Expense = conn.models.Expense || conn.model('Expense', ExpenseDefault.schema);
  const InventoryItem = conn.models.InventoryItem || conn.model('InventoryItem', InventoryItemDefault.schema);
  const Recipe = conn.models.Recipe || conn.model('Recipe', RecipeDefault.schema);
  const StockLog = conn.models.StockLog || conn.model('StockLog', StockLogDefault.schema);
  const Floor = conn.models.Floor || conn.model('Floor', FloorDefault.schema);

  return {
    Menu,
    Bill,
    Setting,
    User,
    Category,
    Expense,
    InventoryItem,
    Recipe,
    StockLog,
    Floor,
    connection: conn
  };
};
