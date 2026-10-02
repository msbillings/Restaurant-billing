import mongoose from 'mongoose';
import whatsappManager from '../services/whatsappService.js';
import { getTenantModels } from '../utils/tenantManager.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import BillDefault from '../models/Bill.js';
import { uploadImage } from '../utils/cloudinary.js';

// Tracks bills being processed — key stays in Set until ALL retries complete
const processingBills = new Set();

async function processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, attempt = 1, lockKey = null) {
  const releaseLock = () => { if (lockKey) processingBills.delete(lockKey); };

  // ── DB guard: check if already sent before EVERY attempt (including attempt 1) ──
  if (BillModel && (billId || billNumber)) {
    try {
      const query = billId && mongoose.Types.ObjectId.isValid(billId) ? { _id: billId } : { billNumber: billNumber || billId };
      const existing = await BillModel.findOne(query).select('whatsappSent').lean();
      if (existing && existing.whatsappSent) {
        console.log('[Queue] 🛑 Bill ' + (billNumber||billId) + ' already marked as sent in DB (attempt ' + attempt + '). Stopping to prevent duplicate.');
        releaseLock();
        return { success: true };
      }
    } catch(e) {}
  }

  try {
    // Mark in DB BEFORE sending — so if Baileys times out locally but message was delivered,
    // the next retry's DB check above will catch it and NOT send again.
    if (BillModel && (billId || billNumber)) {
      const updateQuery = billId && mongoose.Types.ObjectId.isValid(billId) ? { _id: billId } : { billNumber: billNumber || billId };
      await BillModel.updateOne(updateQuery, { $set: { whatsappSent: true, whatsappSentAt: new Date() } }).catch(e => console.error('[Queue] DB pre-mark error:', e));
    }

    await whatsappService.sendBillMedia(phone, payload);
    console.log('[Queue] ✅ Successfully sent bill to ' + phone + ' on attempt ' + attempt);
    releaseLock();
    return { success: true };
  } catch (error) {
    // Roll back the DB flag since the send failed locally (might still be in-flight on WA servers)
    if (BillModel && (billId || billNumber)) {
      const updateQuery = billId && mongoose.Types.ObjectId.isValid(billId) ? { _id: billId } : { billNumber: billNumber || billId };
      BillModel.updateOne(updateQuery, { $set: { whatsappSent: false } }).catch(() => {});
    }

    if (attempt < 3) {
      // Reduced to max 3 retries to reduce duplicate risk
      console.warn('[Queue] Send failed for ' + phone + ' (Attempt ' + attempt + '/3): ' + error.message + '. Retrying in 10 seconds...');
      setTimeout(() => {
        processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, attempt + 1, lockKey);
      }, 10000);
      // Lock stays in processingBills — do NOT release yet
      return { success: false, queued: true, error: error.message };
    } else {
      console.error('[Queue] ❌ Send permanently failed for ' + phone + ' after 3 attempts!');
      releaseLock();
      return { success: false, queued: false };
    }
  }
}

export const resolveTenantInfo = async (req) => {
  let tenantId = req.user?.db || req.tenantDb || req.headers?.['x-tenant-db'] || req.headers?.['X-Tenant-DB'] || req.query?.tenant || req.body?.tenant || req.models?.connection?.name;
  
  if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
    tenantId = 'default';
  }
  
  // High-speed fast path: If WhatsAppService already initialized in memory for this exact tenantId, return immediately (0ms)
  if (tenantId !== 'default' && whatsappManager.hasInstance(tenantId)) {
    const existing = whatsappManager.getInstance(tenantId);
    if (existing.restaurantName) {
      return { tenantId, restaurantName: existing.restaurantName, whatsappService: existing };
    }
  }

  let restaurantName = req.headers?.['x-restaurant-name'] || req.headers?.['X-Restaurant-Name'] || null;
  try {
    const models = req.models || (await getTenantModels(tenantId));
    if (models?.Setting) {
      const settingsDoc = await models.Setting.findOne({ key: 'restaurantSettings' }).lean();
      let settings = settingsDoc?.value;
      if (typeof settings === 'string') {
        try { settings = JSON.parse(settings); } catch (e) {}
      }
      if (settings?.restaurantName) {
        restaurantName = settings.restaurantName;
      }
    }
  } catch (e) {}

  const whatsappService = whatsappManager.getInstance(tenantId, restaurantName);
  return { tenantId, restaurantName, whatsappService };
};

export const getStatus = async (req, res) => {
  try {
    const { tenantId, restaurantName, whatsappService } = await resolveTenantInfo(req);
    const status = whatsappService.getStatus();

    // 1. If live in-memory service is CONNECTED, return immediately (0ms)
    if (status.status === 'CONNECTED' && status.connectedNumber) {
      return res.json(status);
    }

    // 2. Cross-Device Sync: Check MongoDB persisted whatsapp_status ONLY for valid tenantId
    try {
      if (tenantId && tenantId !== 'default') {
        const models = req.models || (await getTenantModels(tenantId));
        if (models?.Setting) {
          const dbStatusDoc = await models.Setting.findOne({ key: 'whatsapp_status' }).lean();
          if (dbStatusDoc?.value?.status === 'CONNECTED' && dbStatusDoc?.value?.connectedNumber) {
            const dbVal = dbStatusDoc.value;
            const hasAuthCreds = models.WhatsAppAuth ? (await models.WhatsAppAuth.countDocuments({ id: 'creds' })) > 0 : false;
            if (hasAuthCreds && status.status !== 'SCAN_QR') {
              const dispName = dbVal.restaurantName || restaurantName || 'MS Billings POS';
              const devName = dbVal.deviceName || `${dispName} Gateway`;
              
              // Auto-trigger background connection supervisor if socket dropped
              if (whatsappService.status === 'DISCONNECTED') {
                whatsappService.ensureConnection().catch(() => {});
              }

              return res.json({
                status: 'CONNECTED',
                connectedNumber: dbVal.connectedNumber,
                userName: dispName,
                restaurantName: dispName,
                platform: `${dispName} POS`,
                deviceName: devName,
                linkedAt: dbVal.linkedAt || new Date().toISOString(),
                linkedDevices: [
                  {
                    id: 'dev_1',
                    name: devName,
                    platform: `${dispName} Gateway`,
                    status: 'Active',
                    lastActive: 'Just now',
                    phoneNumber: `+${dbVal.connectedNumber}`
                  }
                ],
                totalLinkedDevices: 1,
                hasQr: false,
                qr: null
              });
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn(`[WhatsApp Controller - ${tenantId}] DB status check warning:`, dbErr.message);
    }

    res.json(status);
  } catch (error) {
    console.error('Error fetching WhatsApp status:', error);
    res.status(500).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const { tenantId, whatsappService } = await resolveTenantInfo(req);
    const result = await whatsappService.logout();

    // Clear database status as well
    try {
      const models = req.models || (await getTenantModels(tenantId));
      if (models?.Setting) {
        await models.Setting.findOneAndUpdate(
          { key: 'whatsapp_status' },
          { value: { status: 'DISCONNECTED', connectedNumber: null, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
      }
    } catch (e) {}

    res.json(result);
  } catch (error) {
    console.error('Error logging out of WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone number and message are required.' });
    }

    const { tenantId, whatsappService } = await resolveTenantInfo(req);
    console.log(`[WhatsApp API Diagnostics - ${tenantId}] Processing sendMessage request for +${phone}...`);
    
    await whatsappService.ensureConnection();

    try {
      const result = await whatsappService.sendMessage(phone, message);
      console.log(`[WhatsApp API Diagnostics - ${tenantId}] Test message sent successfully to +${phone}!`);
      return res.json({ success: true, message: 'WhatsApp message sent successfully!', result });
    } catch (sendErr) {
      console.warn(`[WhatsApp API Diagnostics - ${tenantId}] First sendMessage attempt warning: ${sendErr?.message}. Forcing reconnect and retrying...`);
      await whatsappService.ensureConnection(true);
      const retryResult = await whatsappService.sendMessage(phone, message);
      console.log(`[WhatsApp API Diagnostics - ${tenantId}] Retry sendMessage succeeded for +${phone}!`);
      return res.json({ success: true, message: 'WhatsApp message sent successfully (after auto-reconnect)!', result: retryResult });
    }
  } catch (error) {
    console.error('[WhatsApp API Diagnostics] Final sendMessage error:', error?.message || error);
    res.status(500).json({ error: error.message || 'Failed to send WhatsApp message.' });
  }
};

export const sendBill = async (req, res) => {
  try {
    const { phone, billText, imageBase64, pdfBase64, documentBase64, mimetype, fileName, billId, billNumber, forceResend } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Destination phone number is required.' });
    }

    // --- DIAGNOSTIC: Log payload sizes ---
    const imgKB  = imageBase64    ? Math.round(imageBase64.length    * 0.75 / 1024) : 0;
    const pdfKB  = pdfBase64      ? Math.round(pdfBase64.length      * 0.75 / 1024) : 0;
    const docKB  = documentBase64 ? Math.round(documentBase64.length * 0.75 / 1024) : 0;
    console.log(`[WhatsApp sendBill] ▶ phone=${phone} | imageKB=${imgKB} | pdfKB=${pdfKB} | docKB=${docKB} | hasText=${!!billText} | billId=${billId || 'none'} | billNumber=${billNumber || 'none'} | forceResend=${!!forceResend}`);

    const { tenantId, whatsappService } = await resolveTenantInfo(req);

    // --- Prevent duplicate WhatsApp sends for the same bill ---
    const lockKey = `${tenantId}_${billId || billNumber}`;
    if (!forceResend) {
      if (processingBills.has(lockKey)) {
        return res.status(409).json({ error: 'This bill is currently being sent.', alreadySent: true });
      }
      processingBills.add(lockKey);
    }
    
    let models = null;
    try {
      models = req.models || (await getTenantModels(tenantId));
    } catch (e) {}

    const BillModel = (models && models.Bill) || getTenantModel(req, 'Bill', BillDefault);

    if (!forceResend && BillModel && (billId || billNumber)) {
      try {
        const query = billId && mongoose.Types.ObjectId.isValid(billId)
          ? { _id: billId }
          : { billNumber: billNumber || billId };
        const existingBill = await BillModel.findOne(query).select('whatsappSent billNumber').lean();
        if (existingBill && existingBill.whatsappSent) {
          console.warn(`[WhatsApp sendBill] ⚠️ Bill ${existingBill.billNumber || billId} was already sent via WhatsApp. Preventing duplicate send.`);
          return res.status(409).json({
            error: 'This bill has already been sent to customer via WhatsApp.',
            alreadySent: true
          });
        }
      } catch (checkErr) {
        console.warn('[WhatsApp sendBill] Duplicate check warning:', checkErr?.message);
      }
    }

    const cleanupLock = () => { if (!forceResend) processingBills.delete(lockKey); };

    // --- DIAGNOSTIC: Log socket state BEFORE ensureConnection ---
    const wsStateBefore = whatsappService.sock?.ws?.socket?.readyState ?? whatsappService.sock?.ws?.readyState ?? 'none';
    console.log(`[WhatsApp sendBill] Socket readyState BEFORE ensureConnection: ${wsStateBefore} | service.status: ${whatsappService.status}`);

    await whatsappService.ensureConnection();

    // --- DIAGNOSTIC: Log socket state AFTER ensureConnection ---
    const wsStateAfter = whatsappService.sock?.ws?.socket?.readyState ?? whatsappService.sock?.ws?.readyState ?? 'none';
    const svcStatus    = whatsappService.getStatus();
    console.log(`[WhatsApp sendBill] Socket readyState AFTER  ensureConnection: ${wsStateAfter} | service.status: ${whatsappService.status} | connected: ${svcStatus.status}`);

    if (svcStatus.status !== 'CONNECTED' || !whatsappService.connectedNumber) {
      console.error(`[WhatsApp sendBill] ❌ Bot not connected (status=${svcStatus.status}) — aborting send. tenantId=${tenantId}`);
      return res.status(400).json({ success: false, error: 'WhatsApp bot is not connected. Please scan QR or pair your phone in Settings.' });
    }

    if (!imageBase64 && !pdfBase64 && !documentBase64) {
      console.error(`[WhatsApp sendBill] ❌ No receipt photo image provided — aborting. Bill image is mandatory. tenantId=${tenantId}`);
      return res.status(400).json({ error: 'Receipt photo image is mandatory for sending WhatsApp e-Bill.' });
    }

    let imageUrl = null;
      // Dispatch to dynamic retry queue
      console.log(`[WhatsApp sendBill] Queueing MEDIA (Receipt Photo) to ${phone}... (hasCloudUrl=${!!imageUrl})`);
      
      const payload = {
          imageBase64,
          imageUrl,
          pdfBase64,
          documentBase64,
          mimetype,
          caption: billText,
          fileName
      };
      
      // Do not block the request. Send the first attempt and handle retries asynchronously.
      // lockKey is passed so it stays locked through ALL retries — preventing duplicate sends.
      const initialAttempt = await processSendBillMediaWithRetries(whatsappService, phone, payload, tenantId, billId, billNumber, BillModel, 1, !forceResend ? lockKey : null);
      
      // Note: cleanupLock() is NO longer called here — the retry function releases the lock itself
      if (initialAttempt && initialAttempt.success) {
          return res.json({ success: true, message: 'e-Bill sent successfully via WhatsApp!' });
      } else {
          // First attempt failed — retrying in background (lock still held to block duplicate requests).
          return res.status(202).json({ 
              success: false,
              queued: true,
              message: 'WhatsApp send failed on first attempt. Retrying in background. Customer may receive it shortly.'
          });
      }
  } catch (error) {
    console.error('[WhatsApp sendBill] ❌ FINAL ERROR:', error?.message);
    console.error('[WhatsApp sendBill] Stack Trace:', error?.stack);
    res.status(500).json({ error: error.message || 'Failed to send WhatsApp bill.' });
  }
};

export const requestPairingCode = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
    const { whatsappService } = await resolveTenantInfo(req);
    const result = await whatsappService.requestPairingCode(phone);
    res.json(result);
  } catch (error) {
    console.error('Error generating WhatsApp pairing code:', error);
    res.status(500).json({ error: error.message });
  }
};

export const refreshQR = async (req, res) => {
  try {
    const { whatsappService } = await resolveTenantInfo(req);
    const result = await whatsappService.refreshQR();
    res.json(result);
  } catch (error) {
    console.error('Error refreshing WhatsApp QR:', error);
    res.status(500).json({ error: error.message });
  }
};

export const triggerAutoDayBook = async (req, res) => {
  try {
    const { tenantId } = await resolveTenantInfo(req);
    const { triggerAutoDayBookForTenant } = await import('../utils/whatsappScheduler.js');
    const result = await triggerAutoDayBookForTenant(tenantId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error triggering auto DayBook:', error);
    res.status(500).json({ error: error.message });
  }
};

export const logCampaign = async (req, res) => {
  try {
    const { tenantId } = await resolveTenantInfo(req);
    const models = req.models || (await getTenantModels(tenantId));
    const CampaignModel = models?.Campaign;
    if (!CampaignModel) {
      return res.status(500).json({ error: 'Campaign model not available' });
    }

    const {
      title,
      offerName,
      offerId,
      message,
      imageUrl,
      targetSegment,
      totalRecipients,
      sentCount,
      failedCount,
      status,
      recipients
    } = req.body;

    const campaign = new CampaignModel({
      title: title || 'WhatsApp Offer Broadcast',
      offerName: offerName || '',
      offerId: offerId && mongoose.Types.ObjectId.isValid(offerId) ? offerId : null,
      message: message || '',
      imageUrl: imageUrl || '',
      targetSegment: targetSegment || 'all',
      totalRecipients: Number(totalRecipients) || 0,
      sentCount: Number(sentCount) || 0,
      failedCount: Number(failedCount) || 0,
      status: status || 'completed',
      recipients: Array.isArray(recipients) ? recipients : []
    });

    await campaign.save();
    res.json({ success: true, campaign });
  } catch (error) {
    console.error('[WhatsApp logCampaign error]:', error);
    res.status(500).json({ error: error.message || 'Failed to log campaign.' });
  }
};

export const getCampaignHistory = async (req, res) => {
  try {
    const { tenantId } = await resolveTenantInfo(req);
    const models = req.models || (await getTenantModels(tenantId));
    const CampaignModel = models?.Campaign;
    if (!CampaignModel) {
      return res.status(500).json({ error: 'Campaign model not available' });
    }

    const campaigns = await CampaignModel.find().sort({ sentAt: -1 }).limit(50).lean();
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('[WhatsApp getCampaignHistory error]:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch campaign history.' });
  }
};

export const triggerFeedback = async (req, res) => {
  try {
    const { tenantId } = await resolveTenantInfo(req);
    const { processFeedbackMessagesForTenant } = await import('../utils/whatsappScheduler.js');
    const billId = req.body?.billId || req.query?.billId || null;
    processFeedbackMessagesForTenant(tenantId, billId).catch(err => console.error('[triggerFeedback error]:', err));
    res.json({ success: true, message: 'Feedback processing triggered in background' });
  } catch (error) {
    console.error('Error triggering feedback:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getTemplates = async (req, res) => {
  try {
    const { tenantId } = await resolveTenantInfo(req);
    const models = req.models || (await getTenantModels(tenantId));
    if (!models?.Setting) return res.status(500).json({ error: 'Settings model not available' });

    let templatesDoc = await models.Setting.findOne({ key: 'whatsapp_templates' }).lean();
    
    const defaultTemplates = {
      loyaltyEarned: "Thank you for visiting! You earned [PointsEarned] points. Your new balance is [TotalPoints] points.",
      khataReminder: "Namaskaram [CustomerName], your pending Udhaar balance at [RestaurantName] is ₹[KhataBalance]. Please pay soon!",
      referralMessage: "Hey! [RestaurantName] uses MS Billings and loves it. Click here to get your first month free!",
      eBillReceipt: "Hi [CustomerName], thank you for dining at [RestaurantName]. Please find your e-Bill attached.",
      welcomeMessage: "Welcome to [RestaurantName], [CustomerName]! We are thrilled to have you. Enjoy 10% off your next visit!",
      birthdayWishes: "Happy Birthday [CustomerName]! Come celebrate at [RestaurantName] today and get a free dessert on us!",
      weMissYou: "Hi [CustomerName], it's been a while! We miss you at [RestaurantName]. Come back this week for a special surprise!",
      customMessage: "Hello [CustomerName], this is a special update from [RestaurantName]!"
    };
    
    let savedTemplates = {};
    if (templatesDoc && templatesDoc.value) {
      if (typeof templatesDoc.value === 'string') {
        try { savedTemplates = JSON.parse(templatesDoc.value); } catch(e) {}
      } else {
        savedTemplates = templatesDoc.value;
      }
    }

    let templates = { ...defaultTemplates, ...savedTemplates };

    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
};

export const saveTemplates = async (req, res) => {
  try {
    const { templates } = req.body;
    if (!templates) return res.status(400).json({ error: 'Templates data is required' });

    const { tenantId } = await resolveTenantInfo(req);
    const models = req.models || (await getTenantModels(tenantId));
    if (!models?.Setting) return res.status(500).json({ error: 'Settings model not available' });

    await models.Setting.findOneAndUpdate(
      { key: 'whatsapp_templates' },
      { value: templates },
      { upsert: true }
    );

    res.json({ success: true, message: 'Templates saved successfully' });
  } catch (error) {
    console.error('Error saving templates:', error);
    res.status(500).json({ error: error.message });
  }
};
