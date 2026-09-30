import api from './axios';

// GET paginated Khata accounts with stats
export const getKhataAccounts = async ({ page = 1, limit = 20, search = '' }) => {
  const response = await api.get('/credit-accounts/khata', {
    params: { page, limit, search }
  });
  return response.data;
};

// GET ledger (unpaid bills + transaction history) for a customer by phone
export const getKhataLedger = async (phoneNumber) => {
  const response = await api.get(`/credit-accounts/khata/${phoneNumber}/ledger`);
  return response.data;
};

// POST settle a payment against a Khata account
export const settleKhata = async ({ phoneNumber, amount, paymentMode, splitPayments, upiApp, note, targetBillId }) => {
  const response = await api.post('/credit-accounts/khata/settle', {
    phoneNumber,
    amount,
    paymentMode,
    splitPayments,
    upiApp,
    note,
    targetBillId
  });
  return response.data;
};
