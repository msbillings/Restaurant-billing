import api from './axios';

export const getWhatsAppStatus = async () => {
  const response = await api.get('/whatsapp/status');
  return response.data;
};

export const logoutWhatsApp = async () => {
  const response = await api.post('/whatsapp/logout');
  return response.data;
};

export const sendWhatsAppMessage = async (phone, message) => {
  const response = await api.post('/whatsapp/send-message', { phone, message });
  return response.data;
};

export const sendWhatsAppBill = async (phone, billText, imageBase64 = null, pdfBase64 = null, fileName = null, documentBase64 = null, mimetype = null) => {
  const response = await api.post('/whatsapp/send-bill', { phone, billText, imageBase64, pdfBase64, fileName, documentBase64, mimetype });
  return response.data;
};

export const requestWhatsAppPairingCode = async (phone) => {
  const response = await api.post('/whatsapp/pairing-code', { phone });
  return response.data;
};

export const refreshWhatsAppQR = async () => {
  const response = await api.post('/whatsapp/refresh');
  return response.data;
};

