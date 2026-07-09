import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

// CRITICAL FIX: If running inside the Desktop Electron App, force localhost
if (navigator.userAgent.toLowerCase().indexOf('electron') > -1) {
  API_BASE_URL = 'http://localhost:5002/api';
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate axios instance for auth refresh to avoid interceptor recursion
const authApi = axios.create({
  baseURL: API_BASE_URL,
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

// Add a request interceptor to include the token and tenant DB header
api.interceptors.request.use(
  (config) => {
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

    // Handle 401 (Unauthorized) - Session invalid/expired -> Logout immediately
    if (error.response?.status === 401) {
      // Don't reload if the request was to the login endpoint, just pass the error
      if (!originalRequest.url?.includes('/auth/login')) {
        console.warn('401 Unauthorized - Logging out user');
        forceLogout();
      }
      return Promise.reject(error);
    }

    // Handle 403 (Forbidden) - Token expired -> Try Refresh
    // CRITICAL FIX: Skip refresh logic for auth endpoints (login/register/refresh).
    // A 403 from /auth/login means "max sessions reached" and MUST be shown to the user!
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');
    if (error.response?.status === 403 && !originalRequest._retry && !isAuthEndpoint) {
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

    // If not a 401/403 or refresh failed, reject the error
    return Promise.reject(error);
  }
);

export default api;
