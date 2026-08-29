import whatsappService from '../services/whatsappService.js';

export const getStatus = async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error fetching WhatsApp status:', error);
    res.status(500).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  try {
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
