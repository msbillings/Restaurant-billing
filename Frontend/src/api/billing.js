import api from './axios';
import { addToSyncQueue, cacheOpenOrders, getCachedOpenOrders } from '../db/offlineDb';

export const getActiveOrder = async (tableNo) => {
  const encoded = encodeURIComponent(tableNo);
  const response = await api.get(`/bills/active/${encoded}`);
  return response.data;
};

// Helper: returns true ONLY if the browser is genuinely offline (no network)
// navigator.onLine is the only reliable signal — err.code and !err.response
// can fire for cancelled requests, CORS errors, or transient issues even
// when the backend is running perfectly fine.
const isTrulyOffline = () => !navigator.onLine;

export const saveOrder = async (orderData) => {
  try {
    const response = await api.post('/bills/save', orderData);
    return response.data;
  } catch (err) {
    if (isTrulyOffline()) {
      // CRITICAL: Queue the order for sync when back online
      await addToSyncQueue('/bills/save', 'post', orderData);
      console.warn('[Billing API] Truly offline! Caching order locally for sync.');
      // Dispatch a non-blocking event so the UI can show a toast
      window.dispatchEvent(new CustomEvent('offlineOrderSaved', {
        detail: { message: 'No internet connection. Order saved locally and will sync when reconnected.' }
      }));
      const offlineOrder = {
        _id: 'offline_' + Date.now(),
        ...orderData,
        status: 'Open',
        _offline: true,
        createdAt: new Date().toISOString()
      };
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
    if (isTrulyOffline()) {
      if (id.startsWith('offline_')) {
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
    if (isTrulyOffline()) {
      if (id.startsWith('offline_')) {
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
    if (isTrulyOffline()) {
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
    if (isTrulyOffline()) {
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
    if (response.data && Array.isArray(response.data)) {
      cacheOpenOrders(response.data).catch(() => {});
    }
    return response.data;
  } catch (err) {
    if (isTrulyOffline()) {
      console.log('[Billing API] Offline - retrieving cached open orders');
      const cached = await getCachedOpenOrders();
      return cached || [];
    }
    throw err;
  }
};

export const getBills = async (pageOrOptions = 1, limit = 50, search = '', billType = '', excludeBillType = '', orderSource = '') => {
  const params = new URLSearchParams();
  let requestedBillType = '';
  
  if (typeof pageOrOptions === 'object' && pageOrOptions !== null) {
    const opts = pageOrOptions;
    if (opts.page) params.append('page', opts.page);
    if (opts.limit) params.append('limit', opts.limit);
    if (opts.search) params.append('search', opts.search);
    if (opts.billType) {
      params.append('billType', opts.billType);
      requestedBillType = opts.billType;
    }
    if (opts.excludeBillType) params.append('excludeBillType', opts.excludeBillType);
    if (opts.orderSource) params.append('orderSource', opts.orderSource);
    if (opts.paymentMode) params.append('paymentMode', opts.paymentMode);
    if (opts.startDate) params.append('startDate', opts.startDate);
    if (opts.endDate) params.append('endDate', opts.endDate);
  } else {
    params.append('page', pageOrOptions);
    params.append('limit', limit);
    if (search) params.append('search', search);
    if (billType) {
      params.append('billType', billType);
      requestedBillType = billType;
    }
    if (excludeBillType) params.append('excludeBillType', excludeBillType);
    if (orderSource) params.append('orderSource', orderSource);
  }

  try {
    const response = await api.get(`/bills?${params.toString()}`);
    if (response.data && Array.isArray(response.data.bills)) {
      if (requestedBillType === 'Delivery') {
        const { cacheDeliveryBills } = await import('../db/offlineDb');
        cacheDeliveryBills(response.data.bills).catch(() => {});
      }
    }
    return response.data;
  } catch (err) {
    if (requestedBillType === 'Delivery') {
      try {
        const { getCachedDeliveryBills } = await import('../db/offlineDb');
        const cached = await getCachedDeliveryBills();
        if (cached && Array.isArray(cached) && cached.length > 0) {
          console.warn('[Billing API] Using cached delivery orders fallback.');
          return {
            bills: cached,
            pagination: {
              totalBills: cached.length,
              totalPages: 1,
              currentPage: 1
            },
            _fromCache: true
          };
        }
      } catch (cacheErr) {
        console.warn('Error reading cached delivery bills:', cacheErr);
      }
    }
    throw err;
  }
};


export const getEditedBills = async () => {
  const response = await api.get('/bills/edited');
  return response.data;
};
export const getBillById = async (id) => {
  const response = await api.get(`/bills/${id}`);
  return response.data;
};

export const deleteBill = async (id, password) => {
  const response = await api.delete(`/bills/${id}`, { data: { password } });
  return response.data;
};

export const getDailyStats = async (startDate, endDate) => {
  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  const response = await api.get('/bills/stats', { params });
  return response.data;
};

export const apiGenerateKOT = async (id, cartItems, tableNo) => {
  try {
    const response = await api.post(`/bills/kot/${id}`, { items: cartItems, tableNo });
    return response.data;
  } catch (err) {
    if (isTrulyOffline()) {
      await addToSyncQueue(`/bills/kot/${id}`, 'post', { items: cartItems, tableNo });
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

export const transferTableOrder = async (orderId, newTableNo) => {
  const response = await api.post(`/bills/transfer/${orderId}`, { newTableNo });
  return response.data;
};

export const mergeTableOrders = async (targetTableNo, sourceTableNos) => {
  const response = await api.post('/bills/merge', { targetTableNo, sourceTableNos });
  return response.data;
};
