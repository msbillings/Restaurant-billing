/**
 * Offline-to-Cloud POS Sync Utility
 * 
 * Provides offline transaction queuing for local Desktop POS terminals experiencing internet outages.
 * When connectivity is restored, queued transactions are automatically synchronized to the cloud database.
 */

const QUEUE_KEY = 'msbilling_offline_queue';

export const queueOfflineRequest = (url, method = 'POST', data = {}) => {
  try {
    const queue = getQueue();
    const requestItem = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 7),
      url,
      method,
      data,
      timestamp: new Date().toISOString(),
      tenantDb: localStorage.getItem('resto_db_name'),
      token: localStorage.getItem('resto_token')
    };
    queue.push(requestItem);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log('[OfflineSync] Queued transaction offline:', requestItem.id);
    return true;
  } catch (err) {
    console.error('[OfflineSync] Failed to queue offline request:', err);
    return false;
  }
};

export const getQueue = () => {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    return [];
  }
};

export const clearQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
};

export const syncOfflineQueue = async () => {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  console.log(`[OfflineSync] Attempting to sync ${queue.length} offline transactions...`);
  let syncedCount = 0;
  const remainingQueue = [];

  for (const item of queue) {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (item.token) headers['Authorization'] = `Bearer ${item.token}`;
      if (item.tenantDb) headers['X-Tenant-DB'] = item.tenantDb;

      const response = await fetch(item.url, {
        method: item.method,
        headers,
        body: JSON.stringify(item.data)
      });

      if (response.ok) {
        syncedCount++;
        console.log(`[OfflineSync] Successfully synced transaction: ${item.id}`);
      } else if (response.status === 400 || response.status === 404 || response.status === 409) {
        // Unrecoverable error (bad request / conflict), drop from queue to prevent infinite loop
        console.warn(`[OfflineSync] Dropping unrecoverable transaction: ${item.id} (Status: ${response.status})`);
      } else {
        // Server or network error, keep in queue
        remainingQueue.push(item);
      }
    } catch (err) {
      console.error(`[OfflineSync] Network error syncing item ${item.id}:`, err);
      remainingQueue.push(item);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
  return { synced: syncedCount, failed: remainingQueue.length };
};

// Start background synchronization monitor
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Network connection restored. Initiating auto-sync...');
    syncOfflineQueue();
  });

  // Periodically check and sync every 30 seconds if online
  setInterval(() => {
    if (navigator.onLine && getQueue().length > 0) {
      syncOfflineQueue();
    }
  }, 30000);
}
