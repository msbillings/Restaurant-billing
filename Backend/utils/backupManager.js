import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import BillDefault from '../models/Bill.js';
import MenuDefault from '../models/Menu.js';
import InventoryDefault from '../models/InventoryItem.js';
import mongoose from 'mongoose';
import { getTenantModel } from './tenantHelper.js';

// Setup Backup Directory
const getBackupDir = () => {
  const baseDir = process.env.APP_USER_DATA_PATH || process.cwd();
  const backupDir = path.join(baseDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
};

// Perform Backup
export const performBackup = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('[Backup] Skipping backup, DB not connected.');
      return;
    }

    const backupDir = getBackupDir();
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupPath = path.join(backupDir, `backup_${dateStr}.json`);

    // In a multi-tenant system, this should ideally iterate over all tenant DBs.
    // For the local bridge server, it's connected to the specific restaurant's DB.
    
    // We will use the default mongoose connection (which points to the local bridge DB or atlas)
    const Bill = mongoose.models.Bill || mongoose.model('Bill', BillDefault.schema);
    const MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', MenuDefault.schema);
    const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', InventoryDefault.schema);

    console.log(`[Backup] Starting data vault backup...`);

    const bills = await Bill.find({}).lean();
    const menuItems = await MenuItem.find({}).lean();
    const inventory = await Inventory.find({}).lean();

    const backupData = {
      timestamp: new Date().toISOString(),
      bills,
      menuItems,
      inventory
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    
    console.log(`[Backup] ✅ Data Vault Backup Successful! Saved to ${backupPath}`);
    
    // Keep only last 30 backups to save space
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_') && f.endsWith('.json'));
    if (files.length > 30) {
      files.sort(); // Oldest first
      const filesToDelete = files.slice(0, files.length - 30);
      for (const file of filesToDelete) {
        fs.unlinkSync(path.join(backupDir, file));
      }
    }
  } catch (error) {
    console.error('[Backup] ❌ Data Vault Backup Failed:', error);
  }
};

// Schedule Cron Job (Runs every day at 3:00 AM)
export const startBackupCron = () => {
  cron.schedule('0 3 * * *', () => {
    console.log('[Backup] Running scheduled daily backup...');
    performBackup();
  });
  
  // Also perform a backup immediately on startup if one doesn't exist for today
  const backupDir = getBackupDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const backupPath = path.join(backupDir, `backup_${dateStr}.json`);
  if (!fs.existsSync(backupPath)) {
     console.log('[Backup] No backup found for today, running initial backup...');
     // Small delay to ensure DB is fully connected
     setTimeout(performBackup, 10000);
  }
};
