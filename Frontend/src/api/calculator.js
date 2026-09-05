import api from './axios';
import { db } from '../db/offlineDb';

// Get calculation history from API with fallback to IndexedDB
export const getCalculationHistory = async () => {
  try {
    const res = await api.get('/calculator/history');
    if (Array.isArray(res.data)) {
      // Sync to local offline db
      db.calculatorHistory.clear().then(() => {
        db.calculatorHistory.bulkPut(res.data).catch(() => {});
      }).catch(() => {});
      return res.data;
    }
    return [];
  } catch (error) {
    console.warn('API error fetching calculator history, checking offline db:', error.message);
    try {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const offlineEntries = await db.calculatorHistory
        .where('createdAt')
        .above(twoDaysAgo.toISOString())
        .reverse()
        .toArray();
      return offlineEntries || [];
    } catch (e) {
      return [];
    }
  }
};

// Save a calculation entry to API and local IndexedDB
export const saveCalculationEntry = async (expression, result, details = '') => {
  const payload = { expression, result, details, createdAt: new Date().toISOString() };
  try {
    const res = await api.post('/calculator/history', payload);
    const saved = res.data || payload;
    db.calculatorHistory.put(saved).catch(() => {});
    return saved;
  } catch (error) {
    console.warn('API error saving calculation, storing offline:', error.message);
    try {
      const localObj = { ...payload, id: `offline_${Date.now()}` };
      await db.calculatorHistory.put(localObj);
      return localObj;
    } catch (e) {
      return payload;
    }
  }
};

// Clear calculation history
export const clearCalculationHistory = async () => {
  try {
    await api.delete('/calculator/history');
  } catch (error) {
    console.warn('API error clearing calculation history:', error.message);
  } finally {
    try {
      await db.calculatorHistory.clear();
    } catch (e) {}
  }
};

// Delete single calculation entry
export const deleteSingleCalculationEntry = async (id) => {
  try {
    if (id && !String(id).startsWith('offline_')) {
      await api.delete(`/calculator/history/${id}`);
    }
  } catch (error) {
    console.warn('API error deleting calculation entry:', error.message);
  } finally {
    try {
      if (id) {
        await db.calculatorHistory.delete(id);
      }
    } catch (e) {}
  }
};

