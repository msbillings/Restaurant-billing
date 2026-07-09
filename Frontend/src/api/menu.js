import api from './axios';
import { getCachedMenuItems, cacheMenuItems, addToSyncQueue } from '../db/offlineDb';
import { isOnline } from '../utils/syncEngine';

// Simple cache (kept for fast in-memory access when online)
let menuCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getMenuItems = async (forceRefresh = false) => {
  const now = Date.now();

  // If we have a fresh in-memory cache, use it
  if (!forceRefresh && menuCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return menuCache;
  }

  try {
    // Try to fetch from cloud
    const response = await api.get('/menu');
    menuCache = response.data;
    cacheTimestamp = now;
    
    // Cache to IndexedDB for offline use
    cacheMenuItems(response.data).catch(() => {});
    
    return response.data;
  } catch (err) {
    // If offline or network error, fall back to IndexedDB
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      console.log('[Menu API] Offline - serving from IndexedDB cache');
      const cached = await getCachedMenuItems();
      if (cached) {
        menuCache = cached;
        return cached;
      }
    }
    // If we have stale in-memory cache, use it as last resort
    if (menuCache) {
      console.log('[Menu API] Using stale in-memory cache');
      return menuCache;
    }
    throw err;
  }
};

export const addMenuItem = async (itemData) => {
  try {
    const response = await api.post('/menu', itemData);
    menuCache = null; // Clear cache
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      // Queue for sync when back online
      await addToSyncQueue('/menu', 'post', itemData);
      menuCache = null;
      return { ...itemData, _id: 'offline_' + Date.now(), _offline: true };
    }
    throw err;
  }
};

export const updateMenuItem = async (id, itemData) => {
  try {
    const response = await api.put(`/menu/${id}`, itemData);
    menuCache = null; // Clear cache
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      await addToSyncQueue(`/menu/${id}`, 'put', itemData);
      menuCache = null;
      return { ...itemData, _id: id, _offline: true };
    }
    throw err;
  }
};

export const deleteMenuItem = async (id) => {
  try {
    const response = await api.delete(`/menu/${id}`);
    menuCache = null; // Clear cache
    return response.data;
  } catch (err) {
    if (!isOnline() || err.code === 'ERR_NETWORK' || !err.response) {
      await addToSyncQueue(`/menu/${id}`, 'delete', null);
      menuCache = null;
      return { message: 'Queued for deletion', _offline: true };
    }
    throw err;
  }
};

export const deleteAllMenuItems = async () => {
  const response = await api.delete('/menu/all');
  menuCache = null;
  return response.data;
};
