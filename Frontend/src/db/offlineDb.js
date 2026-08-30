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

const tenantDbs = new Map();

/**
 * Get or create a Dexie database isolated specifically to the currently logged-in tenant.
 * Prevents cross-tenant data leakage in browser IndexedDB.
 */
export const getDb = () => {
  const tenantDbName = localStorage.getItem('resto_db_name') || 'default';
  const cleanName = `msbillings_offline_${tenantDbName.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  if (tenantDbs.has(cleanName)) {
    return tenantDbs.get(cleanName);
  }

  const newDb = new Dexie(cleanName);
  newDb.version(1).stores({
    menuItems: '_id, name, category, price, isAvailable',
    categories: '_id, name, displayOrder, isActive',
    openOrders: '_id, tableNo, status, billType, createdAt',
    billHistory: '_id, billNumber, tableNo, status, total, createdAt',
    kotHistory: '_id, kotNo, tableNo, status, createdAt',
    inventory: '_id, name, category, stockQuantity',
    editedBills: '_id, billNumber, tableNo, status, total, updatedAt',
    offlineOrders: '++localId, tableNo, status, billType, createdAt, synced',
    syncQueue: '++id, endpoint, method, payload, createdAt, retries, status',
    floors: '_id, name',
    kdsActiveKots: '_id, kotId, tableNo, status, createdAt',
    meta: 'key'
  });

  tenantDbs.set(cleanName, newDb);
  return newDb;
};

/**
 * Clear all offline IndexedDB data across all stores for current tenant on logout/login.
 */
export const clearAllOfflineData = async () => {
  try {
    const activeDb = getDb();
    await Promise.all([
      activeDb.menuItems?.clear().catch(() => {}),
      activeDb.categories?.clear().catch(() => {}),
      activeDb.openOrders?.clear().catch(() => {}),
      activeDb.billHistory?.clear().catch(() => {}),
      activeDb.kotHistory?.clear().catch(() => {}),
      activeDb.inventory?.clear().catch(() => {}),
      activeDb.editedBills?.clear().catch(() => {}),
      activeDb.floors?.clear().catch(() => {}),
      activeDb.kdsActiveKots?.clear().catch(() => {}),
      activeDb.meta?.clear().catch(() => {})
    ]);
  } catch (err) {
    console.warn('[OfflineDB] Error clearing offline data:', err);
  }
};

// Dynamic proxy ensuring every database operation is routed to the active tenant's isolated IndexedDB
const db = new Proxy({}, {
  get: (_, prop) => {
    const active = getDb();
    const val = active[prop];
    return typeof val === 'function' ? val.bind(active) : val;
  }
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

// ==================== OPEN ORDERS CACHE ====================

export const cacheOpenOrders = async (orders) => {
  try {
    await db.openOrders.clear();
    if (orders && orders.length > 0) {
      await db.openOrders.bulkPut(orders);
    }
    await db.meta.put({ key: 'lastOpenOrdersSync', value: Date.now() });
  } catch (err) {
    console.error('[OfflineDB] Failed to cache open orders:', err);
  }
};

export const getCachedOpenOrders = async () => {
  try {
    const orders = await db.openOrders.toArray();
    return orders.length > 0 ? orders : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached open orders:', err);
    return null;
  }
};

export const upsertCachedOpenOrder = async (order) => {
  if (!order) return;
  try {
    if (order._id) {
      await db.openOrders.put(order);
    } else if (order.tableNo) {
      const existing = await db.openOrders.where('tableNo').equals(order.tableNo).first();
      if (existing) {
        await db.openOrders.put({ ...existing, ...order });
      } else {
        await db.openOrders.put({ _id: `local_${Date.now()}`, ...order });
      }
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to upsert open order:', err);
  }
};

export const removeCachedOpenOrder = async (orderIdOrTableNo) => {
  if (!orderIdOrTableNo) return;
  try {
    await db.openOrders.delete(orderIdOrTableNo);
    // Also remove if tableNo matches
    await db.openOrders.where('tableNo').equals(orderIdOrTableNo).delete();
  } catch (err) {
    console.error('[OfflineDB] Failed to remove cached open order:', err);
  }
};

// ==================== BILL HISTORY CACHE ====================

export const cacheBillHistory = async (bills) => {
  try {
    await db.billHistory.clear();
    if (bills && bills.length > 0) {
      await db.billHistory.bulkPut(bills);
    }
    await db.meta.put({ key: 'lastBillHistorySync', value: Date.now() });
  } catch (err) {
    console.error('[OfflineDB] Failed to cache bill history:', err);
  }
};

export const getCachedBillHistory = async () => {
  try {
    const bills = await db.billHistory.toArray();
    return bills.length > 0 ? bills : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached bill history:', err);
    return null;
  }
};

export const prependCachedBillHistory = async (bill) => {
  if (!bill || !bill._id) return;
  try {
    await db.billHistory.put(bill);
  } catch (err) {
    console.error('[OfflineDB] Failed to prepend bill history:', err);
  }
};

// ==================== DELIVERY BILLS CACHE ====================

export const cacheDeliveryBills = async (bills) => {
  try {
    if (bills && Array.isArray(bills)) {
      await setMeta('cached_delivery_bills', bills);
      await setMeta('lastDeliverySync', Date.now());
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to cache delivery bills:', err);
  }
};

export const getCachedDeliveryBills = async () => {
  try {
    const cached = await getMeta('cached_delivery_bills');
    return Array.isArray(cached) ? cached : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached delivery bills:', err);
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

// ==================== KOT HISTORY CACHE ====================

export const cacheKotHistory = async (kots, date = null) => {
  try {
    await db.kotHistory.clear();
    if (kots && kots.length > 0) {
      await db.kotHistory.bulkPut(kots);
    }
    if (date) {
      await db.meta.put({ key: 'lastKotHistoryDate', value: date });
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to cache KOT history:', err);
  }
};

export const getCachedKotHistory = async (date = null) => {
  try {
    if (date) {
      const cachedDate = await getMeta('lastKotHistoryDate');
      if (cachedDate && cachedDate !== date) {
        return null; // Do not return stale cache if querying a different date
      }
    }
    const kots = await db.kotHistory.toArray();
    return kots.length > 0 ? kots : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached KOT history:', err);
    return null;
  }
};

// ==================== KDS ACTIVE TICKETS CACHE ====================

export const cacheKdsActiveKots = async (kots) => {
  try {
    if (db.kdsActiveKots) {
      await db.kdsActiveKots.clear();
      if (kots && kots.length > 0) {
        await db.kdsActiveKots.bulkPut(kots);
      }
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to cache KDS active KOTs:', err);
  }
};

export const getCachedKdsActiveKots = async () => {
  try {
    if (db.kdsActiveKots) {
      const kots = await db.kdsActiveKots.toArray();
      return kots.length > 0 ? kots : null;
    }
    return null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached KDS active KOTs:', err);
    return null;
  }
};

export const updateCachedKotItem = async (kotId, itemId, status) => {
  try {
    if (db.kdsActiveKots) {
      const allActive = await db.kdsActiveKots.toArray();
      let changedActive = false;
      for (const kot of allActive) {
        if (kot.kotId?.toString() === kotId?.toString() || kot._id?.toString() === kotId?.toString()) {
          if (kot.items && Array.isArray(kot.items)) {
            kot.items.forEach(item => {
              if (item._id?.toString() === itemId?.toString() || item.name === itemId) {
                item.status = status;
                changedActive = true;
              }
            });
          }
        }
      }
      if (changedActive) {
        await db.kdsActiveKots.clear();
        await db.kdsActiveKots.bulkPut(allActive);
      }
    }

    const allKots = await db.kotHistory.toArray();
    let changed = false;
    for (const kot of allKots) {
      if (kot.kotId?.toString() === kotId?.toString() || kot._id?.toString() === kotId?.toString()) {
        if (kot.items && Array.isArray(kot.items)) {
          kot.items.forEach(item => {
            if (item._id?.toString() === itemId?.toString() || item.name === itemId) {
              item.status = status;
              changed = true;
            }
          });
        }
      }
    }
    if (changed) {
      await db.kotHistory.clear();
      await db.kotHistory.bulkPut(allKots);
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to update cached KOT item:', err);
  }
};

export const removeCachedKotItem = async (kotId, itemId) => {
  try {
    if (db.kdsActiveKots) {
      const allActive = await db.kdsActiveKots.toArray();
      let changedActive = false;
      for (const kot of allActive) {
        if (kot.kotId?.toString() === kotId?.toString() || kot._id?.toString() === kotId?.toString()) {
          if (kot.items && Array.isArray(kot.items)) {
            const originalLength = kot.items.length;
            kot.items = kot.items.filter(item => item._id?.toString() !== itemId?.toString() && item.name !== itemId);
            if (kot.items.length !== originalLength) {
              changedActive = true;
            }
          }
        }
      }
      if (changedActive) {
        await db.kdsActiveKots.clear();
        await db.kdsActiveKots.bulkPut(allActive);
      }
    }

    const allKots = await db.kotHistory.toArray();
    let changed = false;
    for (const kot of allKots) {
      if (kot.kotId?.toString() === kotId?.toString() || kot._id?.toString() === kotId?.toString()) {
        if (kot.items && Array.isArray(kot.items)) {
          const originalLength = kot.items.length;
          kot.items = kot.items.filter(item => item._id?.toString() !== itemId?.toString() && item.name !== itemId);
          if (kot.items.length !== originalLength) {
            changed = true;
          }
        }
      }
    }
    if (changed) {
      await db.kotHistory.clear();
      await db.kotHistory.bulkPut(allKots);
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to remove cached KOT item:', err);
  }
};

// ==================== INVENTORY CACHE ====================


export const cacheInventory = async (items) => {
  try {
    await db.inventory.clear();
    if (items && items.length > 0) {
      await db.inventory.bulkPut(items);
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to cache inventory:', err);
  }
};

export const getCachedInventory = async () => {
  try {
    const items = await db.inventory.toArray();
    return items.length > 0 ? items : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached inventory:', err);
    return null;
  }
};

// ==================== EDITED BILLS CACHE ====================

export const cacheEditedBills = async (bills) => {
  try {
    await db.editedBills.clear();
    if (bills && bills.length > 0) {
      await db.editedBills.bulkPut(bills);
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to cache edited bills:', err);
  }
};

export const getCachedEditedBills = async () => {
  try {
    const bills = await db.editedBills.toArray();
    return bills.length > 0 ? bills : null;
  } catch (err) {
    console.error('[OfflineDB] Failed to read cached edited bills:', err);
    return null;
  }
};

export default db;
