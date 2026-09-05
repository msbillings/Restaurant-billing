import whatsappManager from '../services/whatsappService.js';
import { getTenantModels } from '../utils/tenantManager.js';

export const resolveTenantInfo = async (req) => {
  let tenantId = req.user?.db || req.tenantDb || req.headers?.['x-tenant-db'] || req.query?.tenant || req.body?.tenant || req.models?.connection?.name;
  
  if (!tenantId || tenantId === 'default') {
    if (whatsappManager.instances.size === 1) {
      tenantId = Array.from(whatsappManager.instances.keys())[0];
    } else {
      tenantId = 'default';
    }
  }
  
  // High-speed fast path: If WhatsAppService already initialized in memory, return immediately (0ms)
  if (whatsappManager.hasInstance(tenantId)) {
    const existing = whatsappManager.getInstance(tenantId);
    if (existing.restaurantName) {
      return { tenantId, restaurantName: existing.restaurantName, whatsappService: existing };
    }
  }

  let restaurantName = req.headers?.['x-restaurant-name'] || null;
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

    // 2. Cross-Device Sync: Check MongoDB persisted whatsapp_status
    try {
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
    const { phone, billText, imageBase64, pdfBase64, documentBase64, mimetype, fileName } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Destination phone number is required.' });
    }

    // --- DIAGNOSTIC: Log payload sizes ---
    const imgKB  = imageBase64    ? Math.round(imageBase64.length    * 0.75 / 1024) : 0;
    const pdfKB  = pdfBase64      ? Math.round(pdfBase64.length      * 0.75 / 1024) : 0;
    const docKB  = documentBase64 ? Math.round(documentBase64.length * 0.75 / 1024) : 0;
    console.log(`[WhatsApp sendBill] ▶ phone=${phone} | imageKB=${imgKB} | pdfKB=${pdfKB} | docKB=${docKB} | hasText=${!!billText}`);

    const { tenantId, whatsappService } = await resolveTenantInfo(req);

    // --- DIAGNOSTIC: Log socket state BEFORE ensureConnection ---
    const wsStateBefore = whatsappService.sock?.ws?.socket?.readyState ?? whatsappService.sock?.ws?.readyState ?? 'none';
    console.log(`[WhatsApp sendBill] Socket readyState BEFORE ensureConnection: ${wsStateBefore} | service.status: ${whatsappService.status}`);

    await whatsappService.ensureConnection();

    // --- DIAGNOSTIC: Log socket state AFTER ensureConnection ---
    const wsStateAfter = whatsappService.sock?.ws?.socket?.readyState ?? whatsappService.sock?.ws?.readyState ?? 'none';
    const svcStatus    = whatsappService.getStatus();
    console.log(`[WhatsApp sendBill] Socket readyState AFTER  ensureConnection: ${wsStateAfter} | service.status: ${whatsappService.status} | connected: ${svcStatus.status}`);

    if (svcStatus.status !== 'CONNECTED' && !whatsappService.connectedNumber) {
      console.error(`[WhatsApp sendBill] ❌ Not connected — aborting send. tenantId=${tenantId}`);
      return res.status(400).json({ error: 'WhatsApp bot is not connected. Please scan QR or pair your phone in Settings.' });
    }

    if (imageBase64 || pdfBase64 || documentBase64) {
      console.log(`[WhatsApp sendBill] Sending MEDIA to ${phone}...`);
      await whatsappService.sendBillMedia(phone, {
        imageBase64,
        pdfBase64,
        documentBase64,
        mimetype,
        caption: billText,
        fileName
      });
      console.log(`[WhatsApp sendBill] ✅ Media sent successfully to ${phone}`);
    } else {
      console.log(`[WhatsApp sendBill] Sending TEXT to ${phone}...`);
      await whatsappService.sendMessage(phone, billText);
      console.log(`[WhatsApp sendBill] ✅ Text sent successfully to ${phone}`);
    }

    res.json({ success: true, message: 'e-Bill sent successfully via WhatsApp!' });
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
