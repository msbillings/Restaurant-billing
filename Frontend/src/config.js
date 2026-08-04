export const getApiUrl = () => {
    if (navigator.userAgent.toLowerCase().includes('electron')) {
        return 'http://127.0.0.1:5002/api';
    }

    const storedIp = localStorage.getItem('resto_server_ip');
    if (storedIp) {
        return `http://${storedIp}:5002/api`;
    }

    if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.includes('vercel.app')) {
        let envUrl = import.meta.env.VITE_API_URL;
        if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
            return envUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
        }
        return envUrl || `http://${window.location.hostname}:5002/api`;
    }

    return import.meta.env.VITE_API_URL || 'http://127.0.0.1:5002/api';
};

export const getSuperadminApiUrl = () => {
    // If the user configures a local superadmin IP
    const storedIp = localStorage.getItem('resto_superadmin_ip');
    if (storedIp) {
        return `http://${storedIp}:4001`;
    }

    // If running on a local device and they want the local superadmin API
    if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.includes('vercel.app')) {
        let envUrl = import.meta.env.VITE_SUPERADMIN_API_URL;
        // If .env points to localhost, we dynamically swap it for the actual local IP
        if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
            return envUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
        }
        return envUrl || `http://${window.location.hostname}:4001`;
    }

    // For Desktop Electron App, if local superadmin is running
    if (navigator.userAgent.toLowerCase().includes('electron')) {
        // We allow VITE_SUPERADMIN_API_URL to override, else use localhost:4001 as fallback if Vercel is not wanted.
        // Actually, let's use Vercel as the ultimate fallback, but allow environment to set it.
        return import.meta.env.VITE_SUPERADMIN_API_URL || 'https://restaurant-superadmin-api-maheer.vercel.app';
    }

    return import.meta.env.VITE_SUPERADMIN_API_URL || 'https://restaurant-superadmin-api-maheer.vercel.app';
};

export const getSocketUrl = () => {
    const apiUrl = getApiUrl();
    return apiUrl.replace('/api', '');
};
