import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const useBroadcasts = (userRole) => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchBroadcasts = async () => {
    try {
      const tenantDb = localStorage.getItem('resto_db_name');
      if (!tenantDb) return; // No tenant DB yet (not logged in or license not verified)

      // Use the actual SuperAdmin URL, or a local dev URL
      const SUPERADMIN_API_URL = getSuperadminApiUrl();
      
      const response = await axios.get(`${SUPERADMIN_API_URL}/api/broadcasts/client/${tenantDb}`, {
        params: { role: userRole || 'Admin' }
      });

      const fetchedBroadcasts = response.data;
      const clearedIds = JSON.parse(localStorage.getItem('cleared_broadcasts') || '[]');
      const visibleBroadcasts = fetchedBroadcasts.filter(b => !clearedIds.includes(b._id));
      setBroadcasts(visibleBroadcasts);

      // Calculate unread count using localStorage to track read IDs
      const readBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
      const unread = visibleBroadcasts.filter(b => !readBroadcasts.includes(b._id)).length;
      setUnreadCount(unread);

    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    }
  };

  const markAsRead = (broadcastId) => {
    const readBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
    if (!readBroadcasts.includes(broadcastId)) {
      readBroadcasts.push(broadcastId);
      localStorage.setItem('read_broadcasts', JSON.stringify(readBroadcasts));
      // Update local state without re-fetching
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = () => {
    const readBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
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
    fetchBroadcasts();
    
    const SUPERADMIN_API_URL = getSuperadminApiUrl();
    const socket = io(SUPERADMIN_API_URL);

    // When any broadcast event happens, we just fetch again for simplicity 
    // and correctness, or we can just fetch to keep it in sync.
    // Given the complexity of filtering, calling fetchBroadcasts is safest
    // and still gives real-time updates without polling.
    socket.on('new_broadcast', () => {
      fetchBroadcasts();
    });

    socket.on('update_broadcast', () => {
      fetchBroadcasts();
    });

    socket.on('delete_broadcast', () => {
      fetchBroadcasts();
    });
    
    return () => {
      socket.disconnect();
    };
  }, [userRole]);

  return { broadcasts, unreadCount, markAsRead, markAllAsRead, clearAllBroadcasts, fetchBroadcasts };
};

export default useBroadcasts;
