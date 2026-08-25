import mongoose from 'mongoose';
import BillDefault from '../models/Bill.js';
import UserDefault from '../models/User.js';
import SettingDefault from '../models/Setting.js';
import ServiceRequestDefault from '../models/ServiceRequest.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Helper to get indexed clean match for table/space variations (e.g. "Ground Floor - Cabin 1" vs "Ground Floor - Table 1" vs "Table 1")
const getTableMatchCondition = (tblStr) => {
  if (!tblStr) return tblStr;
  const trimmed = tblStr.trim();
  // If floor prefix exists (e.g. "Ground Floor - Cabin 1", "First Floor - Table 2", "Ground Floor - H-1")
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    const floorPart = parts[0].trim();
    const tablePart = parts.slice(1).join(' - ').trim();
    const escapedFloor = floorPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedTable = tablePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [];
    // 1. Exact match with floor: "Ground Floor - H-1"
    patterns.push(`^${escapedFloor}\\s*-\\s*${escapedTable}$`);
    // 2. Bare match without floor: "H-1"
    patterns.push(`^${escapedTable}$`);
    // 3. If standard space type (e.g. "Table 1", "Cabin 2", "Sofa 3", "Room 4", "Bar 5")
    const standardMatch = tablePart.match(/^(Table|Cabin|Sofa|Room|Bar)\s*0*(\d+)$/i);
    if (standardMatch) {
      const type = standardMatch[1];
      const num = parseInt(standardMatch[2], 10);
      const firstLetter = type.charAt(0).toUpperCase();
      patterns.push(`^${escapedFloor}\\s*-\\s*(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
      patterns.push(`^(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
    } else {
      // If tablePart is a custom letter/prefix and number (e.g. "H-1", "H1", "M-2")
      const letterNumMatch = tablePart.match(/^([A-Za-z]+)-?0*(\d+)$/);
      if (letterNumMatch) {
        const letter = letterNumMatch[1];
        const num = parseInt(letterNumMatch[2], 10);
        patterns.push(`^${escapedFloor}\\s*-\\s*${letter}-?0*${num}$`);
        patterns.push(`^${letter}-?0*${num}$`);
      }
    }
    return new RegExp(`(?:${patterns.join('|')})`, 'i');
  }
  // If no floor prefix (e.g. "Table 8", "Cabin 1", "Sofa 3", "H-1"):
  const escapedTrimmed = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [];
  patterns.push(`^${escapedTrimmed}$`);
  patterns.push(`^.*?\\s*-\\s*${escapedTrimmed}$`);
  const standardMatch = trimmed.match(/^(Table|Cabin|Sofa|Room|Bar)\s*0*(\d+)$/i);
  if (standardMatch) {
    const type = standardMatch[1];
    const num = parseInt(standardMatch[2], 10);
    const firstLetter = type.charAt(0).toUpperCase();
    patterns.push(`^(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
    patterns.push(`^.*?\\s*-\\s*(?:${type}\\s*0*|${firstLetter}-?0*)${num}$`);
  } else {
    const letterNumMatch = trimmed.match(/^([A-Za-z]+)-?0*(\d+)$/);
    if (letterNumMatch) {
      const letter = letterNumMatch[1];
      const num = parseInt(letterNumMatch[2], 10);
      patterns.push(`^${letter}-?0*${num}$`);
      patterns.push(`^.*?\\s*-\\s*${letter}-?0*${num}$`);
    }
  }
  return new RegExp(`(?:${patterns.join('|')})`, 'i');
};
// In-memory cache for dynamic tax rate per tenant DB with 60s TTL
const taxRateCache = new Map();
// Helper to dynamically get active tax rate from restaurantSettings in DB
const getDynamicTaxRate = async (req) => {
  try {
    const tenantDb = req.tenantDb || req.headers['x-tenant-db'] || req.user?.db || 'default';
    const cached = taxRateCache.get(tenantDb);
    if (cached && (Date.now() - cached.time < 60000)) {
      return cached.rate;
    }
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).maxTimeMS(600).lean().catch(() => null);
    let s = {};
    if (settingsDoc?.value) {
      s = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
    }
    let tot = 0;
    if (s.enableCgst) {
      tot += Number(s.cgstRate || 0);
    }
    if (s.enableSgst) {
      tot += Number(s.sgstRate || 0);
    }
    if (s.enableGst) {
      tot += Number(s.gstRate || 0);
    }
    taxRateCache.set(tenantDb, { rate: tot, time: Date.now() });
    return tot;
  } catch (e) {
    console.error("Error reading dynamic tax rate:", e);
    return 0;
  }
};
// In-memory cache for dynamic shop name per tenant DB (120s TTL)
const shopNameCache = new Map();
const getTenantShopName = async (req) => {
  try {
    const tenantDb = req.tenantDb || req.headers['x-tenant-db'] || req.user?.db || 'default';
    const cached = shopNameCache.get(tenantDb);
    if (cached && (Date.now() - cached.time < 120000)) {
      return cached.name;
    }
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).maxTimeMS(400).lean().catch(() => null);
    let name = '';
    if (settingsDoc?.value) {
      const s = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
      if (s.restaurantName) name = s.restaurantName.trim();
    }
    shopNameCache.set(tenantDb, { name, time: Date.now() });
    return name;
  } catch {
    return '';
  }
};
// Get active order for a table

export { getTableMatchCondition, getDynamicTaxRate, getTenantShopName };
