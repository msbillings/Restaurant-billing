export const getApiUrl = () => {
    if (navigator.userAgent.toLowerCase().includes('electron')) {
        return 'http://127.0.0.1:5002/api';
    }

    const storedIp = localStorage.getItem('resto_server_ip');
    if (storedIp) {
        return `http://${storedIp}:5002/api`;
    }

    // If we have an environment URL, use it but swap localhost/127.0.0.1 with the actual hostname
    // This allows access from both localhost and dynamic network IPs (e.g., 192.168.1.5)
    let envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
            return envUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname || '127.0.0.1');
        }
        return envUrl;
    }

    // Fallback if no envUrl is provided
    return `http://${window.location.hostname || '127.0.0.1'}:5002/api`;
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
