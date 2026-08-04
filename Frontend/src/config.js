// Use environment variable for API URL, fallback to localhost for development
let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

// CRITICAL FIX: If running inside the Desktop Electron App, force localhost
if (navigator.userAgent.toLowerCase().indexOf('electron') > -1) {
  API_BASE_URL = 'http://localhost:5002/api';
}

export const getApiBaseUrl = () => API_BASE_URL;

export const getSocketUrl = () => {
  return API_BASE_URL.replace(/\/api$/, '');
};
