import { Capacitor } from '@capacitor/core';

/**
 * Returns true when running inside the Android APK (Capacitor native platform).
 */
export const isCapacitorApp = () => Capacitor.isNativePlatform();

/**
 * Returns true when running inside Electron Desktop App (.exe).
 */
export const isElectronApp = () => {
    if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron')) {
        return true;
    }
    if (typeof window !== 'undefined' && (!!window.electronAPI || window.location.protocol === 'file:')) {
        return true;
    }
    return false;
};

/**
 * Normalize and clean API URLs so there are never trailing slashes or duplicate /api/api
 */
export const cleanApiUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    let trimmed = url.trim().replace(/\/+$/, ''); // Remove trailing slashes
    // Ensure single /api suffix
    if (!trimmed.endsWith('/api')) {
        trimmed = `${trimmed}/api`;
    }
    // Safety check: eliminate any accidental double '/api/api'
    trimmed = trimmed.replace(/\/api\/api(?:\/api)*/g, '/api');
    return trimmed;
};

export const cleanSuperadminUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    let trimmed = url.trim().replace(/\/+$/, '');
    // SuperAdmin backend runs on root without /api prefix
    trimmed = trimmed.replace(/\/api(?:\/api)*$/, '');
    return trimmed;
};

export const getApiUrl = () => {
    const storedIp = typeof localStorage !== 'undefined' ? localStorage.getItem('resto_server_ip') : null;
    if (storedIp && storedIp.trim()) {
        const cleanIp = storedIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        if (cleanIp.includes(':')) {
            return cleanApiUrl(`http://${cleanIp}`);
        }
        return cleanApiUrl(`http://${cleanIp}:5002`);
    }

    const envUrl = import.meta.env.VITE_API_URL;

    // 1. Electron Desktop EXE
    if (isElectronApp()) {
        if (envUrl) {
            return cleanApiUrl(envUrl);
        }
        return 'http://127.0.0.1:5002/api';
    }

    // 2. Capacitor APK/IPA native mobile app
    if (isCapacitorApp()) {
        if (envUrl) {
            return cleanApiUrl(envUrl);
        }
        throw new Error("FATAL: VITE_API_URL is missing in Capacitor build. Production fallback is disabled for safety.");
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isVercelHost = typeof window !== 'undefined' && host && host.includes('vercel.app');

    // 3. Web Environment
    if (isVercelHost) {
        if (envUrl) {
            return cleanApiUrl(envUrl);
        }
        throw new Error("FATAL: VITE_API_URL is missing in Vercel environment. Production fallback is disabled for safety.");
    }

    if (envUrl) {
        if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
            if (host && host !== 'localhost' && host !== '127.0.0.1') {
                return cleanApiUrl(envUrl.replace(/localhost|127\.0\.0\.1/, host));
            }
        }
        return cleanApiUrl(envUrl);
    }

    if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return cleanApiUrl(`http://${host}:5002`);
    }

    return 'http://localhost:4001/api';
};

export const getSuperadminApiUrl = () => {
    const storedIp = typeof localStorage !== 'undefined' ? localStorage.getItem('resto_superadmin_ip') : null;
    if (storedIp && storedIp.trim()) {
        return cleanSuperadminUrl(`http://${storedIp.trim()}:4001`);
    }

    const envUrl = import.meta.env.VITE_API_URL;

    if (isElectronApp() || isCapacitorApp()) {
        if (envUrl) {
            return cleanSuperadminUrl(envUrl);
        }
        if (isElectronApp()) {
            return 'http://127.0.0.1:4001';
        }
        throw new Error("FATAL: VITE_API_URL is missing for SuperAdmin in mobile build. Production fallback is disabled for safety.");
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:4001';
    }

    if (envUrl) {
        return cleanSuperadminUrl(envUrl);
    }

    throw new Error("FATAL: VITE_API_URL is missing for SuperAdmin. Production fallback is disabled for safety.");
};

export const getSocketUrl = () => {
    const apiUrl = getApiUrl();
    return apiUrl.replace(/\/api\/?$/, '');
};
