/**
 * useOnlineStatus.js - React Hook for Online/Offline awareness
 * 
 * Provides components with:
 * - isOnline: boolean
 * - pendingCount: number of items waiting to sync
 */
import { useState, useEffect } from 'react';
import { isOnline as getOnlineStatus, getPendingCount, onStatusChange } from '../utils/syncEngine';

export const useOnlineStatus = () => {
  const [status, setStatus] = useState({
    isOnline: getOnlineStatus(),
    pendingCount: getPendingCount()
  });

  useEffect(() => {
    const unsubscribe = onStatusChange((newStatus) => {
      setStatus({ ...newStatus });
    });

    return unsubscribe;
  }, []);

  return status;
};

export default useOnlineStatus;
