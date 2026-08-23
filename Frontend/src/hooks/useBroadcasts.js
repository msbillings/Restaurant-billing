import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useState, useEffect } from 'react';
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
    } catch (e) {}
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
    } catch (e) {}
  }
};

const useBroadcasts = (userRole) => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchBroadcasts = async () => {
    try {
      const tenantDb = localStorage.getItem('resto_db_name');
      if (!tenantDb) return; // No tenant DB yet (not logged in or license not verified)

      const SUPERADMIN_API_URL = getSuperadminApiUrl();
      
      let response;
      try {
        // 1. Primary: Direct query through POS Backend API (with auth headers automatically included)
        response = await api.get('/broadcasts', {
          params: { role: userRole || 'Admin' }
        });
      } catch (err) {
        try {
          // 2. Fallback: SuperAdmin API public endpoint
          response = await axios.get(`${SUPERADMIN_API_URL}/api/clients/broadcasts/${tenantDb}`, {
            params: { role: userRole || 'Admin' }
          });
        } catch (err2) {
          try {
            response = await axios.get(`${SUPERADMIN_API_URL}/api/broadcasts/client/${tenantDb}`, {
              params: { role: userRole || 'Admin' }
            });
          } catch (err3) {
            console.warn('[useBroadcasts] Could not fetch broadcasts from any endpoint');
            return;
          }
        }
      }

      const fetchedBroadcasts = Array.isArray(response.data) ? response.data : [];
      const clearedIds = JSON.parse(localStorage.getItem('cleared_broadcasts') || '[]');
      const visibleBroadcasts = fetchedBroadcasts.filter(b => !clearedIds.includes(b._id));
      setBroadcasts(visibleBroadcasts);

      // Check for any new un-notified broadcasts and schedule a native notification
      visibleBroadcasts.forEach(b => {
        const bId = String(b._id || b.id || '');
        if (!bId) return;
        const notifiedKey = `notified_native_broadcast_${bId}_${tenantDb}`;
        const legacyNotifiedKey = `notified_native_broadcast_${bId}`;
        const hasBeenNotified = localStorage.getItem(notifiedKey) || localStorage.getItem(legacyNotifiedKey);

        if (!hasBeenNotified) {
          localStorage.setItem(notifiedKey, 'true');
          localStorage.setItem(legacyNotifiedKey, 'true');
          triggerNativeBroadcastNotification(b);
        }
      });

      // Calculate unread count using localStorage to track read IDs
      let readBroadcasts = [];
      try {
        readBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
      } catch (e) {
        readBroadcasts = [];
      }
      const unread = visibleBroadcasts.filter(b => Array.isArray(readBroadcasts) && !readBroadcasts.includes(b._id)).length;
      setUnreadCount(unread);

    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    }
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
      // Update local state without re-fetching
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
    // 1. Initial immediate fetch
    fetchBroadcasts();

    // 2. High-speed 10-second background sync for near-instant broadcast delivery
    const interval = setInterval(() => {
      fetchBroadcasts();
    }, 10000);

    // 3. Instant refresh on tab visibility / window focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchBroadcasts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', fetchBroadcasts);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', fetchBroadcasts);
    };
  }, [userRole]);

  return { broadcasts, unreadCount, markAsRead, markAllAsRead, clearAllBroadcasts, fetchBroadcasts };
};

export default useBroadcasts;
