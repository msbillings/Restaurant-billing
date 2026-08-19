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
      const tenantDb = localStorage.getItem('resto_db_name');
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
      'settingsUpdated',
      'securitySettingsUpdated',
      'spacesUpdated',
      'menuUpdated'
    ];

    events.forEach(eventName => {
      this.socket.on(eventName, (data) => {
        // Client-side tenant filtering: ignore events belonging to other tenants
        const currentTenant = localStorage.getItem('resto_db_name');
        if (data && data.tenantDb && currentTenant && data.tenantDb !== currentTenant) {
          return;
        }

        // Cache synchronization in background
        this.handleAutoCacheSync(eventName, data);

        // Internal subscribers
        this.dispatchInternal(eventName, data);

        // Global DOM window event for loose coupling
        window.dispatchEvent(new CustomEvent(`realtime:${eventName}`, { detail: data }));
      });
    });
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
    const tenantDb = localStorage.getItem('resto_db_name');
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (this.socket && this.socket.connected && tenantDb) {
      this.socket.emit('joinTenant', { tenantDb, token });
    }
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
