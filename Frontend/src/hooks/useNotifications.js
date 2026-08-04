import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

import { getSocketUrl } from '../config.js';

const SOCKET_URL = getSocketUrl();

// Create a singleton socket for notifications so we don't open multiple connections
let notificationSocket = null;

export const getNotificationSocket = () => {
  if (!notificationSocket) {
    notificationSocket = io(SOCKET_URL);
  }
  return notificationSocket;
};

const useNotifications = (userRole = 'Admin') => {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('realtime_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
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
    localStorage.setItem('realtime_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('realtime_unread_count', unreadCount.toString());
  }, [unreadCount]);

  useEffect(() => {
    const socket = getNotificationSocket();

    const handleNewNotification = (notification) => {
      // Role-Based Filtering
      if (notification.targetRoles && !notification.targetRoles.includes(userRole) && userRole !== 'Admin') {
        return; // Ignore if user doesn't have the required role
      }

      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Play sound
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch((e) => console.log('Audio play error (user interaction required):', e));
      } catch (err) {
        console.error('Failed to play notification sound', err);
      }
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [userRole]);

  const markAllAsRead = () => {
    setUnreadCount(0);
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
