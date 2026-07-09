/**
 * offlineDb.js - Local IndexedDB Database for Offline POS Operations
 * 
 * Uses Dexie.js (IndexedDB wrapper) to store:
 * - Menu items & categories (cached from cloud for instant loading)
 * - Offline order queue (orders created while internet is down)
 * - Sync logs (audit trail of what was synced and when)
 * - Floor/table layout cache
 */
import Dexie from 'dexie';

const db = new Dexie('msbillings_offline');

// Define the schema
db.version(1).stores({
  // Menu items cached from server
  menuItems: '_id, name, category, price, isAvailable',
  
  // Categories cached from server
  categories: '_id, name, displayOrder, isActive',
  
  // Orders created while offline - queued for sync
  offlineOrders: '++localId, tableNo, status, billType, createdAt, synced',
  
  // Sync queue - any API call that failed due to offline
  syncQueue: '++id, endpoint, method, payload, createdAt, retries, status',
  
  // Floor/Table layout cache
  floors: '_id, name',
  
  // Metadata (last sync timestamps, etc.)
  meta: 'key'
});

// ==================== MENU CACHE ====================

/**
 * Cache menu items from the server into IndexedDB.
 * Called whenever the POS fetches menu successfully from cloud.
 */
export const cacheMenuItems = async (items) => {
  try {
    await db.menuItems.clear();
    if (items && items.length > 0) {
      await db.menuItems.bulkPut(items);
    }
    await db.meta.put({ key: 'lastMenuSync', value: Date.now() });
  } catch (err) {
    console.error('[OfflineDB] Failed to cache menu items:', err);
  }
};

/**
 * Get cached menu items from IndexedDB.
 * Returns null if no cached data exists.
 */
export const getCachedMenuItems = async () => {
  try {
    const items = await db.menuItems.toArray();
    return items.length > 0 ? items : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached menu:', err);
    return null;
  }
};

// ==================== CATEGORY CACHE ====================

export const cacheCategories = async (categories) => {
  try {
    await db.categories.clear();
    if (categories && categories.length > 0) {
      await db.categories.bulkPut(categories);
    }
    await db.meta.put({ key: 'lastCategorySync', value: Date.now() });
  } catch (err) {
    console.error('[OfflineDB] Failed to cache categories:', err);
  }
};

export const getCachedCategories = async () => {
  try {
    const cats = await db.categories.toArray();
    return cats.length > 0 ? cats : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached categories:', err);
    return null;
  }
};

// ==================== FLOOR CACHE ====================

export const cacheFloors = async (floors) => {
  try {
    await db.floors.clear();
    if (floors && floors.length > 0) {
      await db.floors.bulkPut(floors);
    }
    await db.meta.put({ key: 'lastFloorSync', value: Date.now() });
  } catch (err) {
    console.error('[OfflineDB] Failed to cache floors:', err);
  }
};

export const getCachedFloors = async () => {
  try {
    const floors = await db.floors.toArray();
    return floors.length > 0 ? floors : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached floors:', err);
    return null;
  }
};

// ==================== SYNC QUEUE ====================

/**
 * Add a failed API call to the sync queue.
 * When internet returns, the SyncEngine will replay these.
 */
export const addToSyncQueue = async (endpoint, method, payload) => {
  try {
    const id = await db.syncQueue.add({
      endpoint,
      method,
      payload,
      createdAt: new Date().toISOString(),
      retries: 0,
      status: 'pending'
    });
    console.log(`[OfflineDB] Queued for sync: ${method} ${endpoint} (id: ${id})`);
    return id;
  } catch (err) {
    console.error('[OfflineDB] Failed to queue for sync:', err);
    return null;
  }
};

/**
 * Get all pending items in the sync queue.
 */
export const getPendingSyncItems = async () => {
  try {
    return await db.syncQueue
      .where('status')
      .equals('pending')
      .sortBy('createdAt');
  } catch (err) {
    console.error('[OfflineDB] Failed to get pending sync items:', err);
    return [];
  }
};

/**
 * Mark a sync queue item as completed.
 */
export const markSyncComplete = async (id) => {
  try {
    await db.syncQueue.update(id, { status: 'completed' });
  } catch (err) {
    console.error('[OfflineDB] Failed to mark sync complete:', err);
  }
};

/**
 * Mark a sync queue item as failed and increment retries.
 */
export const markSyncFailed = async (id) => {
  try {
    const item = await db.syncQueue.get(id);
    if (item) {
      await db.syncQueue.update(id, { 
        retries: (item.retries || 0) + 1,
        status: item.retries >= 4 ? 'failed_permanent' : 'pending'
      });
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to mark sync failed:', err);
  }
};

/**
 * Clear completed/old sync items (housekeeping).
 */
export const cleanupSyncQueue = async () => {
  try {
    await db.syncQueue.where('status').anyOf('completed', 'failed_permanent').delete();
  } catch (err) {
    console.error('[OfflineDB] Cleanup failed:', err);
  }
};

/**
 * Get the count of pending sync items.
 */
export const getPendingSyncCount = async () => {
  try {
    return await db.syncQueue.where('status').equals('pending').count();
  } catch (err) {
    return 0;
  }
};

// ==================== META ====================

export const getMeta = async (key) => {
  try {
    const record = await db.meta.get(key);
    return record ? record.value : null;
  } catch (err) {
    return null;
  }
};

export const setMeta = async (key, value) => {
  try {
    await db.meta.put({ key, value });
  } catch (err) {
    console.error('[OfflineDB] Failed to set meta:', err);
  }
};

export default db;
