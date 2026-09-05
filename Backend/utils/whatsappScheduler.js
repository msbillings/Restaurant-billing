import cron from 'node-cron';
import mongoose from 'mongoose';
import { generateDayBookWorkbook } from './excelGenerator.js';
import ClientDefault from '../models/Client.js';
import BillDefault from '../models/Bill.js';
import ExpenseDefault from '../models/Expense.js';
import SettingDefault from '../models/Setting.js';
import { getTenantModels } from './tenantManager.js';
import whatsappManager from '../services/whatsappService.js';

const generateAutoDayBookWhatsAppMessage = async (databaseName) => {
  try {
    const models = await getTenantModels(databaseName);
    const Bill = models.Bill;
    const Expense = models.Expense;
    const Setting = models.Setting;

    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const [allBills, expenses, settingsDoc] = await Promise.all([
      Bill.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).lean(),
      Expense.find({
        $or: [
          { date: { $gte: startDate, $lte: endDate } },
          { createdAt: { $gte: startDate, $lte: endDate }, date: { $exists: false } }
        ]
      }).lean(),
      Setting.findOne({ key: 'restaurantSettings' }).lean()
    ]);

    let restName = 'Restaurant';
    let restaurantSettings = settingsDoc?.value;
    if (typeof restaurantSettings === 'string') {
      try { restaurantSettings = JSON.parse(restaurantSettings); } catch (e) {}
    }
    if (restaurantSettings && restaurantSettings.restaurantName) {
      restName = restaurantSettings.restaurantName;
    }

    let totalSales = 0;
    let totalExpenses = 0;
    let revenueLeakage = 0;
    
    const cashFlow = {
      cashIn: 0,
      cashOut: 0,
      onlineIn: { total: 0, upiApps: {} },
      onlineOut: 0
    };
    const transactions = [];
    const bills = [];

    (allBills || []).forEach(bill => {
      if (bill.status === 'Paid') {
        bills.push(bill);
      } else {
        revenueLeakage += bill.total || 0;
      }
    });

    bills.forEach(bill => {
      totalSales += bill.total || 0;
      
      if (bill.paymentMode === 'Cash') {
        cashFlow.cashIn += bill.total || 0;
      } else if (bill.paymentMode === 'UPI') {
        cashFlow.onlineIn.total += bill.total || 0;
        const appName = bill.upiApp || 'UPI';
        if (!cashFlow.onlineIn.upiApps[appName]) cashFlow.onlineIn.upiApps[appName] = 0;
        cashFlow.onlineIn.upiApps[appName] += bill.total || 0;
      } else if (bill.paymentMode === 'Card') {
        cashFlow.onlineIn.total += bill.total || 0;
        if (!cashFlow.onlineIn.upiApps['Card']) cashFlow.onlineIn.upiApps['Card'] = 0;
        cashFlow.onlineIn.upiApps['Card'] += bill.total || 0;
      } else if (bill.paymentMode === 'Mixed' && bill.splitPayments) {
        cashFlow.cashIn += Number(bill.splitPayments.cash) || 0;
        const splitUpi = Number(bill.splitPayments.upi) || 0;
        const splitCard = Number(bill.splitPayments.card) || 0;
        
        cashFlow.onlineIn.upiApps['Mixed'] = (cashFlow.onlineIn.upiApps['Mixed'] || 0) + bill.total;

        if (splitUpi > 0) cashFlow.onlineIn.total += splitUpi;
        if (splitCard > 0) cashFlow.onlineIn.total += splitCard;
      } else {
        cashFlow.onlineIn.total += bill.total || 0;
        cashFlow.onlineIn.upiApps['Other Online'] = (cashFlow.onlineIn.upiApps['Other Online'] || 0) + (bill.total || 0);
      }

      transactions.push({
        type: 'Sale',
        id: bill._id,
        particulars: bill.billNumber || 'Sale',
        name: bill.customerName || '--',
        paymentMode: bill.paymentMode,
        total: bill.total || 0,
        cashIn: bill.total || 0,
        cashOut: 0,
        date: bill.createdAt
      });
    });

    (expenses || []).forEach(exp => {
      totalExpenses += exp.amount || 0;
      if (exp.paymentMode === 'Cash') {
        cashFlow.cashOut += exp.amount || 0;
      } else {
        cashFlow.onlineOut += exp.amount || 0;
      }

      transactions.push({
        type: 'Expense',
        id: exp._id,
        particulars: exp.category || 'Expense',
        name: exp.description || '--',
        paymentMode: exp.paymentMode,
        total: exp.amount || 0,
        cashIn: 0,
        cashOut: exp.amount || 0,
        date: exp.date || exp.createdAt
      });
    });

    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    const onlineBreakdownText = Object.keys(cashFlow.onlineIn.upiApps).map(app => 
      `  └ *${app}:* ₹${cashFlow.onlineIn.upiApps[app]}`
    ).join('\n');

    const dateStr = now.toLocaleDateString('en-GB');

    const msg = `📊 *DAYBOOK REPORT* 📊\n` +
      `🏨 *${restName.toUpperCase()}* (${dateStr})\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *SUMMARY*\n` +
      `• *Total Sales:* ₹${totalSales}\n` +
      `• *Total Bills:* ${bills.length}\n` +
      `• *Total Expenses:* ₹${totalExpenses}\n` +
      `\n📥 *PAYMENT IN*\n` +
      `• *Cash In:* ₹${cashFlow.cashIn}\n` +
      `• *Online In:* ₹${cashFlow.onlineIn.total}\n` +
      (onlineBreakdownText ? `${onlineBreakdownText}\n` : '') +
      `\n📤 *PAYMENT OUT*\n` +
      `• *Cash Out:* ₹${cashFlow.cashOut}\n` +
      `• *Online Out:* ₹${cashFlow.onlineOut}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Automated Daily Report via MS Billings POS_`;

    const workbook = generateDayBookWorkbook(restName, now, transactions, cashFlow, revenueLeakage);
    const buffer = await workbook.xlsx.writeBuffer();
    const excelBase64 = buffer.toString('base64');

    return { msg, excelBase64, dateStr };
  } catch (err) {
    console.error(`[WhatsApp Scheduler] Failed to generate daybook for ${databaseName}:`, err);
    return null;
  }
};

export const triggerAutoDayBookForTenant = async (dbName) => {
  try {
    const models = await getTenantModels(dbName);
    const Setting = models.Setting;
    
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
    let settings = settingsDoc?.value;
    if (typeof settings === 'string') {
      try { settings = JSON.parse(settings); } catch (e) {}
    }

    const waManager = whatsappManager.getInstance(dbName);
    await waManager.ensureConnection();
    const waStatus = waManager.getStatus();

    let targetPhone = waStatus.connectedNumber || settings?.whatsappNumber || settings?.phone;

    if (!targetPhone) {
      try {
        const dbStatusDoc = await Setting.findOne({ key: 'whatsapp_status' }).lean();
        if (dbStatusDoc?.value?.connectedNumber) {
          targetPhone = dbStatusDoc.value.connectedNumber;
        }
      } catch (e) {}
    }

    if (!targetPhone) {
      console.warn(`[WhatsApp Scheduler] No target phone number configured for tenant ${dbName}`);
      return { success: false, error: 'No destination phone number found.' };
    }

    const result = await generateAutoDayBookWhatsAppMessage(dbName);
    if (!result || !result.msg) {
      return { success: false, error: 'Failed to generate DayBook report.' };
    }

    console.log(`[WhatsApp Scheduler] Executing auto-daybook for ${dbName} to ${targetPhone}...`);
    
    if (result.excelBase64) {
      await waManager.sendBillMedia(targetPhone, {
        documentBase64: result.excelBase64,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        caption: result.msg,
        fileName: `DayBook-${result.dateStr.replace(/\//g, '-')}.xlsx`
      });
    } else {
      await waManager.sendMessage(targetPhone, result.msg);
    }

    return { success: true, message: `Auto DayBook report delivered to +${targetPhone}` };
  } catch (err) {
    console.error(`[WhatsApp Scheduler] Error executing auto-daybook for tenant ${dbName}:`, err);
    return { success: false, error: err.message };
  }
};

export const startWhatsAppScheduler = () => {
  cron.schedule('* * * * *', async () => {
    try {
      if (mongoose.connection.readyState !== 1) return;

      const now = new Date();
      
      // Calculate 24-hour time strings for Server Local Time & IST (India Standard Time)
      const hLocal = String(now.getHours()).padStart(2, '0');
      const mLocal = String(now.getMinutes()).padStart(2, '0');
      const timeLocal24 = `${hLocal}:${mLocal}`;

      let timeIST24 = timeLocal24;
      let todayDateStr = now.toISOString().split('T')[0];
      try {
        const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
        const parts = istStr.split(',');
        if (parts[1]) {
          const [h, m] = parts[1].trim().split(':');
          timeIST24 = `${(h || '').padStart(2, '0')}:${(m || '').padStart(2, '0')}`;
        }
        const [mDate, dDate, yDate] = (parts[0] || '').trim().split('/');
        if (yDate && mDate && dDate) {
          todayDateStr = `${yDate}-${mDate.padStart(2, '0')}-${dDate.padStart(2, '0')}`;
        }
      } catch (e) {}

      const validTimeStrings = [timeLocal24, timeIST24];

      // Fetch all active tenant databases across cloud & local setups
      let tenantDatabases = [];
      try {
        const clients = await ClientDefault.find({ status: { $ne: 'Inactive' } }).select('databaseName').lean();
        tenantDatabases = clients.map(c => c.databaseName).filter(Boolean);
      } catch (e) {}

      const primaryDb = mongoose.connection.db?.databaseName;
      if (primaryDb && primaryDb !== 'admin' && primaryDb !== 'local' && !tenantDatabases.includes(primaryDb)) {
        tenantDatabases.push(primaryDb);
      }

      for (const dbName of tenantDatabases) {
        try {
          const models = await getTenantModels(dbName);
          const Setting = models.Setting;
          
          const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
          if (!settingsDoc) continue;
          
          let settings = settingsDoc.value;
          if (typeof settings === 'string') {
            try { settings = JSON.parse(settings); } catch (e) {}
          }

          if (!settings) continue;

          const isEnabled = settings.autoSendDaybook === true || settings.autoSendDaybook === 'true' || settings.autoSendDaybook === 1 || settings.autoSendDaybook === '1';
          const setTime = (settings.autoSendTime || '22:00').trim();

          if (isEnabled && validTimeStrings.includes(setTime)) {
            // Check if already sent today to prevent duplicates
            if (settings.lastAutoDayBookSentDate === todayDateStr) {
              continue;
            }

            console.log(`[WhatsApp Scheduler] Time match found (${setTime}) for tenant ${dbName}. Triggering DayBook report...`);
            
            const res = await triggerAutoDayBookForTenant(dbName);
            if (res && res.success) {
              // Update lastAutoDayBookSentDate in database
              try {
                settings.lastAutoDayBookSentDate = todayDateStr;
                await Setting.findOneAndUpdate(
                  { key: 'restaurantSettings' },
                  { value: settings },
                  { upsert: true }
                );
              } catch (saveErr) {}
            }
          }
        } catch (tenantErr) {
          console.error(`[WhatsApp Scheduler] Error processing tenant ${dbName}:`, tenantErr);
        }
      }
    } catch (err) {
      console.error('[WhatsApp Scheduler] Cron execution error:', err);
    }
  });
  console.log('[WhatsApp Scheduler] Auto-DayBook cron job initialized.');
};
