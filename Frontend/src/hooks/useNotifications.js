import { useState, useEffect } from 'react';
import realtimeService from '../services/realtimeService';

let lastAudioPlayTime = 0;
// Pre-load notification audio object once globally so audio plays instantly without network fetch lag
let notificationAudio = null;
try {
  notificationAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  notificationAudio.preload = 'auto';
} catch (e) {
  console.warn('Audio pre-load error:', e);
}

export const getNotificationSocket = () => {
  return realtimeService.getSocket();
};

const useNotifications = (userRole = 'Admin') => {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('realtime_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
        return parsed.filter(n => {
          const t = new Date(n.time || n.timestamp || Date.now()).getTime();
          return t > twoDaysAgo;
        });
      }
    } catch (e) {
      console.error('Failed to parse realtime notifications', e);
    }
    return [];
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem('realtime_unread_count') || '0', 10);
    } catch {
      return 0;
    }
  });

  // Save to localStorage whenever notifications change
  useEffect(() => {
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    const freshNotifs = notifications.filter(n => {
      const t = new Date(n.time || n.timestamp || Date.now()).getTime();
      return t > twoDaysAgo;
    });
    localStorage.setItem('realtime_notifications', JSON.stringify(freshNotifs));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('realtime_unread_count', unreadCount.toString());
  }, [unreadCount]);

  useEffect(() => {
    const handleNewNotification = (notification) => {
      if (!notification) return;
      // Role-Based Filtering
      if (notification.targetRoles && !notification.targetRoles.includes(userRole) && userRole !== 'Admin') {
        return; // Ignore if user doesn't have the required role
      }

      setNotifications((prev) => {
        // Deduplicate: Don't add if we already have this notification ID
        if (prev.some(n => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
      
      setUnreadCount((prev) => prev + 1);

      // Play sound instantly using pre-loaded audio instance (0ms latency)
      const now = Date.now();
      if (now - lastAudioPlayTime > 3000) {
        lastAudioPlayTime = now;
        try {
          if (notificationAudio) {
            notificationAudio.currentTime = 0;
            notificationAudio.play().catch((e) => console.log('Audio play error (user interaction required):', e));
          }
        } catch (err) {
          console.error('Failed to play notification sound', err);
        }
      }
    };

    const unsubNotif = realtimeService.subscribe('new_notification', handleNewNotification);

    return () => {
      unsubNotif();
    };
  }, [userRole]);

  const markAllAsRead = () => {
    setUnreadCount(0);
    try {
      const existingRead = JSON.parse(localStorage.getItem('realtime_read_ids') || '[]');
      const allNotifIds = notifications.map(n => n.id);
      const combined = Array.from(new Set([...existingRead, ...allNotifIds]));
      localStorage.setItem('realtime_read_ids', JSON.stringify(combined));
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
