import { Capacitor } from '@capacitor/core';

/**
 * Returns true when running inside the Android APK (Capacitor native platform).
 */
export const isCapacitorApp = () => Capacitor.isNativePlatform();

export const getApiUrl = () => {
    // 1. Electron Desktop EXE — always use localhost backend
    if (navigator.userAgent.toLowerCase().includes('electron')) {
        return 'http://127.0.0.1:5002/api';
    }

    // 2. If a server IP is stored (set from LicenseScreen or QRCodeGenerator), use it
    const storedIp = localStorage.getItem('resto_server_ip');
    if (storedIp && storedIp.trim()) {
        const cleanIp = storedIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        if (cleanIp.includes(':')) {
            return `http://${cleanIp}/api`;
        }
        return `http://${cleanIp}:5002/api`;
    }

    // 3. Capacitor APK without a stored IP — use cloud/production URL
    if (isCapacitorApp()) {
        let envUrl = import.meta.env.VITE_API_URL;
        if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
            return envUrl;
        }
        return 'https://restaurant-billing-apk.vercel.app/api';
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    // 4. If running on Vercel or any cloud HTTPS deployment without a stored local IP
    if (host && (host.includes('vercel.app') || (typeof window !== 'undefined' && window.location.protocol === 'https:'))) {
        return 'https://restaurant-billing-apk.vercel.app/api';
    }

    // 5. Local development or local LAN Wi-Fi IP
    let envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
            if (host && host !== 'localhost' && host !== '127.0.0.1') {
                return envUrl.replace(/localhost|127\.0\.0\.1/, host);
            }
        } else {
            return envUrl;
        }
    }

    if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:5002/api`;
    }

    return `http://${host || 'localhost'}:5002/api`;
};

export const getSuperadminApiUrl = () => {
    const storedIp = localStorage.getItem('resto_superadmin_ip');
    if (storedIp && storedIp.trim()) {
        return `http://${storedIp.trim()}:4001`;
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    // If running on Vercel or any cloud HTTPS deployment
    if (host && (host.includes('vercel.app') || (typeof window !== 'undefined' && window.location.protocol === 'https:'))) {
        return 'https://restaurant-superadmin-api-maheer.vercel.app';
    }

    let envUrl = import.meta.env.VITE_SUPERADMIN_API_URL;
    if (envUrl) {
        if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
             return envUrl.replace(/localhost|127\.0\.0\.1/, host || '127.0.0.1');
        }
        return envUrl;
    }

    // Default to the production Superadmin API
    return 'https://restaurant-superadmin-api-maheer.vercel.app';
};

export const getSocketUrl = () => {
    const apiUrl = getApiUrl();
    return apiUrl.replace('/api', '');
};
