export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    if (isLocalhost) {
      return import.meta.env.VITE_API_URL || 'http://localhost:4001/api';
    }
  }
  return import.meta.env.VITE_API_URL || 'https://restaurant-billing-apk.vercel.app/api';
};

export const getBroadcastApiUrl = () => {
  return getApiBaseUrl();
};

export const API_BASE_URL = getApiBaseUrl();
export const BROADCAST_API_URL = getBroadcastApiUrl();

