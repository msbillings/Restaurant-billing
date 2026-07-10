import api from './axios';
import { addToSyncQueue } from '../db/offlineDb';
import { isOnline } from '../utils/syncEngine';

export const getActiveOrder = async (tableNo) => {
  const response = await api.get(`/bills/active/${tableNo}`);
  return response.data;
};

export const saveOrder = async (orderData) => {
  try {
    const response = await api.post('/bills/save', orderData);
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      // CRITICAL: Queue the order for sync when back online
      await addToSyncQueue('/bills/save', 'post', orderData);
      
      // Return a fake order so the UI doesn't break
      const offlineOrder = {
        _id: 'offline_' + Date.now(),
        ...orderData,
        status: 'Open',
        _offline: true,
        createdAt: new Date().toISOString()
      };
      console.log('[Billing API] Order saved offline:', offlineOrder._id);
      return offlineOrder;
    }
    throw err;
  }
};

export const generateBill = async (id, billData) => {
  try {
    const response = await api.post(`/bills/generate/${id}`, billData);
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      // For offline bill generation, skip if the order itself was offline
      if (id.startsWith('offline_')) {
        console.warn('[Billing API] Cannot generate bill for offline order. Will sync when online.');
        return { _id: id, ...billData, status: 'Billed', _offline: true };
      }
      await addToSyncQueue(`/bills/generate/${id}`, 'post', billData);
      return { _id: id, ...billData, status: 'Billed', _offline: true };
    }
    throw err;
  }
};

export const settleBill = async (id, paymentData) => {
  try {
    const response = await api.post(`/bills/settle/${id}`, paymentData);
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      if (id.startsWith('offline_')) {
        console.warn('[Billing API] Cannot settle offline order. Will sync when online.');
        return { _id: id, ...paymentData, status: 'Paid', _offline: true };
      }
      await addToSyncQueue(`/bills/settle/${id}`, 'post', paymentData);
      return { _id: id, ...paymentData, status: 'Paid', _offline: true };
    }
    throw err;
  }
};

export const apiReopenOrder = async (id) => {
  const response = await api.post(`/bills/reopen/${id}`);
  return response.data;
};

export const apiCancelOrder = async (id, cancelReason) => {
  try {
    const response = await api.post(`/bills/cancel/${id}`, { cancelReason });
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      await addToSyncQueue(`/bills/cancel/${id}`, 'post', { cancelReason });
      return { _id: id, status: 'Cancelled', _offline: true };
    }
    throw err;
  }
};

export const apiRefundOrder = async (id, refundReason) => {
  try {
    const response = await api.post(`/bills/refund/${id}`, { refundReason });
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      await addToSyncQueue(`/bills/refund/${id}`, 'post', { refundReason });
      return { _id: id, status: 'Refunded', _offline: true };
    }
    throw err;
  }
};

export const apiTransferTable = async (id, newTableNo) => {
  const response = await api.post(`/bills/transfer/${id}`, { newTableNo });
  return response.data;
};

export const getOpenOrders = async () => {
  try {
    const response = await api.get('/bills/open');
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      console.log('[Billing API] Offline - returning empty orders (cached on floor)');
      return [];
    }
    throw err;
  }
};

export const getBills = async (page = 1, limit = 50, search = '') => {
  const params = new URLSearchParams();
  params.append('page', page);
  params.append('limit', limit);
  if (search) params.append('search', search);
  const response = await api.get(`/bills?${params.toString()}`);
  return response.data;
};

export const getBillById = async (id) => {
  const response = await api.get(`/bills/${id}`);
  return response.data;
};

export const deleteBill = async (id) => {
  const response = await api.delete(`/bills/${id}`);
  return response.data;
};

export const getDailyStats = async () => {
  const response = await api.get('/bills/stats');
  return response.data;
};

export const apiGenerateKOT = async (id, cartItems) => {
  try {
    const response = await api.post(`/bills/kot/${id}`, { items: cartItems });
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      await addToSyncQueue(`/bills/kot/${id}`, 'post', { items: cartItems });
      return { _offline: true, message: 'KOT queued for sync' };
    }
    throw err;
  }
};

export const apiGetTodayKOTs = async (date = '', search = '') => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (search) params.append('search', search);
  
  const response = await api.get(`/bills/kots/today?${params.toString()}`);
  return response.data;
};
