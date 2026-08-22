export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    if (isLocalhost) {
      return import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    }
  }
  return import.meta.env.VITE_API_URL || 'https://restaurant-superadmin-api-maheer.vercel.app/api';
};

export const API_BASE_URL = getApiBaseUrl();
