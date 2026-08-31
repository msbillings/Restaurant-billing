import whatsappManager from '../services/whatsappService.js';

const getWhatsAppService = (req) => {
  const tenantId = req.user?.db || 'default';
  return whatsappManager.getInstance(tenantId);
};

export const getStatus = async (req, res) => {
  try {
    const whatsappService = getWhatsAppService(req);
    const status = whatsappService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching WhatsApp status:', error);
    res.status(500).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const whatsappService = getWhatsAppService(req);
    const result = await whatsappService.logout();
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

    const whatsappService = getWhatsAppService(req);
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

    const whatsappService = getWhatsAppService(req);
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
    const whatsappService = getWhatsAppService(req);
    const result = await whatsappService.requestPairingCode(phone);
    res.json(result);
  } catch (error) {
    console.error('Error generating WhatsApp pairing code:', error);
    res.status(500).json({ error: error.message });
  }
};

export const refreshQR = async (req, res) => {
  try {
    const whatsappService = getWhatsAppService(req);
    const result = await whatsappService.refreshQR();
    res.json(result);
  } catch (error) {
    console.error('Error refreshing WhatsApp QR:', error);
    res.status(500).json({ error: error.message });
  }
};

