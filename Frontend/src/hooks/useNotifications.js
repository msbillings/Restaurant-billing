import { useState, useEffect } from 'react';
import realtimeService from '../services/realtimeService';
import api from '../api/axios';

let lastAudioPlayTime = 0;
let notificationAudio = null;
try {
  notificationAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  notificationAudio.preload = 'auto';
} catch (e) {
  console.warn('Audio pre-load error:', e);
}

const playNotificationSound = () => {
  const now = Date.now();
  if (now - lastAudioPlayTime > 3000) {
    lastAudioPlayTime = now;
    try {
      if (!notificationAudio) {
        notificationAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      }
      notificationAudio.currentTime = 0;
      const p = notificationAudio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch (err) {
      console.warn('[Notification Audio] suppressed:', err);
    }
  }
};

export const getNotificationSocket = () => {
  return realtimeService.getSocket();
};

// Robust helper to determine if a notification is the cancellation request targeted by criteria
const isTargetCancelNotification = (n, criteria) => {
  if (!n || !criteria) return false;
  if (criteria.id && n.id === criteria.id) return true;

  const isCancelReq = n.data?.type === 'cancel_item_request' || (n.title && n.title.includes('Cancel Req'));
  if (!isCancelReq) return false;

  // 1. Direct itemId match
  if (criteria.itemId && n.data?.itemId && String(n.data.itemId) === String(criteria.itemId)) {
    return true;
  }

  // 2. Item Name match (case-insensitive substring or exact match)
  const targetItemName = (criteria.itemName || criteria.name || '').trim().toLowerCase();
  if (targetItemName) {
    const notifItemName = (n.data?.itemName || '').trim().toLowerCase();
    const notifMsg = (n.message || '').trim().toLowerCase();
    if (
      (notifItemName && notifItemName === targetItemName) ||
      (notifMsg && notifMsg.includes(targetItemName)) ||
      (targetItemName && notifItemName && targetItemName.includes(notifItemName) && notifItemName.length > 3)
    ) {
      return true;
    }
  }

  // 3. Order ID match
  if (criteria.orderId && n.data?.orderId && String(n.data.orderId) === String(criteria.orderId)) {
    if (!criteria.itemName || (n.message && n.message.toLowerCase().includes((criteria.itemName || '').toLowerCase()))) {
      return true;
    }
  }

  return false;
};

const useNotifications = (userRole = 'Admin') => {
  const getTenantKey = () => localStorage.getItem('resto_db_name') || 'default';

  const [notifications, setNotifications] = useState(() => {
    try {
      const tenantKey = getTenantKey();
      const saved = localStorage.getItem(`realtime_notifications_${tenantKey}`) || localStorage.getItem('realtime_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;

        // Collect all withdrawn items from saved notifications
        const withdrawnItems = [];
        parsed.forEach(n => {
          if (n.data?.type === 'cancel_item_withdrawn' || (n.title && n.title.includes('Cancel Withdrawn'))) {
            withdrawnItems.push({
              itemId: n.data?.itemId,
              itemName: n.data?.itemName,
              orderId: n.data?.orderId,
              message: n.message
            });
          }
        });

        return parsed.filter(n => {
          const t = new Date(n.time || n.timestamp || Date.now()).getTime();
          if (t <= twoDaysAgo) return false;

          // If this is an old cancel request for an item that has a corresponding withdrawal, purge it!
          const isCancelReq = n.data?.type === 'cancel_item_request' || (n.title && n.title.includes('Cancel Req'));
          if (isCancelReq) {
            for (const w of withdrawnItems) {
              if (isTargetCancelNotification(n, w)) return false;
            }
          }
          return true;
        });
      }
    } catch (e) {
      console.error('Failed to parse realtime notifications', e);
    }
    return [];
  });

  const [unreadCount, setUnreadCount] = useState(() => {
    try {
      const tenantKey = getTenantKey();
      return parseInt(localStorage.getItem(`realtime_unread_count_${tenantKey}`) || localStorage.getItem('realtime_unread_count') || '0', 10);
    } catch {
      return 0;
    }
  });

  // Save to localStorage whenever notifications change (tenant-scoped)
  useEffect(() => {
    const tenantKey = getTenantKey();
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    const freshNotifs = notifications.filter(n => {
      const t = new Date(n.time || n.timestamp || Date.now()).getTime();
      return t > twoDaysAgo;
    });
    localStorage.setItem(`realtime_notifications_${tenantKey}`, JSON.stringify(freshNotifs));
  }, [notifications]);

  useEffect(() => {
    const tenantKey = getTenantKey();
    localStorage.setItem(`realtime_unread_count_${tenantKey}`, unreadCount.toString());
  }, [unreadCount]);

  // Fetch active notifications from backend database on app launch / login
  const fetchActiveNotifications = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return;

      const res = await api.get('/bills/active-notifications');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setNotifications(prev => {
          const newMap = new Map();
          res.data.forEach(n => newMap.set(n.id, n));
          prev.forEach(n => {
            if (!newMap.has(n.id)) {
              newMap.set(n.id, n);
            }
          });
          return Array.from(newMap.values()).sort((a, b) => {
            const timeA = new Date(a.time || a.timestamp || 0);
            const timeB = new Date(b.time || b.timestamp || 0);
            return timeB - timeA;
          });
        });
      }
    } catch (err) {
      console.warn('[useNotifications] Active notifications fetch:', err.message);
    }
  };

  useEffect(() => {
    fetchActiveNotifications();
    const handleLogin = () => fetchActiveNotifications();
    window.addEventListener('loginSuccess', handleLogin);
    return () => {
      window.removeEventListener('loginSuccess', handleLogin);
    };
  }, []);

  useEffect(() => {
    const handleNewNotification = (notification) => {
      if (!notification) return;

      // Strict Tenant Filtering on Client
      const activeTenant = localStorage.getItem('resto_db_name');
      if (notification.tenantDb && activeTenant && notification.tenantDb !== activeTenant) {
        console.warn(`[useNotifications] Blocked notification from other tenant (${notification.tenantDb} != ${activeTenant})`);
        return;
      }

      // Role-Based Filtering
      if (notification.targetRoles && !notification.targetRoles.includes(userRole) && userRole !== 'Admin') {
        return;
      }

      setNotifications((prev) => {
        let updatedList = prev;

        // If this new notification is a withdrawal notification, immediately remove previous cancel request notifications!
        const isWithdrawnNotice = notification.data?.type === 'cancel_item_withdrawn' || (notification.title && notification.title.includes('Cancel Withdrawn'));
        if (isWithdrawnNotice) {
          const criteria = {
            itemId: notification.data?.itemId,
            itemName: notification.data?.itemName,
            orderId: notification.data?.orderId,
            message: notification.message
          };
          updatedList = updatedList.filter(n => !isTargetCancelNotification(n, criteria));
        }

        // Deduplicate: Don't add if we already have this notification ID
        if (updatedList.some(n => n.id === notification.id)) return updatedList;
        return [notification, ...updatedList];
      });
      
      setUnreadCount((prev) => prev + 1);
      playNotificationSound();
    };

    const handleDismissNotification = (criteria) => {
      if (!criteria) return;
      setNotifications((prev) => prev.filter((n) => !isTargetCancelNotification(n, criteria)));
    };

    const handleItemCancellationWithdrawn = (data) => {
      if (!data) return;
      setNotifications((prev) => prev.filter((n) => !isTargetCancelNotification(n, data)));
    };

    const handleCancellationResolved = (data) => {
      if (!data) return;
      setNotifications((prev) => prev.filter((n) => !isTargetCancelNotification(n, data)));
    };

    const unsubNotif = realtimeService.subscribe('new_notification', handleNewNotification);
    const unsubDismiss = realtimeService.subscribe('dismiss_notification', handleDismissNotification);
    const unsubWithdrawn = realtimeService.subscribe('itemCancellationWithdrawn', handleItemCancellationWithdrawn);
    const unsubResolved = realtimeService.subscribe('cancellationResolved', handleCancellationResolved);

    return () => {
      unsubNotif();
      unsubDismiss();
      unsubWithdrawn();
      unsubResolved();
    };
  }, [userRole]);

  const markAllAsRead = () => {
    setUnreadCount(0);
    try {
      const tenantKey = getTenantKey();
      const existingRead = JSON.parse(localStorage.getItem(`realtime_read_ids_${tenantKey}`) || localStorage.getItem('realtime_read_ids') || '[]');
      const allNotifIds = notifications.map(n => n.id);
      const combined = Array.from(new Set([...existingRead, ...allNotifIds]));
      localStorage.setItem(`realtime_read_ids_${tenantKey}`, JSON.stringify(combined));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const clearNotification = (id) => {
    if (id === 'ALL') {
      setNotifications([]);
      setUnreadCount(0);
    } else {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return { notifications, unreadCount, markAllAsRead, clearNotification };
};

export default useNotifications;
