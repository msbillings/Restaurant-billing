import { Capacitor } from '@capacitor/core';

/**
 * Returns true when running inside the Android APK (Capacitor native platform).
 */
export const isCapacitorApp = () => Capacitor.isNativePlatform();

export const getApiUrl = () => {
    // Electron Desktop EXE — always use localhost backend
    if (navigator.userAgent.toLowerCase().includes('electron')) {
        return 'http://127.0.0.1:5002/api';
    }

    // If a server IP is stored (set from LicenseScreen or QRCodeGenerator), use it
    const storedIp = localStorage.getItem('resto_server_ip');
    if (storedIp && storedIp.trim()) {
        const cleanIp = storedIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        if (cleanIp.includes(':')) {
            return `http://${cleanIp}/api`;
        }
        return `http://${cleanIp}:5002/api`;
    }

    // Capacitor APK without a stored IP — use cloud/production URL
    if (isCapacitorApp()) {
        let envUrl = import.meta.env.VITE_API_URL;
        if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
            return envUrl;
        }
        return 'https://restaurant-billing-apk.vercel.app/api';
    }

    let envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
            const host = window.location.hostname;
            if (host && host !== 'localhost' && host !== '127.0.0.1') {
                return envUrl.replace(/localhost|127\.0\.0\.1/, host);
            }
        } else {
            return envUrl;
        }
    }

    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    // If running on Vercel or any cloud HTTPS deployment without a stored local IP
    if (host && (host.includes('vercel.app') || (typeof window !== 'undefined' && window.location.protocol === 'https:'))) {
        return 'https://restaurant-billing-apk.vercel.app/api';
    }

    if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:5002/api`;
    }

    return `http://${host || 'localhost'}:5002/api`;
};

export const getSuperadminApiUrl = () => {
    const storedIp = localStorage.getItem('resto_superadmin_ip');
    if (storedIp) {
        return `http://${storedIp}:4001`;
    }

    let envUrl = import.meta.env.VITE_SUPERADMIN_API_URL;
    
    // If there is an environment variable provided for superadmin
    if (envUrl) {
        if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
             return envUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname || '127.0.0.1');
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
