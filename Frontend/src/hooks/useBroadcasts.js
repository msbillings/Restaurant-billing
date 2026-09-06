import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import api from '../api/axios.js';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Helper to trigger native notifications across Mobile APK, Desktop .exe, and Web
const triggerNativeBroadcastNotification = async (b) => {
  if (!b || !b.title) return;
  const title = `📢 ${b.title}`;
  const body = b.message || 'New announcement from Super-Admin';

  // 1. Electron Desktop App (.exe)
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.showNotification === 'function') {
    try {
      window.electronAPI.showNotification({ title, body });
    } catch (e) { }
    return;
  }

  // 2. Android APK & iOS IPA (Capacitor Native)
  if (Capacitor.isNativePlatform()) {
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      await LocalNotifications.createChannel({
        id: 'superadmin_broadcast_channel',
        name: 'Super-Admin Announcements',
        description: 'Notifications for announcements and updates from Super-Admin',
        importance: 5,
        visibility: 1,
        vibration: true
      });

      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 1000000),
            smallIcon: 'ic_launcher',
            largeIcon: 'ic_launcher',
            iconColor: '#EA580C',
            channelId: 'superadmin_broadcast_channel',
            actionTypeId: '',
            extra: { broadcastId: b._id, type: 'broadcast' }
          }
        ]
      });
    } catch (e) {
      console.warn('[useBroadcasts] LocalNotifications error:', e);
    }
    return;
  }

  // 3. Web Browsers (Chrome, Edge, Firefox, Safari)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new window.Notification(title, {
        body,
        icon: b.imageUrl || '/logo192.png',
        tag: `broadcast_${b._id}`
      });
    } catch (e) { }
  }
};

// Module-level shared singleton cache across all component instances (App, GlobalHeader, NotificationCenter)
let sharedBroadcastsCache = null;
let sharedBroadcastsCacheTime = 0;
let inFlightBroadcastsPromise = null;
const broadcastListeners = new Set();

const useBroadcasts = (userRole) => {
  const [broadcasts, setBroadcasts] = useState(() => sharedBroadcastsCache || []);
  const [unreadCount, setUnreadCount] = useState(0);
  const isInitialLoadDoneRef = useRef(false);

  useEffect(() => {
    const handleUpdate = (data) => {
      if (Array.isArray(data)) {
        const clearedIds = JSON.parse(localStorage.getItem('cleared_broadcasts') || '[]');
        const visible = data.filter(b => !clearedIds.includes(b._id));
        setBroadcasts(visible);

        let readBroadcasts = [];
        try {
          readBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
        } catch (e) {
          readBroadcasts = [];
        }
        setUnreadCount(visible.filter(b => Array.isArray(readBroadcasts) && !readBroadcasts.includes(b._id)).length);
      }
    };

    broadcastListeners.add(handleUpdate);
    if (sharedBroadcastsCache) {
      handleUpdate(sharedBroadcastsCache);
    }

    return () => {
      broadcastListeners.delete(handleUpdate);
    };
  }, []);

  const fetchBroadcasts = async (isBackgroundSync = false) => {
    const now = Date.now();
    // Use fresh cached data if available within 60s
    if (!isBackgroundSync && sharedBroadcastsCache && (now - sharedBroadcastsCacheTime < 60000)) {
      return sharedBroadcastsCache;
    }

    // Reuse in-flight promise if a request is already running
    if (inFlightBroadcastsPromise) {
      return inFlightBroadcastsPromise;
    }

    inFlightBroadcastsPromise = (async () => {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        const tenantDb = localStorage.getItem('resto_db_name') || localStorage.getItem('tenant_db') || '';
        const SUPERADMIN_API_URL = getSuperadminApiUrl();

        let response;
        try {
          response = await api.get('/broadcasts', {
            params: { role: userRole || 'Admin', tenant: tenantDb }
          });
        } catch (err) {
          try {
            response = await axios.get(`${SUPERADMIN_API_URL}/api/clients/broadcasts/${tenantDb || 'default'}`, {
              params: { role: userRole || 'Admin' }
            });
          } catch (err2) {
            return [];
          }
        }

        const fetchedBroadcasts = Array.isArray(response?.data) ? response.data : [];
        sharedBroadcastsCache = fetchedBroadcasts;
        sharedBroadcastsCacheTime = Date.now();

        // Notify all mounted components simultaneously
        broadcastListeners.forEach(fn => fn(fetchedBroadcasts));

        const freshWindow = 2 * 60 * 60 * 1000;
        if (!isInitialLoadDoneRef.current || !token) {
          fetchedBroadcasts.forEach(b => {
            const bId = String(b._id || b.id || '');
            if (!bId) return;
            localStorage.setItem(`notified_native_broadcast_${bId}_${tenantDb}`, 'true');
          });
          if (token) isInitialLoadDoneRef.current = true;
        } else if (isBackgroundSync) {
          fetchedBroadcasts.forEach(b => {
            const bId = String(b._id || b.id || '');
            if (!bId) return;
            const notifiedKey = `notified_native_broadcast_${bId}_${tenantDb}`;
            if (!localStorage.getItem(notifiedKey)) {
              localStorage.setItem(notifiedKey, 'true');
              const createdAtTime = new Date(b.createdAt || b.date || b.timestamp || now).getTime();
              if (now - createdAtTime <= freshWindow) {
                triggerNativeBroadcastNotification(b);
              }
            }
          });
        }

        return fetchedBroadcasts;
      } catch (error) {
        console.error('Error fetching broadcasts:', error);
        return [];
      } finally {
        inFlightBroadcastsPromise = null;
      }
    })();

    return inFlightBroadcastsPromise;
  };

  const markAsRead = (broadcastId) => {
    let readBroadcasts = [];
    try {
      readBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
    } catch (e) {
      readBroadcasts = [];
    }
    if (Array.isArray(readBroadcasts) && !readBroadcasts.includes(broadcastId)) {
      readBroadcasts.push(broadcastId);
      localStorage.setItem('read_broadcasts', JSON.stringify(readBroadcasts));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = () => {
    let readBroadcasts = [];
    try {
      readBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
    } catch (e) {
      readBroadcasts = [];
    }
    if (!Array.isArray(readBroadcasts)) readBroadcasts = [];
    broadcasts.forEach(b => {
      if (!readBroadcasts.includes(b._id)) readBroadcasts.push(b._id);
    });
    localStorage.setItem('read_broadcasts', JSON.stringify(readBroadcasts));
    setUnreadCount(0);
  };

  const clearAllBroadcasts = () => {
    const clearedIds = JSON.parse(localStorage.getItem('cleared_broadcasts') || '[]');
    broadcasts.forEach(b => {
      if (!clearedIds.includes(b._id)) clearedIds.push(b._id);
    });
    localStorage.setItem('cleared_broadcasts', JSON.stringify(clearedIds));
    setBroadcasts([]);
    setUnreadCount(0);
  };

  useEffect(() => {
    // Initial fetch (reuses shared cache if another component already fetched)
    fetchBroadcasts(false);

    // Polite background sync (60s)
    const interval = setInterval(() => {
      fetchBroadcasts(true);
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [userRole]);

  return { broadcasts, unreadCount, markAsRead, markAllAsRead, clearAllBroadcasts, fetchBroadcasts };
};

export default useBroadcasts;
