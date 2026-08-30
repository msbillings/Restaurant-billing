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
    // 1. Electron Desktop EXE — always use localhost backend
    if (isElectronApp()) {
        return 'http://127.0.0.1:5002/api';
    }

    // 2. If a local server IP is stored (for Android APK / iOS IPA / LAN devices on Wi-Fi)
    const storedIp = typeof localStorage !== 'undefined' ? localStorage.getItem('resto_server_ip') : null;
    if (storedIp && storedIp.trim()) {
        const cleanIp = storedIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        if (cleanIp.includes(':')) {
            return cleanApiUrl(`http://${cleanIp}`);
        }
        return cleanApiUrl(`http://${cleanIp}:5002`);
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const isVercelHost = typeof window !== 'undefined' && host && host.includes('vercel.app');

    // 3. If running directly on Vercel cloud domain
    if (isVercelHost) {
        let envUrl = import.meta.env.VITE_API_URL;
        if (envUrl && envUrl.startsWith('https://')) {
            return cleanApiUrl(envUrl);
        }
        return 'https://restaurant-billing-apk.vercel.app/api';
    }

    // 4. Capacitor APK/IPA native mobile app without a stored IP — fallback to cloud URL
    if (isCapacitorApp()) {
        let envUrl = import.meta.env.VITE_API_URL;
        if (envUrl && envUrl.startsWith('https://')) {
            return cleanApiUrl(envUrl);
        }
        return 'https://restaurant-billing-apk.vercel.app/api';
    }

    // 5. Local development or local LAN Wi-Fi IP
    let envUrl = import.meta.env.VITE_API_URL;
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

    return 'http://localhost:5002/api';
};

export const getSuperadminApiUrl = () => {
    const storedIp = typeof localStorage !== 'undefined' ? localStorage.getItem('resto_superadmin_ip') : null;
    if (storedIp && storedIp.trim()) {
        return cleanSuperadminUrl(`http://${storedIp.trim()}:4001`);
    }

    // Default: Live production cloud SuperAdmin server
    let envUrl = import.meta.env.VITE_SUPERADMIN_API_URL;
    if (envUrl && envUrl.startsWith('https://')) {
        return cleanSuperadminUrl(envUrl);
    }

    return 'https://restaurant-billing-apk.vercel.app';
};

export const getSocketUrl = () => {
    const apiUrl = getApiUrl();
    return apiUrl.replace(/\/api\/?$/, '');
};
