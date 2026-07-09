import { useEffect } from 'react';

/**
 * SessionManager Component
 * Automatically checks for token expiry and logs out user before token expires
 * Runs a check every minute
 * 
 * FIXED: Uses forceLogout custom event instead of window.location.reload()
 *        to prevent infinite page refresh loops.
 */
const SessionManager = () => {
    useEffect(() => {
        const checkSession = () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return;

            try {
                // Decode JWT without verification (just to read the payload)
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                    atob(base64)
                        .split('')
                        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                );

                const decoded = JSON.parse(jsonPayload);
                const now = Date.now() / 1000; // Current time in seconds
                const timeUntilExpiry = decoded.exp - now; // Time left in seconds

                // If token has expired or will expire in less than 5 minutes
                if (timeUntilExpiry <= 0) {
                    console.log('[SessionManager] Token expired, logging out...');
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    // Dispatch custom event instead of hard page reload
                    window.dispatchEvent(new Event('forceLogout'));
                } else if (timeUntilExpiry < 300) {
                    // Less than 5 minutes - warn user
                    console.warn(`[SessionManager] Token expiring in ${Math.floor(timeUntilExpiry / 60)} minutes`);
                }
            } catch (error) {
                console.error('[SessionManager] Error checking session:', error);
                // If token is malformed, log out via event (NOT reload!)
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                window.dispatchEvent(new Event('forceLogout'));
            }
        };

        // Check immediately on mount
        checkSession();

        // Check every minute (60000ms)
        const interval = setInterval(checkSession, 60000);

        return () => clearInterval(interval);
    }, []);

    // This component doesn't render anything
    return null;
};

export default SessionManager;
