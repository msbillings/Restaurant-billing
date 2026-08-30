import { getApiUrl, isCapacitorApp } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Printer,
  Wifi,
  Save,
  RefreshCw,
  AlertTriangle,
  Layers,
  Globe,
  Copy,
  Check,
  Info,
  Server,
  ShieldCheck,
  ChevronDown,
  Download,
  Share2,
  X,
  Search,
  Filter,
  CheckCircle2
} from 'lucide-react';
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

  const normA = spaceA.replace(/[^a-z0-9]/g, '');
  const normB = spaceB.replace(/[^a-z0-9]/g, '');
  if (normA && normB && normA === normB) return true;

  const stdMatchA = spaceA.match(/^(table|cabin|sofa|room|bar)\s*0*(\d+)$/i);
  const stdMatchB = spaceB.match(/^(table|cabin|sofa|room|bar)\s*0*(\d+)$/i);

  if (stdMatchA && stdMatchB) {
    const typeA = stdMatchA[1];
    const typeB = stdMatchB[1];
    const numA = parseInt(stdMatchA[2], 10);
    const numB = parseInt(stdMatchB[2], 10);
    return typeA === typeB && numA === numB;
  }

  if (stdMatchA && !stdMatchB) {
    const letterA = stdMatchA[1].charAt(0);
    const numA = parseInt(stdMatchA[2], 10);
    const shortB = spaceB.match(/^([a-z]+)-?0*(\d+)$/);
    if (shortB && shortB[1] === letterA && parseInt(shortB[2], 10) === numA) return true;
  } else if (!stdMatchA && stdMatchB) {
    const letterB = stdMatchB[1].charAt(0);
    const numB = parseInt(stdMatchB[2], 10);
    const shortA = spaceA.match(/^([a-z]+)-?0*(\d+)$/);
    if (shortA && shortA[1] === letterB && parseInt(shortA[2], 10) === numB) return true;
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

  // Custom Table Filter Modal state
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  // Mobile Print & Share Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessToast, setExportSuccessToast] = useState(null);

  // Detect Capacitor native mobile app (.apk / .ipa)
  const isCapacitor = typeof window !== 'undefined' && Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    window.location.href.includes('capacitor://') ||
    (window.location.hostname === 'localhost' && !window.location.port)
  );

  // Detect Electron (file: protocol or electron userAgent)
  const isElectron = typeof window !== 'undefined' && (
    window.location.protocol === 'file:' ||
    (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) ||
    Boolean(window.electronAPI)
  );

  // Detect active Vite dev server (npm run dev on local port 5173/3000)
  const isDevPort = typeof window !== 'undefined' && ['5173', '5174', '5175', '3000'].includes(window.location.port);

  // Show Dev Mode switcher ONLY in active browser localhost development (npm run dev)
  const isDevMode = Boolean(import.meta.env.DEV && isDevPort && !isCapacitor && !isElectron);

  // Production mode detection
  const isProduction = !isDevMode;

  // QR Mode: Allow dynamic switching between 'cloud' (Vercel URL) and 'wifi' (Local IP) across all environments
  const [qrMode, setQrMode] = useState(() => {
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
        if (data.port && !isDevMode) {
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

    // Dynamic Shop-to-Shop Settings Fetch
    try {
      const API_BASE_URL = getApiUrl();
      const tenantDb = localStorage.getItem('resto_db_name') || '';
      if (tenantDb) {
        const res = await fetch(`${API_BASE_URL}/config/info`, {
          headers: { 'X-Tenant-DB': tenantDb }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.restaurantSettings) {
            const s = data.restaurantSettings;
            if (s.restaurantName) setRestaurantName(s.restaurantName);
            if (s.vercelUrl) {
              setVercelUrl(s.vercelUrl);
              setCustomVercelInput(s.vercelUrl);
              localStorage.setItem('resto_vercel_url', s.vercelUrl);
            }
            if (s.serverIp) {
              setLocalIP(s.serverIp);
              setCustomIpInput(s.serverIp);
              localStorage.setItem('resto_server_ip', s.serverIp);
            }
            if (s.qrMenuMode) {
              setQrMode(s.qrMenuMode);
              localStorage.setItem('resto_qr_mode', s.qrMenuMode);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote settings for QR page:", err);
    }

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

  const syncSettingsToBackend = async (partialSettings) => {
    try {
      const API_BASE_URL = getApiUrl();
      const tenantDb = localStorage.getItem('resto_db_name') || '';
      const token = localStorage.getItem('accessToken') || '';
      if (tenantDb) {
        await fetch(`${API_BASE_URL}/config/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-DB': tenantDb,
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ restaurantSettings: partialSettings })
        });
      }
    } catch (e) {
      console.warn("Could not sync settings to backend:", e);
    }
  };

  const handleSaveCustomIp = (ipToSave) => {
    let cleanIp = ipToSave.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
    if (cleanIp) {
      localStorage.setItem('resto_server_ip', cleanIp);
      setLocalIP(cleanIp);
      setCustomIpInput(cleanIp);
      syncSettingsToBackend({ serverIp: cleanIp });
    } else {
      localStorage.removeItem('resto_server_ip');
      setLocalIP(window.location.hostname);
      setCustomIpInput('');
      syncSettingsToBackend({ serverIp: '' });
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
      syncSettingsToBackend({ vercelUrl: cleanUrl });
    } else {
      localStorage.removeItem('resto_vercel_url');
      setVercelUrl(DEFAULT_VERCEL_URL);
      setCustomVercelInput(DEFAULT_VERCEL_URL);
      syncSettingsToBackend({ vercelUrl: DEFAULT_VERCEL_URL });
    }
    setVercelSavedToast(true);
    setTimeout(() => setVercelSavedToast(false), 2500);
  };

  const handleSelectQrMode = (mode) => {
    setQrMode(mode);
    localStorage.setItem('resto_qr_mode', mode);
    syncSettingsToBackend({ qrMenuMode: mode });
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

    // 1. Cloud / Vercel Menu URL
    if (qrMode === 'cloud') {
      const targetVercel = (vercelUrl || localStorage.getItem('resto_vercel_url') || DEFAULT_VERCEL_URL).trim().replace(/\/+$/, '');
      return `${targetVercel}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
    }

    // 2. Local Wi-Fi IP Mode
    const storedIp = localStorage.getItem('resto_server_ip') || localIP;
    let host = storedIp;
    if (!host || host === 'localhost' || host === '127.0.0.1') {
      host = isElectron ? '127.0.0.1' : (window.location.hostname || '127.0.0.1');
    }
    host = host.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');

    let port = '';
    if (isDevMode) {
      port = (window.location.port && window.location.port !== '80' && window.location.port !== '443') ? window.location.port : '5173';
    } else {
      port = isElectron ? '5002' : (localPort || '5002');
    }

    const portPart = port && port !== '80' && port !== '443' ? `:${port}` : '';
    return `http://${host}${portPart}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
  };

  const handlePrintClick = () => {
    if (isCapacitor || (typeof window !== 'undefined' && window.innerWidth < 768)) {
      setIsExportModalOpen(true);
    } else {
      handleSystemPrint();
    }
  };

  const handleSystemPrint = () => {
    setIsExportModalOpen(false);
    setTimeout(() => {
      if (window.electronAPI) {
        const area = document.getElementById('qr-cards-container');
        if (area) {
          window.electronAPI.silentPrint(area.outerHTML, '', false);
        }
      } else if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
        window.AndroidPrint.print();
      } else {
        window.print();
      }
    }, 300);
  };

  const downloadSingleQRCard = async (tableIdentifier, cardElementId) => {
    try {
      setIsExporting(true);
      const element = document.getElementById(cardElementId);
      if (!element) return;
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, allowTaint: true, scrollY: 0, scrollX: 0, backgroundColor: '#ffffff' });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${restaurantName}_QR_${tableIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `${restaurantName} - ${tableIdentifier} Menu QR`,
              text: `Scan to order from ${restaurantName} (${tableIdentifier})`,
              files: [file]
            });
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
          }
        }

        const link = document.createElement('a');
        link.download = `${restaurantName}_QR_${tableIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        setExportSuccessToast(t("QR Image saved!"));
        setTimeout(() => setExportSuccessToast(null), 2500);
      }, 'image/png');
    } catch (err) {
      console.error('Download QR failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const shareSingleQRCard = async (tableIdentifier, cardElementId) => {
    try {
      setIsExporting(true);
      const element = document.getElementById(cardElementId) || document.getElementById('qr-cards-container');
      if (!element) return;
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(element, { scale: 2.5, useCORS: true, allowTaint: true, scrollY: 0, scrollX: 0, backgroundColor: '#ffffff' });

      canvas.toBlob(async (blob) => {
        const qrUrl = getQRUrl(tableIdentifier || selectedTable !== 'ALL' ? selectedTable : '');
        if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'QR.png', { type: 'image/png' })] })) {
          const file = new File([blob], `${restaurantName}_QR_${(tableIdentifier || 'Menu').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`, { type: 'image/png' });
          try {
            await navigator.share({
              title: `${restaurantName} - ${tableIdentifier || 'Table'} Menu QR`,
              text: `Scan or click to order from ${restaurantName}: ${qrUrl}`,
              files: [file]
            });
            setIsExportModalOpen(false);
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') {
              setIsExportModalOpen(false);
              return;
            }
          }
        }

        // Direct WhatsApp / Web share link fallback
        const shareText = encodeURIComponent(`*${restaurantName} QR Menu Order*\nTable: ${tableIdentifier || 'All Tables'}\n\n👉 Click to view menu & place order:\n${qrUrl}`);
        window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
        setIsExportModalOpen(false);
        setExportSuccessToast(t("Shared via WhatsApp!"));
        setTimeout(() => setExportSuccessToast(null), 2500);
      }, 'image/png');
    } catch (err) {
      console.error('Share QR failed:', err);
      const qrUrl = getQRUrl(tableIdentifier || '');
      const shareText = encodeURIComponent(`*${restaurantName} QR Menu Order*\n\n👉 Click to view menu & place order:\n${qrUrl}`);
      window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
      setIsExportModalOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadAllQRsContainer = async () => {
    try {
      setIsExporting(true);
      const container = document.getElementById('qr-cards-container');
      if (!container) return;
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, allowTaint: true, scrollY: 0, scrollX: 0, backgroundColor: '#ffffff' });
      
      canvas.toBlob(async (blob) => {
        if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'QRCodes.png', { type: 'image/png' })] })) {
          const file = new File([blob], `${restaurantName}_All_Table_QRs.png`, { type: 'image/png' });
          try {
            await navigator.share({
              title: `${restaurantName} All QR Codes`,
              text: `QR Menu Cards for ${restaurantName}`,
              files: [file]
            });
            setIsExportModalOpen(false);
            return;
          } catch (e) {
            if (e.name === 'AbortError') {
              setIsExportModalOpen(false);
              return;
            }
          }
        }

        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${restaurantName}_All_Table_QRs.png`;
        link.href = imgData;
        link.click();
        setIsExportModalOpen(false);
        setExportSuccessToast(t("All QR Codes exported successfully!"));
        setTimeout(() => setExportSuccessToast(null), 2500);
      }, 'image/png');
    } catch (err) {
      console.error('Download all QRs failed:', err);
    } finally {
      setIsExporting(false);
    }
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
    <div className="h-full flex flex-col p-1.5 sm:p-2.5 md:p-3 overflow-hidden">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 sm:mb-2.5 gap-2.5 shrink-0">
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

        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Custom Table Filter Trigger Button */}
          <button
            type="button"
            onClick={() => setIsTableModalOpen(true)}
            disabled={isLoading}
            className="flex-1 sm:w-64 min-w-0 bg-surface border border-border hover:border-primary/50 rounded-xl px-3 py-2 text-xs sm:text-sm text-text-main font-medium shadow-xs disabled:opacity-60 flex items-center justify-between gap-2 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Layers size={14} className="text-primary shrink-0" />
              <span className="truncate">
                {isLoading
                  ? t("Fetching tables...")
                  : selectedTable === 'ALL'
                    ? `${t("All Tables")} (${totalTablesCount})`
                    : selectedTable}
              </span>
            </div>
            <ChevronDown size={14} className="text-text-muted shrink-0" />
          </button>

          {/* Refresh live statuses button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoading || isRefreshing}
            className="p-2 sm:px-3 sm:py-2 bg-surface hover:bg-surface-hover border border-border text-text-main rounded-xl font-bold transition-all text-xs sm:text-sm shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            title={t("Refresh table occupancy & status")}
          >
            <RefreshCw size={16} className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{t("Sync Status")}</span>
          </button>

          {/* Print / Export Button (works seamlessly on APK mobile and desktop) */}
          <button
            type="button"
            onClick={handlePrintClick}
            disabled={isLoading || isExporting}
            className="p-2 sm:px-4 sm:py-2 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity text-xs sm:text-sm disabled:opacity-60 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            title={isCapacitor ? t("Print / Save QRs") : t("Print QRs")}
          >
            {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <Printer size={16} />}
            <span className="hidden sm:inline">{isCapacitor ? t("Print / Save") : t("Print QRs")}</span>
          </button>
        </div>
      </div>

      {/* Dev Mode Only: Mode Switcher and URL/IP Configuration Bars (Hidden in Production) */}
      {!isProduction && (
        <>
          {/* Mode Switcher: Toggle between Cloud (Vercel) and Local Wi-Fi (IP) */}
          <div className="bg-surface border border-border p-2 sm:p-2.5 rounded-2xl mb-3 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs shrink-0 print:hidden">
            <div className="flex items-center gap-1.5 p-1 bg-background rounded-xl border border-border/60 w-full sm:w-auto">
              {/* Cloud / Vercel Menu Button */}
              <button
                onClick={() => handleSelectQrMode('cloud')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${qrMode === 'cloud'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                  }`}
              >
                <Globe size={14} /> {t("Cloud / Vercel Menu")} <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded-full uppercase font-mono">4G/5G/Online</span>
              </button>

              {/* Local Wi-Fi IP Button */}
              <button
                onClick={() => handleSelectQrMode('wifi')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${qrMode === 'wifi'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                  }`}
              >
                <Wifi size={14} /> {t("Local Wi-Fi IP")} <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded-full uppercase font-mono">LAN Mode</span>
              </button>
            </div>

            {/* Dynamic Shop Network Indicator */}
            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-text-muted">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                <Server size={13} /> {qrMode === 'cloud' ? t("Routing via Cloud Domain") : t("Routing via Local Wi-Fi IP")}
              </span>
            </div>
          </div>

          {/* Cloud / Vercel URL Configuration Bar */}
          {qrMode === 'cloud' && (
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
                  className="px-2.5 py-1.5 bg-primary text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 hover:opacity-90 shadow-xs cursor-pointer"
                >
                  <Save size={12} /> {t("Save URL")}
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('resto_vercel_url');
                    setVercelUrl(DEFAULT_VERCEL_URL);
                    setCustomVercelInput(DEFAULT_VERCEL_URL);
                    handleSaveVercelUrl(DEFAULT_VERCEL_URL);
                  }}
                  className="p-1.5 text-text-muted hover:text-text-main rounded-xl border border-border hover:bg-surface-hover shrink-0 cursor-pointer"
                  title="Reset to default Vercel URL"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Local Wi-Fi IP Configuration Bar */}
          {qrMode === 'wifi' && (
            <div className="bg-surface border border-border p-3 sm:p-4 rounded-2xl mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs shrink-0 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 sm:p-2 rounded-xl ${isLoopback ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  <Wifi size={18} />
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider">{t("Development / Local Wi-Fi IP Address")}</div>
                  <div className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5 flex-wrap">
                    <span>{localIP}:{isDevMode ? (window.location.port || '5173') : localPort}</span>
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
                  className="px-2.5 py-1.5 bg-primary text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0 hover:opacity-90 shadow-xs cursor-pointer"
                >
                  <Save size={12} /> {t("Save IP")}
                </button>
                <button
                  onClick={() => { localStorage.removeItem('resto_server_ip'); fetchIP(); }}
                  className="p-1.5 text-text-muted hover:text-text-main rounded-xl border border-border hover:bg-surface-hover shrink-0 cursor-pointer"
                  title="Auto-detect Wi-Fi IP"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Warning Alert if Loopback IP when in Wi-Fi mode in Development */}
          {qrMode === 'wifi' && isLoopback && (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-3 py-2 sm:px-4 sm:py-3 rounded-2xl mb-4 text-[10px] sm:text-xs font-medium flex items-start gap-2 shrink-0 print:hidden">
              <AlertTriangle size={16} className="shrink-0 text-amber-500 mt-0.5" />
              <div>
                <span className="font-bold">{t("Localhost Notice:")}</span> {t("QR codes currently point to 127.0.0.1. Mobile phones cannot open localhost directly. Enter your computer's Wi-Fi IP address (e.g. 192.168.29.249) or switch to 'Cloud / Vercel Menu' mode above to test.")}
              </div>
            </div>
          )}
        </>
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
        <div id="qr-cards-container" className="flex-1 overflow-y-auto qr-print-container">
          {exportSuccessToast && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl mb-3 text-center animate-fade-in shadow-md shrink-0 flex items-center justify-center gap-2 print:hidden">
              <CheckCircle2 size={16} />
              <span>{exportSuccessToast}</span>
            </div>
          )}

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
                <div key={`floor-section-${floorIdx}`} className="mb-8 qr-floor-block">
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
                  <div className="hidden print:block qr-floor-header">
                    {floor.floorName}
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 qr-print-grid">
                    {floor.tables.map((table, tableIdx) => {
                      const fullTableIdentifier = floor.floorName ? `${floor.floorName} - ${table}` : table;
                      const cardElementId = `qr-card-${floor.floorName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${table.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                      const currentQrUrl = getQRUrl(fullTableIdentifier);
                      const isCopied = copiedTable === table;
                      return (
                        <div
                          id={cardElementId}
                          key={`${floor.floorName}-${table}-${tableIdx}`}
                          className="bg-surface border-2 border-dashed border-border p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 sm:gap-3 qr-print-card shadow-sm hover:shadow-md transition-all relative group"
                        >
                          <h2 className="font-black text-sm sm:text-xl text-text-main uppercase tracking-wider">{restaurantName}</h2>

                          {/* Floor, Mode & Dynamic Status badges on card */}
                          <div className="flex items-center gap-1 flex-wrap justify-center print:hidden">
                            <div className={`text-[8px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${color.bg} ${color.text} ${color.border}`}>
                              {floor.floorName}
                            </div>
                            <div className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${(isProduction || qrMode === 'cloud') ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
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
                              <span className="truncate flex-1 text-left">{currentQrUrl}</span>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopyMenuLink(currentQrUrl, table)}
                                  className="text-text-muted hover:text-primary p-1 rounded transition-colors"
                                  title={t("Copy Link")}
                                >
                                  {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => shareSingleQRCard(fullTableIdentifier, cardElementId)}
                                  className="text-text-muted hover:text-primary p-1 rounded transition-colors"
                                  title={t("Share QR via WhatsApp / Apps")}
                                >
                                  <Share2 size={13} />
                                </button>
                              </div>
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

      {/* CUSTOM TABLE FILTER MODAL WITH EXPLICIT CANCEL BUTTON */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          {/* Backdrop dismiss */}
          <div className="fixed inset-0" onClick={() => setIsTableModalOpen(false)} />

          <div className="relative bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <QrCode size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-main">{t("Select Table Filter")}</h3>
                  <p className="text-[11px] text-text-muted">{t("Filter QR codes by table or floor")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="p-2 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
                title={t("Close")}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-border/60 bg-background/50 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={tableSearchTerm}
                  onChange={(e) => setTableSearchTerm(e.target.value)}
                  placeholder={t("Search tables or floors...")}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-xl text-xs font-medium text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
                />
              </div>
            </div>

            {/* Table Options List */}
            <div className="overflow-y-auto flex-1 p-3 space-y-3 custom-scrollbar">
              {/* All Tables Option */}
              {(!tableSearchTerm || 'all tables'.includes(tableSearchTerm.toLowerCase())) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTable('ALL');
                    setIsTableModalOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${selectedTable === 'ALL'
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                      : 'bg-surface border-border hover:bg-surface-hover text-text-main font-medium'
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🏢</span>
                    <span className="text-xs sm:text-sm">{t("All Tables")}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover text-text-muted font-bold border border-border">
                      {totalTablesCount}
                    </span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedTable === 'ALL' ? 'border-primary bg-primary text-white' : 'border-text-muted/40'
                    }`}>
                    {selectedTable === 'ALL' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              )}

              {/* Floor Groups and Tables */}
              {floors.map((floor, fi) => {
                const matchingTables = floor.tables.filter((tbl) =>
                  !tableSearchTerm ||
                  tbl.toLowerCase().includes(tableSearchTerm.toLowerCase()) ||
                  floor.floorName.toLowerCase().includes(tableSearchTerm.toLowerCase())
                );

                if (matchingTables.length === 0) return null;

                return (
                  <div key={`modal-floor-${fi}`} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      <span>📍</span>
                      <span>{floor.floorName}</span>
                      <span className="text-[10px] opacity-70">({matchingTables.length})</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {matchingTables.map((tbl, ti) => {
                        const statusInfo = getTableStatusInfo(floor.floorName, tbl);
                        const isSelected = selectedTable === tbl;

                        return (
                          <button
                            key={`modal-tbl-${tbl}-${fi}-${ti}`}
                            type="button"
                            onClick={() => {
                              setSelectedTable(tbl);
                              setIsTableModalOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected
                                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                                : 'bg-surface border-border hover:bg-surface-hover text-text-main font-medium'
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm">{tbl}</span>
                              {statusInfo.isBusy ? (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-bold border border-rose-500/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                  {t("Busy")} {statusInfo.total ? `· ₹${statusInfo.total}` : ''}
                                </span>
                              ) : (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {t("Empty")}
                                </span>
                              )}
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary text-white' : 'border-text-muted/40'
                              }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer with Explicit CANCEL and Apply Buttons */}
            <div className="p-3 border-t border-border flex items-center justify-between gap-2 bg-surface shrink-0">
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="flex-1 py-2 px-4 rounded-xl border border-border text-text-main hover:bg-surface-hover font-bold text-xs sm:text-sm transition-colors cursor-pointer text-center"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="flex-1 py-2 px-4 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm shadow-xs hover:opacity-90 transition-opacity cursor-pointer text-center"
              >
                {t("Done")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT & EXPORT SHEET MODAL FOR MOBILE / APK */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setIsExportModalOpen(false)} />
          <div className="relative bg-surface border border-border rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col p-4 space-y-3 z-10">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Printer className="text-primary" size={20} />
                <h3 className="text-base font-bold text-text-main">{t("Print & Share QR Codes")}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              {t("Choose how you would like to print or share the table QR codes on your device:")}
            </p>

            <div className="space-y-2 pt-1">
              {/* Option 1: Share Sheet */}
              <button
                type="button"
                onClick={() => {
                  const firstTable = selectedTable !== 'ALL' ? selectedTable : (floors[0]?.tables[0] || 'All Tables');
                  const firstFloor = floors[0]?.floorName || '';
                  const cardId = selectedTable !== 'ALL' && firstFloor ? `qr-card-${firstFloor.replace(/[^a-zA-Z0-9_-]/g, '_')}-${firstTable.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
                  shareSingleQRCard(firstTable, cardId);
                }}
                disabled={isExporting}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border hover:border-primary/50 hover:bg-surface-hover text-left transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Share2 size={18} />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-text-main">{t("Share via WhatsApp / Apps")}</div>
                  <div className="text-[10px] text-text-muted">{t("Send QR cards directly to printer app or WhatsApp")}</div>
                </div>
              </button>

              {/* Option 2: System Print Dialog */}
              <button
                type="button"
                onClick={handleSystemPrint}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border hover:border-primary/50 hover:bg-surface-hover text-left transition-all cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                  <Printer size={18} />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-text-main">{t("Print via System Dialog")}</div>
                  <div className="text-[10px] text-text-muted">{t("Open standard print / PDF preview")}</div>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="w-full py-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-xs font-bold text-text-main transition-colors cursor-pointer"
              >
                {t("Cancel")}
              </button>
            </div>
          </div>
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
          @page {
            size: A4 portrait;
            margin: 8mm 6mm !important;
          }

          html, body {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: visible !important;
          }

          #root, main, .h-full, .overflow-hidden, .overflow-y-auto {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Hide application UI elements */
          header, nav, aside, footer, .print\\:hidden, [role="dialog"], button, input, select {
            display: none !important;
            visibility: hidden !important;
          }

          /* Multi-page QR Print Flow Container */
          .qr-print-container {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .qr-print-container * {
            visibility: visible !important;
          }

          .qr-floor-block {
            display: block !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
            margin-bottom: 16px !important;
          }

          .qr-floor-header {
            display: block !important;
            text-align: center !important;
            font-size: 13pt !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            letter-spacing: 2px !important;
            padding: 4px 0 !important;
            margin-bottom: 12px !important;
            border-bottom: 2px solid #000000 !important;
            color: #000000 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .qr-print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
            width: 100% !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          .qr-print-card {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            border: 1.5px dashed #000000 !important;
            border-radius: 12px !important;
            padding: 10px 8px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 6px !important;
          }

          .qr-print-card h2 {
            font-size: 10.5pt !important;
            font-weight: 900 !important;
            color: #000000 !important;
            margin-bottom: 4px !important;
            text-transform: uppercase !important;
          }

          .qr-print-card h3 {
            font-size: 14pt !important;
            font-weight: 900 !important;
            color: #000000 !important;
            margin: 2px 0 !important;
          }

          .qr-print-card svg {
            display: block !important;
            margin: 0 auto !important;
            width: 110px !important;
            height: 110px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default QRCodeGenerator;