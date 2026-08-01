import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';

// Create a singleton socket for notifications so we don't open multiple connections
let notificationSocket = null;

export const getNotificationSocket = () => {
  if (!notificationSocket) {
    notificationSocket = io(SOCKET_URL);
  }
  return notificationSocket;
};

const useNotifications = (userRole = 'Admin') => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return { notifications, unreadCount, markAllAsRead, clearNotification };
};

export default useNotifications;
