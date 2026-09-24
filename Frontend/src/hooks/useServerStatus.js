import { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config';

const useServerStatus = (pingIntervalMs = 5000) => {
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    let timeout;

    const checkServer = async () => {
      if (mounted) setIsChecking(true);
      try {
        // Adjust endpoint if necessary; using getApiUrl()/health as a fallback if /api/health isn't right
        const url = `${getApiUrl()}/health`; 
        await axios.get(url, { timeout: 3000 });
        if (mounted) {
          setIsServerConnected(true);
          setIsChecking(false);
        }
      } catch (error) {
        if (mounted) {
          setIsServerConnected(false);
          setIsChecking(false);
        }
      }
    };

    checkServer();

    // Ping periodically
    const interval = setInterval(checkServer, pingIntervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pingIntervalMs]);

  return { isServerConnected, isChecking };
};

export default useServerStatus;
