import cron from 'node-cron';
import mongoose from 'mongoose';
import fs from 'fs';
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
    let startDate, endDate;
    try {
      const istStr = now.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
      const [datePart] = istStr.split(',');
      const [d, m, y] = datePart.trim().split('/');
      const istDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      startDate = new Date(`${istDate}T00:00:00.000+05:30`);
      endDate = new Date(`${istDate}T23:59:59.999+05:30`);
    } catch (e) {
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    }

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

export const processFeedbackMessagesForTenant = async (dbName, targetBillId = null) => {
  const logFb = (msg) => {
    try {
      fs.appendFileSync('D:/restaurant/Restaurant-billing/Backend/feedback_debug.log', `[${new Date().toISOString()}] ${msg}\n`);
    } catch(e) {}
    console.log(`[WhatsApp Feedback] ${msg}`);
  };
  logFb(`Checking feedback for tenant "${dbName}", targetBillId: ${targetBillId || 'none'}`);
  try {
    logFb('Step 1: calling getTenantModels...');
    const models = await getTenantModels(dbName);
    logFb('Step 2: models obtained');
    const Setting = models.Setting;
    const Bill = models.Bill;
    const Customer = models.Customer;
    
    logFb('Step 3: fetching settingsDoc...');
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
    logFb('Step 4: settingsDoc = ' + Boolean(settingsDoc));
    if (!settingsDoc) {
      logFb(`No settings found for ${dbName}`);
      return { success: false, reason: 'no_settings' };
    }
    let settings = settingsDoc.value;
    if (typeof settings === 'string') {
      try { settings = JSON.parse(settings); } catch (e) {}
    }
    if (!settings) {
      logFb(`Invalid settings for ${dbName}`);
      return { success: false, reason: 'invalid_settings' };
    }

    const isFeedbackEnabled = settings.feedback_whatsapp_enabled === true || settings.feedback_whatsapp_enabled === 'true';
    if (!isFeedbackEnabled) {
      logFb(`Feedback not enabled for ${dbName} (value: ${settings.feedback_whatsapp_enabled})`);
      return { success: false, reason: 'feedback_disabled' };
    }

    let reviewLink = settings.google_review_link || settings.googleReviewLink;
    if (!reviewLink || !reviewLink.trim()) {
      const reviewDoc = await Setting.findOne({ key: 'googleReviewLink' }).lean();
      reviewLink = reviewDoc?.value;
    }
    logFb(`reviewLink found: "${reviewLink}"`);
    if (!reviewLink || !reviewLink.trim()) {
      logFb(`Feedback is enabled but no Google Review link is set.`);
      return { success: false, reason: 'no_review_link' };
    }
    
    // We are passing the original long reviewLink directly to avoid third-party preview pages/ads
    const shortReviewLink = reviewLink;

    const delayMins = Number(settings.feedback_whatsapp_delay_minutes) || 0;
    const cutoffTime = new Date(Date.now() - delayMins * 60000);

    let eligibleBills = [];
    if (targetBillId) {
      const targetBill = await Bill.findById(targetBillId);
      if (targetBill && targetBill.status === 'Paid' && targetBill.feedbackProcessed !== true && targetBill.customerPhone) {
        if (delayMins === 0 || (targetBill.settledAt && targetBill.settledAt <= cutoffTime)) {
          eligibleBills.push(targetBill);
        }
      }
    }

    const timeCondition = delayMins > 0
      ? { settledAt: { $lte: cutoffTime } }
      : {
          $or: [
            { settledAt: { $lte: new Date(Date.now() + 60000) } },
            { settledAt: { $exists: false } },
            { settledAt: null }
          ]
        };

    const query = {
      status: 'Paid',
      feedbackProcessed: { $ne: true },
      ...timeCondition,
      customerPhone: { $exists: true, $ne: '' }
    };
    if (targetBillId) {
      query._id = { $ne: targetBillId };
    }

    const pendingBills = await Bill.find(query).sort({ settledAt: -1, createdAt: -1 }).limit(20);
    if (pendingBills && pendingBills.length > 0) {
      eligibleBills = [...eligibleBills, ...pendingBills];
    }

    logFb(`Found ${eligibleBills.length} eligible bill(s).`);
    if (eligibleBills.length === 0) {
      return { success: true, count: 0, message: 'No eligible bills found' };
    }

    const waManager = whatsappManager.getInstance(dbName, settings.restaurantName);
    logFb(`Ensuring WhatsApp connection for ${dbName}...`);
    await waManager.ensureConnection();

    const waStatus = waManager.getStatus();
    const isSocketOpen = waManager.sock && (waManager.sock.ws?.readyState === 1 || waManager.sock.ws?.isOpen === true || waManager.sock.ws?.socket?.readyState === 1);
    const isReady = (waStatus.status === 'CONNECTED' || Boolean(waManager.sock?.user?.id)) && isSocketOpen;
    logFb(`WhatsApp status: ${waStatus.status}, isReady: ${isReady}, sock: ${Boolean(waManager.sock)}`);

    if (!isReady && waStatus.status !== 'CONNECTED') {
      logFb(`WhatsApp is currently ${waStatus.status}. Will process feedback once bot is connected.`);
      return { success: false, reason: 'whatsapp_not_connected', status: waStatus.status };
    }

    let sentCount = 0;
    let skippedCount = 0;
    for (const bill of eligibleBills) {
      let rawPhone = (bill.customerPhone || '').replace(/[^0-9]/g, '');
      if (!rawPhone || rawPhone.length < 10) {
        bill.feedbackProcessed = true;
        await bill.save();
        skippedCount++;
        continue;
      }

      let cleanPhone = rawPhone;
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
        cleanPhone = '91' + cleanPhone.slice(1);
      }

      const phone10 = cleanPhone.slice(-10);

      // Check if customer already received feedback
      let customer = await Customer.findOne({
        phone: { $in: [phone10, '91' + phone10, '+91' + phone10, cleanPhone] }
      });

      if (customer && customer.feedbackWhatsAppSent === true) {
        console.log(`[WhatsApp Feedback] Customer ${phone10} already received feedback previously. Marking bill #${bill.billNumber} processed.`);
        bill.feedbackProcessed = true;
        await bill.save();
        skippedCount++;
        continue;
      }

      const custName = (customer?.name && customer.name !== 'Guest') 
        ? customer.name 
        : (bill.customerName && bill.customerName !== 'Guest' ? bill.customerName : '');

      try {
        logFb(`🚀 Sending review link to ${cleanPhone} (Bill #${bill.billNumber}) for tenant ${dbName}...`);
        await Promise.race([
          waManager.sendFeedbackMessage(cleanPhone, custName, shortReviewLink, settings.restaurantName),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Feedback message send timed out')), 15000))
        ]);
        
        // Mark customer as sent so they never receive duplicate review requests
        if (customer) {
          customer.feedbackWhatsAppSent = true;
          await customer.save();
        } else {
          await Customer.findOneAndUpdate(
            { phone: phone10 },
            {
              $set: {
                feedbackWhatsAppSent: true,
                name: custName || 'Guest'
              }
            },
            { upsert: true }
          );
        }

        bill.feedbackProcessed = true;
        await bill.save();
        sentCount++;
        logFb(`✅ Feedback successfully sent to ${cleanPhone} for bill #${bill.billNumber}!`);
      } catch (sendErr) {
        logFb(`❌ Failed to send feedback to ${cleanPhone}: ${sendErr?.message || sendErr}`);
        console.error(`[WhatsApp Feedback] ❌ Failed to send feedback to ${cleanPhone}:`, sendErr?.message || sendErr);
        // Do NOT mark bill.feedbackProcessed = true so it can be retried on next pass or reconnection!
      }

      // Small delay between sends to prevent rate limits
      await new Promise(res => setTimeout(res, 500));
    }

    return { success: true, sentCount, skippedCount, total: eligibleBills.length };
  } catch (err) {
    logFb(`FATAL ERROR: ${err?.message || err}\n${err?.stack || ''}`);
    console.error(`[WhatsApp Scheduler] Error processing feedback for ${dbName}:`, err);
    return { success: false, error: err.message };
  }
};

export const processWinbackCampaignsForTenant = async (dbName, validTimeStrings, todayDateStr) => {
  try {
    const models = await getTenantModels(dbName);
    const Setting = models.Setting;
    const Customer = models.Customer;
    
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
    if (!settingsDoc) return;
    let settings = settingsDoc.value;
    if (typeof settings === 'string') {
      try { settings = JSON.parse(settings); } catch (e) {}
    }
    if (!settings) return;

    const isEnabled = settings.winback_enabled === true || settings.winback_enabled === 'true';
    if (!isEnabled) return;

    // Check execute time (default 11:00 AM)
    const executeTime = settings.winback_execute_time || '11:00';
    if (!validTimeStrings.has(executeTime)) return;

    // Only run once per day
    if (settings.lastWinbackRunDate === todayDateStr) return;

    const offerText = settings.winback_offer_text;
    if (!offerText || !offerText.trim()) return;

    const inactivityDays = Number(settings.winback_days_inactive) || 60;
    const cutoffDate = new Date(Date.now() - inactivityDays * 86400000);
    const cooldownDate = new Date(Date.now() - 60 * 86400000); // 60 days cooldown

    // Find customers who haven't visited in `inactivityDays` and either never received a winback OR received one > 60 days ago
    const eligibleCustomers = await Customer.find({
      lastVisit: { $lte: cutoffDate },
      $or: [
        { lastWinbackSentDate: null },
        { lastWinbackSentDate: { $lte: cooldownDate } }
      ],
      phone: { $exists: true, $ne: '' }
    }).limit(50);

    if (eligibleCustomers.length === 0) {
      // Still mark as run for today so it doesn't query again next minute
      settings.lastWinbackRunDate = todayDateStr;
      await Setting.findOneAndUpdate({ key: 'restaurantSettings' }, { value: settings }, { upsert: true });
      return;
    }

    const waManager = whatsappManager.getInstance(dbName);
    await waManager.ensureConnection();
    const waStatus = waManager.getStatus();
    
    if (waStatus.status !== 'CONNECTED') return;

    console.log(`[WhatsApp Scheduler] Running Win-Back for ${dbName}. Target: ${eligibleCustomers.length} customers.`);

    for (const customer of eligibleCustomers) {
      let phone = customer.phone;
      let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

      if (!cleanPhone || cleanPhone.length < 10) continue;

      const customerName = customer.name || 'there';
      const personalizedMessage = offerText.replace(/\[Name\]/gi, customerName);

      try {
        await waManager.sendTextMessage(cleanPhone, personalizedMessage);
        customer.lastWinbackSentDate = new Date();
        await customer.save();
        await new Promise(res => setTimeout(res, 3000)); // 3s delay to avoid spamming WhatsApp
      } catch (err) {
        console.error(`[WhatsApp Scheduler] Failed to send win-back to ${cleanPhone} for db ${dbName}:`, err);
      }
    }

    settings.lastWinbackRunDate = todayDateStr;
    await Setting.findOneAndUpdate({ key: 'restaurantSettings' }, { value: settings }, { upsert: true });

  } catch (err) {
    console.error(`[WhatsApp Scheduler] Error processing win-back for ${dbName}:`, err);
  }
};

export const startWhatsAppScheduler = () => {
  cron.schedule('* * * * *', async () => {
    try {
      if (mongoose.connection.readyState !== 1) return;

      const now = new Date();

      // Build current IST time string "HH:MM" and today's IST date string
      let timeIST24 = '';
      let todayDateStr = '';
      try {
        const istStr = now.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
        const parts = istStr.split(',');
        if (parts[1]) {
          const [h, m] = parts[1].trim().split(':');
          timeIST24 = `${(h || '').padStart(2, '0')}:${(m || '').padStart(2, '0')}`;
        }
        const [dDate, mDate, yDate] = (parts[0] || '').trim().split('/');
        if (yDate && mDate && dDate) {
          todayDateStr = `${yDate}-${mDate.padStart(2, '0')}-${dDate.padStart(2, '0')}`;
        }
      } catch (e) {
        // Fallback to local time if formatting fails
        const hLocal = String(now.getHours()).padStart(2, '0');
        const mLocal = String(now.getMinutes()).padStart(2, '0');
        timeIST24 = `${hLocal}:${mLocal}`;
        todayDateStr = now.toISOString().split('T')[0];
      }

      const validTimeStrings = new Set([timeIST24]);

      // Fetch all active tenant databases
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

          // ── Process Feedback Messages ──
          try {
            if (settingsDoc) {
              let s = settingsDoc.value;
              if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) {} }
              if (s && (s.feedback_whatsapp_enabled === true || s.feedback_whatsapp_enabled === 'true')) {
                await processFeedbackMessagesForTenant(dbName);
              }
            }
          } catch (e) {
            console.error(`[WhatsApp Scheduler] Feedback error for ${dbName}:`, e);
          }

          // ── Process Win-Back Campaigns ──
          try {
            await processWinbackCampaignsForTenant(dbName, validTimeStrings, todayDateStr);
          } catch (e) {
            console.error(`[WhatsApp Scheduler] Win-Back error for ${dbName}:`, e);
          }

          if (!settingsDoc) continue;

          let settings = settingsDoc.value;
          if (typeof settings === 'string') {
            try { settings = JSON.parse(settings); } catch (e) {}
          }
          if (!settings) continue;

          const isEnabled = settings.autoSendDaybook === true || settings.autoSendDaybook === 'true'
            || settings.autoSendDaybook === 1 || settings.autoSendDaybook === '1';
          if (!isEnabled) continue;

          // ── Slot 1: Afternoon (autoSendTime, default 14:30) ──
          const slot1Time = (typeof settings.autoSendTime === 'string' && settings.autoSendTime.trim())
            ? settings.autoSendTime.trim() : '14:30';

          // ── Slot 2: Night (autoSendTime2, default 22:30) ──
          const slot2Time = (typeof settings.autoSendTime2 === 'string' && settings.autoSendTime2.trim())
            ? settings.autoSendTime2.trim() : '22:30';

          // Strict: both times must be valid HH:MM, at least 1h apart
          const toMins = (t) => {
            const [h, m] = (t || '').split(':').map(Number);
            return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
          };
          const diff = Math.abs(toMins(slot1Time) - toMins(slot2Time));
          const timesValid = diff >= 60; // enforce at least 1 hour gap

          let settingsChanged = false;

          // ── Check Slot 1 ──
          if (timesValid && validTimeStrings.has(slot1Time)) {
            if (settings.lastAutoDayBookSentDate !== todayDateStr) {
              console.log(`[WhatsApp Scheduler] Afternoon slot match (${slot1Time}) for ${dbName}. Sending...`);
              const res = await triggerAutoDayBookForTenant(dbName);
              if (res && res.success) {
                settings.lastAutoDayBookSentDate = todayDateStr;
                settingsChanged = true;
              }
            }
          }

          // ── Check Slot 2 ──
          if (timesValid && validTimeStrings.has(slot2Time)) {
            if (settings.lastAutoDayBookSentDate2 !== todayDateStr) {
              console.log(`[WhatsApp Scheduler] Night slot match (${slot2Time}) for ${dbName}. Sending...`);
              const res = await triggerAutoDayBookForTenant(dbName);
              if (res && res.success) {
                settings.lastAutoDayBookSentDate2 = todayDateStr;
                settingsChanged = true;
              }
            }
          }

          if (settingsChanged) {
            try {
              await Setting.findOneAndUpdate(
                { key: 'restaurantSettings' },
                { value: settings },
                { upsert: true }
              );
            } catch (saveErr) {
              console.error(`[WhatsApp Scheduler] Failed to save sent-date for ${dbName}:`, saveErr);
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
  console.log('[WhatsApp Scheduler] Auto-DayBook cron job initialized (2 daily slots: afternoon + night).');
};

