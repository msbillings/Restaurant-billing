import whatsappManager from '../services/whatsappService.js';
import { getTenantModels } from '../utils/tenantManager.js';

export const resolveTenantInfo = async (req) => {
  const tenantId = req.user?.db || req.tenantDb || req.headers?.['x-tenant-db'] || req.query?.tenant || req.body?.tenant || req.models?.connection?.name || 'default';
  
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

    // If live in-memory service is CONNECTED, return immediately
    if (status.status === 'CONNECTED' && status.connectedNumber) {
      return res.json(status);
    }

    // Check if tenant database has a verified connected session for cross-device sync (.apk, Vercel, .exe)
    try {
      const models = req.models || (await getTenantModels(tenantId));
      if (models?.Setting) {
        const dbStatusDoc = await models.Setting.findOne({ key: 'whatsapp_status' }).lean();
        if (dbStatusDoc?.value?.status === 'CONNECTED' && dbStatusDoc?.value?.connectedNumber) {
          const dbVal = dbStatusDoc.value;
          // Return synchronized connected info if not actively scanning QR or initializing locally
          if (status.status !== 'SCAN_QR' && status.status !== 'CONNECTING') {
            const dispName = dbVal.restaurantName || restaurantName || 'MS Billings POS';
            const devName = dbVal.deviceName || `${dispName} Gateway`;
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

    const { whatsappService } = await resolveTenantInfo(req);
    await whatsappService.sendMessage(phone, message);
    res.json({ success: true, message: 'WhatsApp message sent successfully!' });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ error: error.message });
  }
};

export const sendBill = async (req, res) => {
  try {
    const { phone, billText, imageBase64, pdfBase64, documentBase64, mimetype, fileName } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Destination phone number is required.' });
    }

    const { whatsappService } = await resolveTenantInfo(req);
    if (imageBase64 || pdfBase64 || documentBase64) {
      await whatsappService.sendBillMedia(phone, {
        imageBase64,
        pdfBase64,
        documentBase64,
        mimetype,
        caption: billText,
        fileName
      });
    } else {
      await whatsappService.sendMessage(phone, billText);
    }

    res.json({ success: true, message: 'e-Bill sent successfully via WhatsApp!' });
  } catch (error) {
    console.error('Error sending WhatsApp bill:', error);
    res.status(500).json({ error: error.message });
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
