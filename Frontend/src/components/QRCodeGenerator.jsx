import { getApiUrl, isCapacitorApp } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { QrCode, Printer, Wifi, Save, RefreshCw, AlertTriangle, Layers, Globe, Copy, Check, Info, Server, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/axios';
import { getOpenOrders } from '../api/billing';
import BackButton from './common/BackButton';

const DEFAULT_VERCEL_URL = 'https://restaurant-billing-seven.vercel.app';

const getSpaceType = (str) => {
  if (!str) return 'table';
  const s = str.toLowerCase();
  if (s.includes('cabin') || s.startsWith('c')) return 'cabin';
  if (s.includes('sofa') || s.startsWith('s')) return 'sofa';
  if (s.includes('room') || s.startsWith('r')) return 'room';
  if (s.includes('bar') || s.startsWith('b')) return 'bar';
  if (s.includes('table') || s.startsWith('t')) return 'table';
  return 'table';
};

const extractNumber = (str) => {
  if (!str) return null;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const isTableMatching = (tableA, tableB) => {
  if (!tableA || !tableB) return false;
  const cleanA = tableA.trim().replace(/\s+/g, ' ').toLowerCase();
  const cleanB = tableB.trim().replace(/\s+/g, ' ').toLowerCase();
  if (cleanA === cleanB) return true;

  const hasFloorA = cleanA.includes(' - ');
  const hasFloorB = cleanB.includes(' - ');

  if (hasFloorA && hasFloorB) {
    const floorA = cleanA.split(' - ')[0].trim();
    const floorB = cleanB.split(' - ')[0].trim();
    if (floorA !== floorB) {
      return false;
    }
  }

  const spaceA = hasFloorA ? cleanA.split(' - ').slice(1).join(' - ').trim() : cleanA;
  const spaceB = hasFloorB ? cleanB.split(' - ').slice(1).join(' - ').trim() : cleanB;

  if (spaceA === spaceB) return true;

  const typeA = getSpaceType(spaceA);
  const typeB = getSpaceType(spaceB);
  if (typeA !== typeB) {
    return false;
  }

  const numA = extractNumber(spaceA);
  const numB = extractNumber(spaceB);
  if (numA !== null && numB !== null && numA === numB) {
    return true;
  }

  return false;
};

const QRCodeGenerator = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();

  // Loading state: Do NOT render QR codes until floors and table statuses (Empty/Busy) are dynamically loaded
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // floors = [{ floorName: string, tables: string[] }]
  const [floors, setFloors] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState('ALL');
  const [restaurantName, setRestaurantName] = useState('MSBillings');

  // Detect Electron (file: protocol or electron userAgent)
  const isElectron = typeof window !== 'undefined' && (
    window.location.protocol === 'file:' || 
    (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) || 
    Boolean(window.electronAPI)
  );

  // Detect local hostname / development environment
  const isLocalHostname = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname === '0.0.0.0'
  );
  const isDevPort = typeof window !== 'undefined' && ['5173', '5174', '5175', '3000'].includes(window.location.port);
  const isDev = Boolean(import.meta.env.DEV || isDevPort || isLocalHostname);

  // Detect production environment (e.g. deployed on Vercel or cloud domain)
  const isVercelHost = typeof window !== 'undefined' && Boolean(window.location.hostname?.includes('vercel.app'));
  const isProduction = isVercelHost || (!isDev && !isElectron && !isLocalHostname);

  // QR Mode: In production, force 'cloud' (Vercel URL). In development, allow 'cloud' or 'wifi'
  const [qrMode, setQrMode] = useState(() => {
    if (isProduction) return 'cloud';
    return localStorage.getItem('resto_qr_mode') || 'cloud';
  });

  // Vercel / Cloud URL Configuration
  const initialVercelUrl = localStorage.getItem('resto_vercel_url') || 
    (typeof window !== 'undefined' && window.location.hostname?.includes('vercel.app') ? window.location.origin : DEFAULT_VERCEL_URL);
  const [vercelUrl, setVercelUrl] = useState(initialVercelUrl);
  const [customVercelInput, setCustomVercelInput] = useState(initialVercelUrl);
  const [vercelSavedToast, setVercelSavedToast] = useState(false);
  const [copiedTable, setCopiedTable] = useState(null);

  // Initial IP setup from stored resto_server_ip or hostname
  const storedIp = typeof window !== 'undefined' ? localStorage.getItem('resto_server_ip') : null;
  const [localIP, setLocalIP] = useState(storedIp || (isElectron ? '127.0.0.1' : (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1')));
  const [localPort, setLocalPort] = useState(
    isElectron ? '5002' : (typeof window !== 'undefined' && window.location.port ? window.location.port : '5173')
  );
  const [customIpInput, setCustomIpInput] = useState(storedIp || '');
  const [ipSavedToast, setIpSavedToast] = useState(false);

  /**
   * Returns [{ floorName: string, tables: string[] }]
   * Each entry represents one floor with its table/cabin/sofa/space names.
   */
  const extractFloorSpaces = (floorsList) => {
    if (!Array.isArray(floorsList)) return [];
    const result = [];
    floorsList.forEach((floor) => {
      if (!floor) return;
      const floorName = floor.name || 'Floor';
      const tableNames = [];
      // Collect from all space-type arrays: tables, cabins, sofas, spaces
      ['tables', 'cabins', 'sofas', 'spaces'].forEach((key) => {
        if (Array.isArray(floor[key])) {
          floor[key].forEach((item) => {
            if (item && item.name) tableNames.push(item.name);
          });
        }
      });
      if (tableNames.length > 0) {
        result.push({ floorName, tables: tableNames });
      }
    });
    return result;
  };

  const fetchIP = async () => {
    if (isProduction) return;

    try {
      const API_BASE_URL = getApiUrl();
      const response = await fetch(`${API_BASE_URL}/public/system-ip`);
      if (response.ok) {
        const data = await response.json();
        if (data.ip && data.ip !== 'localhost' && data.ip !== '127.0.0.1') {
          if (!localStorage.getItem('resto_server_ip')) {
            setLocalIP(data.ip);
            setCustomIpInput(data.ip);
          }
        }
        if (data.port && !isDev) {
          setLocalPort(String(data.port));
        }
      }
    } catch (err) {
      if (!isElectron && window.location.hostname !== 'localhost') {
        setLocalIP(window.location.hostname);
      }
      console.warn('Could not fetch system IP, using fallback:', err);
    }
  };

  const fetchFloorsAndSettings = async () => {
    let extracted = [];

    try {
      const response = await api.get('/floors');
      if (response.data && Array.isArray(response.data)) {
        extracted = extractFloorSpaces(response.data);
        localStorage.setItem('msbillings_spaces', JSON.stringify(response.data));
      }
    } catch (err) {
      console.warn('Could not fetch floors from API, reading from localStorage', err);
    }

    if (extracted.length === 0) {
      try {
        const savedSpaces = localStorage.getItem('msbillings_spaces');
        if (savedSpaces) {
          const parsed = JSON.parse(savedSpaces);
          extracted = extractFloorSpaces(parsed);
        }
      } catch (e) {
        console.error('Error parsing local spaces:', e);
      }
    }

    // Fallback if no floors exist
    setFloors(extracted.length > 0 ? extracted : [{ floorName: 'Ground Floor', tables: ['Table 1', 'Table 2', 'Table 3', 'Table 4'] }]);

    try {
      const settings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      if (settings.restaurantName) setRestaurantName(settings.restaurantName);
    } catch (error) {
      console.error('Error loading settings for QRs:', error);
    }
  };

  const fetchActiveOrders = async () => {
    try {
      const orders = await getOpenOrders();
      if (orders && Array.isArray(orders)) {
        setOpenOrders(orders);
      }
    } catch (err) {
      console.warn('Could not fetch open orders for QR page:', err);
    }
  };

  // Initial Unified Dynamic Loading of Floors + Active Orders Status + Network IP
  useEffect(() => {
    let isMounted = true;

    const loadAllInitialData = async () => {
      setIsLoading(true);
      try {
        await Promise.allSettled([
          fetchFloorsAndSettings(),
          fetchActiveOrders(),
          fetchIP()
        ]);
      } catch (err) {
        console.error('Error loading QR initial data:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAllInitialData();

    const handleSpacesUpdated = (event) => {
      if (event.detail && Array.isArray(event.detail)) {
        const updated = extractFloorSpaces(event.detail);
        if (updated.length > 0) setFloors(updated);
      }
    };
    window.addEventListener('spacesUpdated', handleSpacesUpdated);

    // Fast polling every 4s for real-time table busy/empty status sync
    const pollInterval = setInterval(() => {
      fetchActiveOrders();
    }, 4000);

    return () => {
      isMounted = false;
      window.removeEventListener('spacesUpdated', handleSpacesUpdated);
      clearInterval(pollInterval);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        fetchFloorsAndSettings(),
        fetchActiveOrders(),
        fetchIP()
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getTableStatusInfo = (floorName, tableName) => {
    if (!openOrders || !Array.isArray(openOrders) || openOrders.length === 0) {
      return { isBusy: false, statusText: t('Empty') };
    }
    const fullTableName = `${floorName} - ${tableName}`;
    const order = openOrders.find(o => {
      if (!o.tableNo || (o.status !== 'Open' && o.status !== 'Billed' && o.status !== 'Occupied')) return false;
      return isTableMatching(o.tableNo, fullTableName);
    });

    if (order && order.items && order.items.filter(i => !i.isCancelled && ((i.quantity || 0) - (i.cancelledQuantity || 0)) > 0).length > 0) {
      return { isBusy: true, statusText: t('Busy'), total: order.total || 0, order };
    }
    return { isBusy: false, statusText: t('Empty') };
  };

  const handleSaveCustomIp = (ipToSave) => {
    let cleanIp = ipToSave.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    if (cleanIp) {
      localStorage.setItem('resto_server_ip', cleanIp);
      setLocalIP(cleanIp);
      setCustomIpInput(cleanIp);
    } else {
      localStorage.removeItem('resto_server_ip');
      setLocalIP(window.location.hostname);
      setCustomIpInput('');
    }
    setIpSavedToast(true);
    setTimeout(() => setIpSavedToast(false), 2500);
  };

  const handleSaveVercelUrl = (urlToSave) => {
    let cleanUrl = urlToSave.trim().replace(/\/+$/, '');
    if (cleanUrl) {
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = 'https://' + cleanUrl;
      }
      localStorage.setItem('resto_vercel_url', cleanUrl);
      setVercelUrl(cleanUrl);
      setCustomVercelInput(cleanUrl);
    } else {
      localStorage.removeItem('resto_vercel_url');
      setVercelUrl(DEFAULT_VERCEL_URL);
      setCustomVercelInput(DEFAULT_VERCEL_URL);
    }
    setVercelSavedToast(true);
    setTimeout(() => setVercelSavedToast(false), 2500);
  };

  const handleSelectQrMode = (mode) => {
    if (isProduction && mode === 'wifi') return; // Strict lock in production
    setQrMode(mode);
    localStorage.setItem('resto_qr_mode', mode);
  };

  const handleCopyMenuLink = (url, table) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url);
      setCopiedTable(table);
      setTimeout(() => setCopiedTable(null), 2000);
    }
  };

  const getQRUrl = (table) => {
    const dbName = localStorage.getItem('resto_db_name') || 'default';

    // 1. In Production (or Cloud mode), always use the Vercel / Cloud Menu URL
    if (isProduction || qrMode === 'cloud') {
      const targetVercel = (localStorage.getItem('resto_vercel_url') || vercelUrl || DEFAULT_VERCEL_URL).trim().replace(/\/+$/, '');
      return `${targetVercel}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
    }

    // 2. Capacitor APK fallback
    if (isCapacitorApp()) {
      const apiUrl = getApiUrl();
      const baseApiUrl = apiUrl.replace(/\/api$/, '');
      return `${baseApiUrl}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
    }

    // 3. Local Wi-Fi IP Mode (Development testing for mobile phones on local network)
    const storedIp = localStorage.getItem('resto_server_ip') || localIP;
    const isIpAddress = (h) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(h);

    let host = storedIp;
    if (!host || host === 'localhost' || host === '127.0.0.1') {
      host = isElectron ? '127.0.0.1' : (window.location.hostname || '127.0.0.1');
    }

    // Determine correct port for development testing:
    // When testing via Vite dev server, Vite serves the frontend on window.location.port (e.g. 5173)
    let port = '';
    if (isDev) {
      port = (window.location.port && window.location.port !== '80' && window.location.port !== '443') ? window.location.port : '5173';
    } else {
      port = isElectron ? '5002' : (localPort || '5002');
    }

    let baseUrl = '';
    if (host.includes('://')) {
      baseUrl = host;
    } else {
      const protocol = isIpAddress(host) ? 'http:' : (window.location.protocol || 'http:');
      const portPart = port ? `:${port}` : '';
      baseUrl = `${protocol}//${host}${portPart}`;
    }

    return `${baseUrl}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
  };

  const printQRCodes = () => {
    window.print();
  };

  const isLoopback = localIP === '127.0.0.1' || localIP === 'localhost';

  /**
   * Returns floors filtered/scoped to selectedTable.
   * - 'ALL'       → all floors with all tables
   * - specific    → single-floor, single-table entry (for the matching table)
   */
  const getFloorsToRender = () => {
    if (selectedTable === 'ALL') return floors;
    for (const floor of floors) {
      if (floor.tables.includes(selectedTable)) {
        return [{ floorName: floor.floorName, tables: [selectedTable] }];
      }
    }
    return [];
  };

  const floorsToRender = getFloorsToRender();
  const totalTablesCount = floors.reduce((s, f) => s + f.tables.length, 0);

  // Floor badge colours (cycling)
  const floorColors = [
    { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', dot: 'bg-primary' },
    { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
    { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-500' },
    { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
    { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-500' },
    { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-500' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-text-main flex items-center gap-2">
              <QrCode className="text-primary" size={22} />
              <span>{t("QR MENU GENERATOR")}</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-text-muted font-medium">
              {isProduction ? t("Production Cloud Menu QR Codes") : t("Customer Contactless Table Ordering")}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          {/* Table filter selector */}
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            disabled={isLoading}
            className="w-full sm:w-64 bg-surface border border-border rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary text-text-main font-medium shadow-xs disabled:opacity-60">
            {isLoading ? (
              <option value="ALL">{t("Fetching tables & statuses...")}</option>
            ) : (
              <>
                <option value="ALL">{t("All Tables")} ({totalTablesCount})</option>
                {floors.map((floor, fi) => (
                  <optgroup key={`floor-group-${fi}`} label={`📍 ${floor.floorName}`}>
                    {floor.tables.map((tbl, ti) => {
                      const statusInfo = getTableStatusInfo(floor.floorName, tbl);
                      return (
                        <option key={`${tbl}-${fi}-${ti}`} value={tbl}>
                          {tbl} ({statusInfo.isBusy ? `🔴 ${t("Busy")}${statusInfo.total ? ` · ₹${statusInfo.total}` : ''}` : `🟢 ${t("Empty")}`})
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </>
            )}
          </select>

          {/* Refresh live statuses button */}
          <button
            onClick={handleManualRefresh}
            disabled={isLoading || isRefreshing}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-hover border border-border text-text-main rounded-xl font-bold transition-all text-xs sm:text-sm shrink-0"
            title="Refresh table occupancy & status"
          >
            <RefreshCw size={15} className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{t("Sync Status")}</span>
          </button>

          {/* Print button */}
          <button
            onClick={printQRCodes}
            disabled={isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity text-xs sm:text-sm disabled:opacity-60 shrink-0">
            <Printer size={16} /> <span>{t("Print QRs")}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher: In Development show both tabs; in Production hide entirely */}
      {!isProduction && (
      <div className="bg-surface border border-border p-2 sm:p-2.5 rounded-2xl mb-3 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs shrink-0 print:hidden">
        <div className="flex items-center gap-1.5 p-1 bg-background rounded-xl border border-border/60 w-full sm:w-auto">
          {/* Cloud / Vercel Menu Button */}
          <button
            onClick={() => handleSelectQrMode('cloud')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              qrMode === 'cloud'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-text-main hover:bg-surface'
            }`}
          >
            <Globe size={14} /> {t("Cloud / Vercel Menu")} <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded-full uppercase font-mono">4G/5G/Online</span>
          </button>

          {/* Local Wi-Fi IP Button: Available ONLY in local development / testing, hidden in production */}
          {!isProduction && (
            <button
              onClick={() => handleSelectQrMode('wifi')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                qrMode === 'wifi'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              <Wifi size={14} /> {t("Local Wi-Fi IP")} <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded-full uppercase font-mono">Dev LAN</span>
            </button>
          )}
        </div>

        {/* Environment Badge - dev only */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-text-muted">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
            <Server size={13} /> {t("Dev Mode: Test Vercel & Local IP on Phone")}
          </span>
        </div>
      </div>
      )}

      {/* Cloud / Vercel URL Configuration Bar - Only shown in development */}
      {!isProduction && (qrMode === 'cloud' || isProduction) && (
        <div className="bg-surface border border-border p-3 sm:p-4 rounded-2xl mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Globe size={18} />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider">{t("Vercel Menu Domain / Cloud URL")}</div>
              <div className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5 flex-wrap">
                <span className="text-primary">{vercelUrl}</span>
                <span className="text-[8px] sm:text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase border border-blue-500/20">
                  {t("Active Online")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <input
              type="text"
              value={customVercelInput}
              onChange={(e) => setCustomVercelInput(e.target.value)}
              placeholder="e.g. https://restaurant-billing-seven.vercel.app"
              className="px-3 py-1.5 bg-background border border-border rounded-xl text-[11px] font-mono font-bold text-text-main w-full sm:w-64 focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => handleSaveVercelUrl(customVercelInput)}
              className="px-2.5 py-1.5 bg-primary text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 hover:opacity-90 shadow-xs"
            >
              <Save size={12} /> {t("Save URL")}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('resto_vercel_url');
                setVercelUrl(DEFAULT_VERCEL_URL);
                setCustomVercelInput(DEFAULT_VERCEL_URL);
                setVercelSavedToast(true);
                setTimeout(() => setVercelSavedToast(false), 2500);
              }}
              className="p-1.5 text-text-muted hover:text-text-main rounded-xl border border-border hover:bg-surface-hover shrink-0"
              title="Reset to default Vercel URL"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Local Wi-Fi IP Configuration Bar (Only in Development / Local mode) */}
      {!isProduction && qrMode === 'wifi' && (
        <div className="bg-surface border border-border p-3 sm:p-4 rounded-2xl mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 sm:p-2 rounded-xl ${isLoopback ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <Wifi size={18} />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider">{t("Development Wi-Fi IP Address")}</div>
              <div className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5 flex-wrap">
                <span>{localIP}:{isDev ? (window.location.port || '5173') : localPort}</span>
                {isLoopback ? (
                  <span className="text-[8px] sm:text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-500/20">
                    {t("Local Only (127.0.0.1)")}
                  </span>
                ) : (
                  <span className="text-[8px] sm:text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold uppercase border border-emerald-500/20">
                    {t("Wi-Fi Ready")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <input
              type="text"
              value={customIpInput}
              onChange={(e) => setCustomIpInput(e.target.value)}
              placeholder="e.g. 192.168.29.249"
              className="px-3 py-1.5 bg-background border border-border rounded-xl text-[11px] font-mono font-bold text-text-main w-full sm:w-44 focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => handleSaveCustomIp(customIpInput)}
              className="px-2.5 py-1.5 bg-primary text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 hover:opacity-90 shadow-xs"
            >
              <Save size={12} /> {t("Save IP")}
            </button>
            <button
              onClick={() => { localStorage.removeItem('resto_server_ip'); fetchIP(); }}
              className="p-1.5 text-text-muted hover:text-text-main rounded-xl border border-border hover:bg-surface-hover shrink-0"
              title="Auto-detect Wi-Fi IP"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Warning Alert if Loopback IP when in Wi-Fi mode in Development */}
      {!isProduction && qrMode === 'wifi' && isLoopback && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-3 py-2 sm:px-4 sm:py-3 rounded-2xl mb-4 text-[10px] sm:text-xs font-medium flex items-start gap-2 shrink-0 print:hidden">
          <AlertTriangle size={16} className="shrink-0 text-amber-500 mt-0.5" />
          <div>
            <span className="font-bold">{t("Localhost Notice:")}</span> {t("QR codes currently point to 127.0.0.1. Mobile phones cannot open localhost directly. Enter your computer's Wi-Fi IP address (e.g. 192.168.29.249) or switch to 'Cloud / Vercel Menu' mode above to test.")}
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {vercelSavedToast && (
        <div className="bg-blue-600 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl mb-4 text-center animate-fade-in shrink-0">
          ✓ {t("Vercel Menu Cloud URL updated successfully!")}
        </div>
      )}

      {ipSavedToast && (
        <div className="bg-emerald-500 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl mb-4 text-center animate-fade-in shrink-0">
          ✓ {t("Development Wi-Fi IP address updated successfully!")}
        </div>
      )}

      {/* DYNAMIC LOADING STATE: Displays until floors & empty/busy statuses are fully resolved */}
      {isLoading ? (
        <div className="flex-1 flex flex-col overflow-y-auto pr-1">
          {/* Dynamic Loading Status Banner */}
          <div className="bg-surface border border-primary/20 p-3 sm:p-4 rounded-2xl mb-4 flex items-center justify-between gap-3 shadow-xs animate-pulse shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <RefreshCw size={20} className="animate-spin text-primary" />
              </div>
              {!isProduction && (
                <div>
                  <div className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                    <span>{t("Dynamically fetching tables and occupancy status...")}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-text-muted">
                    {t("Checking live table availability (Empty / Busy) from POS database before rendering QR codes...")}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
              {!isProduction && <span>{t("Loading Data")}</span>}
            </div>
          </div>

          {/* Skeleton Section Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <div className="h-6 w-36 bg-surface-hover rounded-full animate-pulse border border-border"></div>
            </div>

            {/* Skeleton Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div
                  key={`skeleton-card-${n}`}
                  className="bg-surface border-2 border-dashed border-border p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-sm relative overflow-hidden"
                >
                  {/* Restaurant Name Skeleton */}
                  <div className="h-4 w-24 bg-surface-hover rounded-md animate-pulse"></div>

                  {/* Badge Row Skeleton */}
                  <div className="flex items-center gap-1.5 justify-center">
                    <div className="h-4 w-14 bg-surface-hover rounded-full animate-pulse"></div>
                    <div className="h-4 w-12 bg-surface-hover rounded-full animate-pulse"></div>
                    <div className="h-4 w-16 bg-surface-hover rounded-full animate-pulse"></div>
                  </div>

                  {/* QR Box Skeleton with dynamic scanning beam effect */}
                  <div className="w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] bg-slate-100 dark:bg-slate-800 rounded-xl relative overflow-hidden flex items-center justify-center shadow-inner">
                    <QrCode size={40} className="text-text-muted/30" />
                    {/* Animated scanning laser line */}
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan"></div>
                  </div>

                  {/* Text & Button Skeletons */}
                  <div className="w-full space-y-2">
                    <div className="h-3 w-20 mx-auto bg-surface-hover rounded animate-pulse"></div>
                    <div className="h-6 w-24 mx-auto bg-surface-hover rounded-md animate-pulse"></div>
                    <div className="h-6 w-full bg-surface-hover rounded-lg animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* LOADED STATE: Render QR Codes Grid grouped by Floor */
        <div className="flex-1 overflow-y-auto print:overflow-visible">
          {floorsToRender.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-surface rounded-2xl border border-border">
              <QrCode size={48} className="text-text-muted mb-3 opacity-40" />
              <h3 className="font-bold text-base text-text-main">{t("No tables found")}</h3>
              <p className="text-xs text-text-muted mt-1">{t("Please create floors and tables in Floor Management.")}</p>
            </div>
          ) : (
            floorsToRender.map((floor, floorIdx) => {
              const color = floorColors[floorIdx % floorColors.length];
              return (
                <div key={`floor-section-${floorIdx}`} className="mb-8 print:mb-6">
                  {/* Floor Section Header */}
                  <div className={`flex items-center gap-2.5 mb-3 pb-2 border-b border-border print:hidden`}>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${color.bg} ${color.border}`}>
                      <div className={`w-2 h-2 rounded-full ${color.dot}`}></div>
                      <Layers size={13} className={color.text} />
                      <span className={`text-xs font-black uppercase tracking-wider ${color.text}`}>
                        {floor.floorName}
                      </span>
                      <span className={`text-[10px] font-bold opacity-70 ${color.text}`}>
                        · {floor.tables.length} {floor.tables.length === 1 ? t('table') : t('tables')}
                      </span>
                    </div>
                  </div>

                  {/* Floor header for print */}
                  <div className="hidden print:block text-center font-black text-base uppercase tracking-widest mb-2 border-b border-black pb-1">
                    {floor.floorName}
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 print:grid-cols-3 print:gap-4">
                    {floor.tables.map((table, tableIdx) => {
                      const fullTableIdentifier = floor.floorName ? `${floor.floorName} - ${table}` : table;
                      const currentQrUrl = getQRUrl(fullTableIdentifier);
                      const isCopied = copiedTable === table;
                      return (
                        <div
                          key={`${floor.floorName}-${table}-${tableIdx}`}
                          className="bg-surface border-2 border-dashed border-border p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 sm:gap-3 break-inside-avoid print:border-black print:bg-white print:shadow-none shadow-sm hover:shadow-md hover:border-primary/40 transition-all relative group"
                        >
                          <h2 className="font-black text-sm sm:text-xl text-text-main uppercase tracking-wider">{restaurantName}</h2>

                          {/* Floor, Mode & Dynamic Status badges on card */}
                          <div className="flex items-center gap-1 flex-wrap justify-center print:hidden">
                            <div className={`text-[8px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${color.bg} ${color.text} ${color.border}`}>
                              {floor.floorName}
                            </div>
                            <div className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                              (isProduction || qrMode === 'cloud') ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            }`}>
                              {(isProduction || qrMode === 'cloud') ? 'Cloud' : 'Wi-Fi'}
                            </div>
                            {(() => {
                              const statusInfo = getTableStatusInfo(floor.floorName, table);
                              return statusInfo.isBusy ? (
                                <div className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                  <span>{t("Busy")}</span>
                                  {statusInfo.total > 0 && <span className="font-mono text-[7px] bg-rose-500/20 px-1 py-0.2 rounded font-bold">₹{statusInfo.total}</span>}
                                </div>
                              ) : (
                                <div className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>{t("Empty")}</span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* QR Code SVG */}
                          <div className="bg-white p-1.5 sm:p-2 rounded-xl shadow-inner">
                            <QRCodeSVG
                              value={currentQrUrl}
                              size={100}
                              level="H"
                              includeMargin={true}
                              className="sm:hidden"
                            />
                            <QRCodeSVG
                              value={currentQrUrl}
                              size={140}
                              level="H"
                              includeMargin={true}
                              className="hidden sm:block"
                            />
                          </div>

                          <div className="w-full">
                            <p className="text-[9px] sm:text-xs text-text-muted font-bold tracking-widest uppercase mb-0.5">{t("Scan to Order")}</p>
                            <h3 className="font-black text-lg sm:text-2xl text-primary">{table}</h3>
                            <div className="mt-1.5 flex items-center justify-between gap-1 text-[8px] sm:text-[10px] font-mono text-text-muted bg-background/80 px-2 py-1 rounded-lg border border-border/50 max-w-full print:hidden">
                              <span className="truncate">{currentQrUrl}</span>
                              <button
                                onClick={() => handleCopyMenuLink(currentQrUrl, table)}
                                className="text-text-muted hover:text-primary shrink-0 p-0.5"
                                title="Copy QR Order Link"
                              >
                                {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Print Styles & Laser Scan Keyframes */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 95%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
        .animate-scan {
          position: absolute;
          animation: scanLaser 2s infinite ease-in-out;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:overflow-visible, .print\\:overflow-visible * {
            visibility: visible;
          }
          .print\\:overflow-visible {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default QRCodeGenerator;