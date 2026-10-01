import api from '../../../api/axios.js';

export const triggerNetworkKOT = async (payload) => {
  return await api.post('/kot/print', payload);
};

export const triggerNetworkBill = async (payload) => {
  return await api.post('/orders/print', payload);
};
