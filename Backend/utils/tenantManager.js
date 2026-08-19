import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

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
import StaffDefault from '../models/Staff.js';
import CustomerDefault from '../models/Customer.js';
import ServiceRequestDefault from '../models/ServiceRequest.js';
import CameraDefault from '../models/Camera.js';

const tenantModelsCache = new Map();

export const getTenantModels = async (databaseName) => {
  if (!databaseName || databaseName === 'undefined' || databaseName === 'null') {
    return null; // Fallback to default global models
  }

  // Ensure default connection is established
  if (mongoose.connection.readyState !== 1) {
    if (mongoose.connection.readyState === 2) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once('open', resolve);
        setTimeout(resolve, 5000);
      });
    }
  }

  if (mongoose.connection.readyState === 1 && tenantModelsCache.has(databaseName)) {
    return tenantModelsCache.get(databaseName);
  }

  // Switch to tenant DB instantly using existing connection pool (0ms delay)
  const conn = mongoose.connection.useDb(databaseName, { useCache: true });

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
  const Staff = conn.models.Staff || conn.model('Staff', StaffDefault.schema);
  const Customer = conn.models.Customer || conn.model('Customer', CustomerDefault.schema);
  const ServiceRequest = conn.models.ServiceRequest || conn.model('ServiceRequest', ServiceRequestDefault.schema);
  const Camera = conn.models.Camera || conn.model('Camera', CameraDefault.schema);

  const models = {
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
    Staff,
    Customer,
    ServiceRequest,
    Camera,
    connection: conn
  };

  tenantModelsCache.set(databaseName, models);
  return models;
};

