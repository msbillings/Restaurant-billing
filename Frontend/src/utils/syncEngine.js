/**
 * syncEngine.js - Background Sync Engine for Offline-First POS
 * 
 * Responsibilities:
 * 1. Detect online/offline status
 * 2. Replay queued API calls when connection returns
 * 3. Cache menu/categories/floors on successful fetches
 * 4. Provide a global online status hook for React components
 */
import api from '../api/axios';
import {
  getPendingSyncItems,
  markSyncComplete,
  markSyncFailed,
  cleanupSyncQueue,
  getPendingSyncCount,
  cacheMenuItems,
  cacheCategories,
  cacheFloors,
  setMeta,
  getMeta
} from '../db/offlineDb';

// ==================== ONLINE STATUS ====================

let _isOnline = navigator.onLine;
let _listeners = [];
let _syncInProgress = false;
let _pendingCount = 0;

/**
 * Get current online status.
 */
export const isOnline = () => _isOnline;

/**
 * Get the number of pending sync items.
 */
export const getPendingCount = () => _pendingCount;

/**
 * Subscribe to online status changes.
 * Returns unsubscribe function.
 */
export const onStatusChange = (callback) => {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter(l => l !== callback);
  };
};

const _notifyListeners = () => {
  _listeners.forEach(cb => {
    try { cb({ isOnline: _isOnline, pendingCount: _pendingCount }); } catch (e) {}
  });
};

// ==================== SYNC LOGIC ====================

/**
 * Process the sync queue - replay all pending API calls.
 * Called automatically when the browser comes back online.
 */
const processSyncQueue = async () => {
  if (_syncInProgress || !_isOnline) return;
  _syncInProgress = true;

  try {
    const pendingItems = await getPendingSyncItems();
    console.log(`[SyncEngine] Processing ${pendingItems.length} queued items...`);

    for (const item of pendingItems) {
      try {
        // Replay the API call
        const config = {
          url: item.endpoint,
          method: item.method,
          ...(item.method !== 'get' && item.method !== 'delete' ? { data: item.payload } : {})
        };

        await api.request(config);
        await markSyncComplete(item.id);
        console.log(`[SyncEngine] ✅ Synced: ${item.method.toUpperCase()} ${item.endpoint}`);
      } catch (err) {
        // If still offline or server error, mark as failed for retry
        if (!navigator.onLine || err.code === 'ERR_NETWORK') {
          console.log(`[SyncEngine] ⏳ Still offline, stopping sync.`);
          break; // Stop processing, we're offline again
        }
        await markSyncFailed(item.id);
        console.warn(`[SyncEngine] ❌ Failed to sync: ${item.method.toUpperCase()} ${item.endpoint}`, err.message);
      }
    }

    // Cleanup old completed entries
    await cleanupSyncQueue();
    _pendingCount = await getPendingSyncCount();
    _notifyListeners();
  } catch (err) {
    console.error('[SyncEngine] Sync process error:', err);
  } finally {
    _syncInProgress = false;
  }
};

/**
 * Refresh caches from the cloud (menu, categories, floors).
 * Called on startup and when coming back online.
 */
const refreshCaches = async () => {
  if (!_isOnline) return;

  try {
    // Cache menu items
    const menuRes = await api.get('/menu');
    if (menuRes.data && Array.isArray(menuRes.data)) {
      await cacheMenuItems(menuRes.data);
      console.log(`[SyncEngine] 📦 Cached ${menuRes.data.length} menu items`);
    }
  } catch (err) {
    console.warn('[SyncEngine] Failed to cache menu:', err.message);
  }

  try {
    // Cache categories
    const catRes = await api.get('/categories');
    if (catRes.data && Array.isArray(catRes.data)) {
      await cacheCategories(catRes.data);
      console.log(`[SyncEngine] 📦 Cached ${catRes.data.length} categories`);
    }
  } catch (err) {
    console.warn('[SyncEngine] Failed to cache categories:', err.message);
  }

  try {
    // Cache floors
    const floorRes = await api.get('/floors');
    if (floorRes.data && Array.isArray(floorRes.data)) {
      await cacheFloors(floorRes.data);
      console.log(`[SyncEngine] 📦 Cached ${floorRes.data.length} floors`);
    }
  } catch (err) {
    console.warn('[SyncEngine] Failed to cache floors:', err.message);
  }

  await setMeta('lastFullSync', Date.now());
};

// ==================== EVENT LISTENERS ====================

/**
 * Initialize the sync engine.
 * Sets up online/offline event listeners and starts the initial cache.
 */
export const initSyncEngine = () => {
  // Online event
  window.addEventListener('online', async () => {
    console.log('[SyncEngine] 🟢 Connection restored!');
    _isOnline = true;
    _notifyListeners();
    
    // Process any queued items
    await processSyncQueue();
    
    // Refresh caches with latest data
    await refreshCaches();
  });

  // Offline event
  window.addEventListener('offline', () => {
    console.log('[SyncEngine] 🔴 Connection lost! Switching to offline mode.');
    _isOnline = false;
    _notifyListeners();
  });

  // Set initial state
  _isOnline = navigator.onLine;

  // Initial cache refresh (if online)
  if (_isOnline) {
    // Delay slightly to let the app fully load first
    setTimeout(() => {
      refreshCaches();
      processSyncQueue(); // Process any leftover items from last session
    }, 3000);
  }

  // Periodic sync check (every 30 seconds)
  setInterval(async () => {
    _pendingCount = await getPendingSyncCount();
    if (_isOnline && _pendingCount > 0) {
      await processSyncQueue();
    }
    _notifyListeners();
  }, 30000);

  // Update pending count initially
  getPendingSyncCount().then(count => {
    _pendingCount = count;
    _notifyListeners();
  });

  console.log(`[SyncEngine] Initialized. Online: ${_isOnline}`);
};

/**
 * Force a manual sync (e.g., user presses a "Sync Now" button).
 */
export const forceSync = async () => {
  if (!_isOnline) {
    console.warn('[SyncEngine] Cannot force sync while offline.');
    return false;
  }
  await processSyncQueue();
  await refreshCaches();
  return true;
};

export default {
  initSyncEngine,
  isOnline,
  getPendingCount,
  onStatusChange,
  forceSync
};
