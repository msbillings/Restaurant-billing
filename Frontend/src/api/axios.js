import { getApiUrl } from "../config.js";
import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
let API_BASE_URL = getApiUrl();

// CRITICAL FIX: If running inside the Desktop Electron App, force localhost
if (navigator.userAgent.toLowerCase().indexOf('electron') > -1) {
  API_BASE_URL = 'http://127.0.0.1:5002/api';
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate axios instance for auth refresh to avoid interceptor recursion
const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh state management
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Force logout helper — clears auth tokens and dispatches a custom event
 * so App.jsx can reset React state WITHOUT a hard page reload.
 * This breaks the infinite reload loop that was the #1 cause of auto-refresh.
 */
let isForceLoggingOut = false; // Debounce guard
const forceLogout = () => {
  if (isForceLoggingOut) return; // Prevent multiple simultaneous force-logouts
  isForceLoggingOut = true;

  console.warn('[axios] Force logout triggered — clearing tokens, dispatching event');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');

  // Dispatch a custom event that App.jsx listens for.
  // This lets React handle the state change instead of doing a destructive window.location.reload().
  window.dispatchEvent(new Event('forceLogout'));

  // Reset the debounce guard after a short delay so the user can log in again
  setTimeout(() => { isForceLoggingOut = false; }, 2000);
};

// Add a request interceptor to include the token, tenant DB header, and dynamic baseURL
api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiUrl();
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const tenantDb = localStorage.getItem('resto_db_name');
    if (tenantDb) {
      config.headers['X-Tenant-DB'] = tenantDb;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

authApi.interceptors.request.use(
  (config) => {
    config.baseURL = getApiUrl();
    const tenantDb = localStorage.getItem('resto_db_name');
    if (tenantDb) {
      config.headers['X-Tenant-DB'] = tenantDb;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Log errors for debugging in production
    if (error.response) {
      console.error('API Error:', {
        status: error.response.status,
        url: error.config?.url,
        message: error.response.data?.message || error.message,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('Network Error:', {
        url: error.config?.url,
        message: 'No response received from server'
      });
    } else {
      console.error('Request Error:', error.message);
    }

    // Check if we are on the public customer QR menu page.
    // This page is public and requires NO authentication — never force-logout from here.
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isPublicOrderPage = window.location.pathname === '/order' || 
                              window.location.pathname.startsWith('/order/') ||
                              (searchParams.has('table') && searchParams.has('tenant'));

    // Handle 401 (Unauthorized) - Session invalid/expired -> Logout immediately
    if (error.response?.status === 401) {
      // Don't logout if:
      // 1. The request was to the login endpoint (just pass the error to show message)
      // 2. The user is on the public /order page (QR customer menu — no auth needed)
      if (!originalRequest.url?.includes('/auth/login') && !isPublicOrderPage) {
        console.warn('401 Unauthorized - Logging out user');
        forceLogout();
      }
      return Promise.reject(error);
    }

    // Handle 403 (Forbidden) - Token expired -> Try Refresh
    // CRITICAL FIX: Skip refresh logic for auth endpoints (login/register/refresh).
    // A 403 from /auth/login means "max sessions reached" and MUST be shown to the user!
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');
    if (error.response?.status === 403 && !originalRequest._retry && !isAuthEndpoint && !isPublicOrderPage) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        console.warn('No refresh token available - Logging out');
        forceLogout();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        console.log('Attempting to refresh access token...');
        // Use separate axios instance to avoid triggering interceptor
        const response = await authApi.post('/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        console.log('Token refresh successful');
        // Store new tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // Update the original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // Process queued requests
        processQueue(null, accessToken);
        isRefreshing = false;

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear storage and force logout (NO reload!)
        console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
        processQueue(refreshError, null);
        isRefreshing = false;

        forceLogout();
        return Promise.reject(refreshError);
      }
    }

    // If not a 401/403 or refresh failed, check if we can fallback from local IP to Cloud API or retry
    const isGetRequest = (originalRequest?.method || 'get').toLowerCase() === 'get';
    const isNetworkOrTimeout = !error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');

    // 1. SMART CLOUD FALLBACK: If local IP is unreachable (e.g. phone switched from Wi-Fi to 5G cellular)
    const currentBase = originalRequest?.baseURL || '';
    const isLocalNetworkIp = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost|127\.0\.0\.1)/i.test(currentBase);
    const isWhatsAppEndpoint = originalRequest?.url?.includes('/whatsapp/');
    
    if (isNetworkOrTimeout && isLocalNetworkIp && !originalRequest._fallbackToCloud && !isWhatsAppEndpoint) {
      console.warn('[axios] Local server unreachable, automatically falling back to live Cloud API:', originalRequest.url);
      originalRequest._fallbackToCloud = true;
      originalRequest.baseURL = 'https://restaurant-billing-apk.vercel.app/api';
      return api(originalRequest);
    }

    // 2. TRANSIENT NETWORK ERROR RETRY for GET requests (cold start / temporary latency spike)
    if (isNetworkOrTimeout && isGetRequest && (!originalRequest._retryCount || originalRequest._retryCount < 2)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delay = originalRequest._retryCount * 600;
      console.warn(`[axios] Transient network error on GET ${originalRequest.url}. Retrying attempt ${originalRequest._retryCount} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;

