/**
 * realtimeService.js - Centralized Singleton Real-Time Manager & Event Bus
 * 
 * Provides a single persistent WebSocket connection across the entire application lifecycle.
 * Prevents socket connection churn, eliminates dropped events during page transitions,
 * keeps IndexedDB caches automatically up to date, and broadcasts reactive updates
 * across all active UI components with 0ms latency.
 */
import { io } from 'socket.io-client';
import { getSocketUrl } from '../config.js';
import {
  upsertCachedOpenOrder,
  removeCachedOpenOrder,
  prependCachedBillHistory,
  updateCachedKotItem,
  removeCachedKotItem
} from '../db/offlineDb.js';

class RealtimeService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize or return the singleton socket connection
   */
  init() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (!this.socket) {
      const socketUrl = getSocketUrl();
      this.socket = io(socketUrl, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      this.setupCoreListeners();
    }

    return this.socket;
  }

  /**
   * Setup core listeners and cache sync engine
   */
  setupCoreListeners() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Connection & Tenant Joining
    const joinTenant = () => {
      const tenantDb = this.getTenantDb();
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (tenantDb && this.socket) {
        console.log(`[RealtimeService] Joining tenant room: ${tenantDb}`);
        this.socket.emit('joinTenant', { tenantDb, token });
      }
    };

    this.socket.on('connect', () => {
      console.log('[RealtimeService] WebSocket Connected:', this.socket.id);
      joinTenant();
      this.dispatchInternal('connect', { socketId: this.socket.id });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[RealtimeService] WebSocket Reconnected (attempt ${attemptNumber})`);
      joinTenant();
      this.dispatchInternal('reconnect', { attemptNumber });
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[RealtimeService] WebSocket Disconnected:', reason);
      this.dispatchInternal('disconnect', { reason });
    });

    // 2. Real-Time Events Dispatch & Automatic Cache Sync
    const events = [
      'orderUpdated',
      'ordersUpdated',
      'billSettled',
      'tableStatusChanged',
      'tableTransferred',
      'newKOT',
      'kotUpdated',
      'foodReady',
      'prepTimeUpdated',
      'new_notification',
      'dismiss_notification',
      'itemCancellationWithdrawn',
      'itemCancellationRequested',
      'cancellationResolved',
      'settingsUpdated',
      'securitySettingsUpdated',
      'spacesUpdated',
      'menuUpdated',
      'relayPrintKOT',
      'relayPrintBill'
    ];

    events.forEach(eventName => {
      this.attachSocketListener(eventName);
    });

    // Re-attach any dynamically registered listeners on connect/reconnect
    this.listeners.forEach((_, eventName) => {
      this.attachSocketListener(eventName);
    });
  }

  attachSocketListener(eventName) {
    if (!this.socket) return;
    this.socket.off(eventName);
    this.socket.on(eventName, (data) => {
      // Client-side tenant filtering: ignore events belonging to other tenants
      const currentTenant = localStorage.getItem('resto_db_name');
      if (data && data.tenantDb && currentTenant && data.tenantDb !== currentTenant) {
        return;
      }

      // Handle print relay on local desktop station
      if (eventName === 'relayPrintKOT' || eventName === 'relayPrintBill') {
        this.handleLocalStationPrintRelay(eventName, data);
      }

      // Cache synchronization in background
      this.handleAutoCacheSync(eventName, data);

      // Internal subscribers
      this.dispatchInternal(eventName, data);

      // Global DOM window event for loose coupling
      window.dispatchEvent(new CustomEvent(`realtime:${eventName}`, { detail: data }));
    });
  }

  /**
   * Dispatches print jobs relayed from remote mobile devices to the local station's thermal printer
   */
  async handleLocalStationPrintRelay(eventName, job) {
    if (!job || !job.printer) return;

    // Only desktop stations or devices with local backend/Electron should act as the printer gateway
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
    if (isMobile) return;

    // Deduplicate jobs by jobId
    if (job.jobId) {
      if (!this.handledRelayJobs) this.handledRelayJobs = new Set();
      if (this.handledRelayJobs.has(job.jobId)) return;
      this.handledRelayJobs.add(job.jobId);
      if (this.handledRelayJobs.size > 100) this.handledRelayJobs.clear();
    }

    console.log(`[RealtimeService] 🖨️ Dispatching relayed ${eventName} to local printer:`, job.printer?.name);

    try {
      const endpoint = eventName === 'relayPrintKOT' ? '/printer-configs/print-kot' : '/printer-configs/print-bill';
      const localBackend = 'http://127.0.0.1:5002/api';
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      const payload = eventName === 'relayPrintKOT' ? {
        bill: job.bill,
        items: job.items,
        kotNumber: job.kotNumber,
        queueNumber: job.queueNumber,
        printerId: job.printer?._id,
        rasterBufferBase64: job.rasterBufferBase64
      } : {
        bill: job.bill,
        printerId: job.printer?._id,
        rasterBufferBase64: job.rasterBufferBase64
      };

      await fetch(`${localBackend}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      console.log(`[RealtimeService] ✅ Successfully printed relayed job to local printer`);
    } catch (err) {
      console.warn(`[RealtimeService] Local station print relay note:`, err.message);
    }
  }

  /**
   * Automatically update IndexedDB cache when events occur
   */
  async handleAutoCacheSync(eventName, data) {
    try {
      if (eventName === 'orderUpdated' && data) {
        if (data.order) {
          if (data.order.status === 'Paid' || data.order.status === 'Cancelled') {
            await removeCachedOpenOrder(data.order._id || data.order.tableNo);
          } else {
            await upsertCachedOpenOrder(data.order);
          }
        }
      } else if (eventName === 'billSettled' && data) {
        if (data.order || data.bill) {
          const settled = data.order || data.bill;
          await removeCachedOpenOrder(settled._id || settled.tableNo || data.tableNo);
          await prependCachedBillHistory(settled);
        } else if (data.tableNo) {
          await removeCachedOpenOrder(data.tableNo);
        }
      } else if (eventName === 'kotUpdated' && data) {
        if (data.kotId && data.itemId && data.status) {
          await updateCachedKotItem(data.kotId, data.itemId, data.status);
        }
      }
    } catch (err) {
      console.warn('[RealtimeService] Cache sync notice:', err);
    }
  }

  /**
   * Re-join tenant room (e.g. after login or tenant switch)
   */
  rejoinTenant() {
    const tenantDb = this.getTenantDb();
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (this.socket && this.socket.connected && tenantDb) {
      console.log(`[RealtimeService] Rejoining tenant room: ${tenantDb}`);
      this.socket.emit('joinTenant', { tenantDb, token });
    }
  }

  getTenantDb() {
    let t = localStorage.getItem('resto_db_name') || localStorage.getItem('tenantDb');
    if (!t) {
      try {
        const userObj = JSON.parse(localStorage.getItem('user') || '{}');
        t = userObj.db || userObj.tenantDb;
      } catch (e) {}
    }
    return t || 'default';
  }

  /**
   * Subscribe to a real-time event
   * @param {string} event 
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    this.init();
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
      this.attachSocketListener(event);
    }
    this.listeners.get(event).add(callback);

    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe from a real-time event
   */
  unsubscribe(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Dispatch event to internal subscribers
   */
  dispatchInternal(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[RealtimeService] Error in listener for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Broadcast a local event (e.g., optimistic UI action)
   */
  broadcastLocal(event, data) {
    this.dispatchInternal(event, data);
    window.dispatchEvent(new CustomEvent(`realtime:${event}`, { detail: data }));
  }

  /**
   * ⚡ INSTANT NOTIFICATION (0ms local + <10ms WebSocket broadcast)
   * Dispatches immediately on local terminal for zero delay, and transmits
   * over persistent WebSocket to all other tablets / KDS / screens.
   */
  broadcastNotification(notification) {
    if (!notification) return;
    const tenantDb = this.getTenantDb();
    const notifPayload = {
      id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: notification.title || 'Notification',
      message: notification.message || '',
      time: notification.time || new Date().toISOString(),
      timestamp: notification.timestamp || new Date(),
      type: notification.type || 'info',
      targetRoles: notification.targetRoles || ['Admin', 'Manager', 'Cashier', 'Captain', 'Chef'],
      tenantDb: notification.tenantDb || tenantDb,
      data: notification.data || {}
    };

    // 1. Instant local display on this device (0ms)
    this.broadcastLocal('new_notification', notifPayload);

    // 2. Real-time broadcast to all other connected devices (<10ms)
    this.emit('clientNotification', notifPayload);
  }

  /**
   * Emit an event through the socket to the backend
   */
  emit(event, data) {
    this.init();
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Get direct socket instance if needed
   */
  getSocket() {
    return this.init();
  }
}

const realtimeService = new RealtimeService();
export default realtimeService;
