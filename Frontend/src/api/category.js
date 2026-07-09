import api from './axios';
import { getCachedCategories, cacheCategories, addToSyncQueue } from '../db/offlineDb';
import { isOnline } from '../utils/syncEngine';

// Simple cache
let categoryCache = null;
let categoryCacheTimestamp = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for categories

export const getCategories = async (forceRefresh = false) => {
  const now = Date.now();

  if (!forceRefresh && categoryCache && (now - categoryCacheTimestamp) < CACHE_DURATION) {
    return categoryCache;
  }

  try {
    const response = await api.get('/categories');
    categoryCache = response.data;
    categoryCacheTimestamp = now;
    
    // Cache to IndexedDB for offline use
    cacheCategories(response.data).catch(() => {});
    
    return response.data;
  } catch (err) {
    // If offline, fall back to IndexedDB
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      console.log('[Category API] Offline - serving from IndexedDB cache');
      const cached = await getCachedCategories();
      if (cached) {
        categoryCache = cached;
        return cached;
      }
    }
    if (categoryCache) {
      console.log('[Category API] Using stale in-memory cache');
      return categoryCache;
    }
    throw err;
  }
};

export const getAllCategories = async () => {
  try {
    const response = await api.get('/categories/admin');
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      const cached = await getCachedCategories();
      if (cached) return cached;
    }
    throw err;
  }
};

export const createCategory = async (categoryData) => {
  try {
    const response = await api.post('/categories', categoryData);
    categoryCache = null; // Clear cache
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      await addToSyncQueue('/categories', 'post', categoryData);
      categoryCache = null;
      return { ...categoryData, _id: 'offline_' + Date.now(), _offline: true };
    }
    throw err;
  }
};

export const updateCategory = async (id, categoryData) => {
  try {
    const response = await api.put(`/categories/${id}`, categoryData);
    categoryCache = null; // Clear cache
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      await addToSyncQueue(`/categories/${id}`, 'put', categoryData);
      categoryCache = null;
      return { ...categoryData, _id: id, _offline: true };
    }
    throw err;
  }
};

export const deleteCategory = async (id) => {
  try {
    const response = await api.delete(`/categories/${id}`);
    categoryCache = null; // Clear cache
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      await addToSyncQueue(`/categories/${id}`, 'delete', null);
      categoryCache = null;
      return { message: 'Queued for deletion', _offline: true };
    }
    throw err;
  }
};