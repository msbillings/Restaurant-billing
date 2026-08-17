import { getApiUrl, isCapacitorApp } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { QrCode, Printer, Wifi, Save, RefreshCw, AlertTriangle, Layers } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/axios';
import BackButton from './common/BackButton';

const QRCodeGenerator = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();

  // floors = [{ floorName: string, tables: string[] }]
  const [floors, setFloors] = useState([]);
  const [selectedTable, setSelectedTable] = useState('ALL');
  const [restaurantName, setRestaurantName] = useState('MSBillings');

  // Detect Electron (file: protocol)
  const isElectron = window.location.protocol === 'file:';

  // Initial IP setup from stored resto_server_ip or hostname
  const storedIp = localStorage.getItem('resto_server_ip');
  const [localIP, setLocalIP] = useState(storedIp || (isElectron ? '127.0.0.1' : window.location.hostname));
  const [localPort, setLocalPort] = useState(isElectron ? '5002' : (window.location.port && window.location.port !== '5173' ? window.location.port : '5002'));
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
    // If we are hosted on a public cloud domain, don't auto-fetch the backend's internal Docker IP
    if (!isElectron && window.location.hostname && !window.location.hostname.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) && window.location.hostname !== 'localhost') {
       return;
    }

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
        if (data.port) {
          setLocalPort(String(data.port));
        }
      }
    } catch (err) {
      if (!isElectron && window.location.hostname !== 'localhost') {
        setLocalIP(window.location.hostname);
        setLocalPort(window.location.port && window.location.port !== '5173' ? window.location.port : '5002');
      }
      console.warn('Could not fetch system IP, using hostname fallback:', err);
    }
  };

  useEffect(() => {
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

      // Fallback: single floor with demo tables
      setFloors(extracted.length > 0 ? extracted : [{ floorName: 'Floor 1', tables: ['Table 1', 'Table 2', 'Table 3'] }]);

      try {
        const settings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
        if (settings.restaurantName) setRestaurantName(settings.restaurantName);
      } catch (error) {
        console.error('Error loading settings for QRs:', error);
      }
    };

    fetchFloorsAndSettings();

    const handleSpacesUpdated = (event) => {
      if (event.detail && Array.isArray(event.detail)) {
        const updated = extractFloorSpaces(event.detail);
        if (updated.length > 0) setFloors(updated);
      }
    };
    window.addEventListener('spacesUpdated', handleSpacesUpdated);

    fetchIP();

    return () => {
      window.removeEventListener('spacesUpdated', handleSpacesUpdated);
    };
  }, []);

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

  const getQRUrl = (table) => {
    const dbName = localStorage.getItem('resto_db_name') || 'default';

    // 1. If running inside native mobile app (Capacitor APK)
    if (isCapacitorApp()) {
      const apiUrl = getApiUrl(); // e.g. http://192.168.1.15:5002/api or https://domain/api
      const baseApiUrl = apiUrl.replace(/\/api$/, '');
      return `${baseApiUrl}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
    }

    const storedIp = localStorage.getItem('resto_server_ip') || localIP;
    const isIpAddress = (h) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(h);
    const isLocalNetwork = (h) => h === 'localhost' || h === '127.0.0.1' || isIpAddress(h);

    // If we have an explicit stored IP (from the UI), we MUST use it!
    // This allows an Admin on Vercel to generate QR codes pointing to their Local POS IP.
    if (storedIp && storedIp !== 'localhost' && storedIp !== '127.0.0.1') {
      const port = isElectron ? '5002' : (isIpAddress(storedIp) ? '10000' : ''); 
      const portStr = port ? `:${port}` : '';
      const protocol = isIpAddress(storedIp) ? 'http:' : 'https:';
      return `${protocol}//${storedIp}${portStr}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
    }

    // 2. If hosted on a public cloud domain (Vercel, Render, custom domain) without a stored IP
    if (!isElectron && window.location.hostname && !isLocalNetwork(window.location.hostname)) {
      return `${window.location.origin}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
    }

    // 3. Desktop App (.exe/.dmg) or Local Development
    let host = storedIp;
    if (!host || host === 'localhost' || host === '127.0.0.1') {
      host = isElectron ? '127.0.0.1' : (window.location.hostname || '127.0.0.1');
    }

    const isDev = import.meta.env.DEV || window.location.port === '5173' || window.location.port === '5174' || window.location.port === '5175';
    let port = '';

    if (isDev) {
      port = window.location.port || '5173';
    } else {
      // In production built .exe/.dmg, the backend ALWAYS runs on 5002/10000 and serves the frontend
      port = isElectron ? '5002' : '10000';
    }

    let baseUrl = '';
    if (host.includes('://')) {
      baseUrl = host;
    } else {
      // Force HTTP for IP addresses to prevent SSL errors
      const protocol = isIpAddress(host) ? 'http:' : window.location.protocol;
      baseUrl = `${protocol}//${host}:${port}`;
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
    // Find the floor + table matching the selection
    for (const floor of floors) {
      if (floor.tables.includes(selectedTable)) {
        return [{ floorName: floor.floorName, tables: [selectedTable] }];
      }
    }
    return [];
  };

  const floorsToRender = getFloorsToRender();

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
    <div className="h-full flex flex-col bg-background px-2.5 py-4 sm:p-6 overflow-hidden">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <h1 className="text-lg sm:text-2xl font-black text-text-main flex items-center gap-2">
            <QrCode className="text-primary" size={20} />{t("QR MENU GENERATOR")}
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          {/* Floor-grouped dropdown */}
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full sm:w-56 bg-surface border border-border rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary text-text-main">
            <option value="ALL">{t("All Tables")} ({floors.reduce((s, f) => s + f.tables.length, 0)})</option>
            {floors.map((floor, fi) => (
              <optgroup key={`floor-group-${fi}`} label={`📍 ${floor.floorName}`}>
                {floor.tables.map((tbl, ti) => (
                  <option key={`${tbl}-${fi}-${ti}`} value={tbl}>{tbl}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={printQRCodes}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity text-xs sm:text-sm">
            <Printer size={16} /> <span>{t("Print QRs")}</span>
          </button>
        </div>
      </div>

      {/* Local Wi-Fi IP Configuration Bar */}
      <div className="bg-surface border border-border p-3 sm:p-4 rounded-2xl mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs shrink-0 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 sm:p-2 rounded-xl ${isLoopback ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
            <Wifi size={18} />
          </div>
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider">{t("POS Wi-Fi IP Address")}</div>
            <div className="text-xs sm:text-sm font-black text-text-main flex items-center gap-1.5 flex-wrap">
              <span>{localIP}:{localPort}</span>
              {isLoopback && (
                <span className="text-[8px] sm:text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase border border-amber-500/20">
                  Local Only
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
            placeholder="e.g. 192.168.29.79"
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

      {/* Warning Alert if Loopback IP */}
      {isLoopback && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-3 py-2 sm:px-4 sm:py-3 rounded-2xl mb-4 text-[10px] sm:text-xs font-medium flex items-start gap-2 shrink-0 print:hidden">
          <AlertTriangle size={16} className="shrink-0 text-amber-500 mt-0.5" />
          <div>
            <span className="font-bold">{t("Important Network Notice:")}</span> {t("QR codes currently point to 127.0.0.1. Mobile phones cannot open this. Enter your Billing PC's Wi-Fi IP address above (e.g. 192.168.29.79).")}
          </div>
        </div>
      )}

      {ipSavedToast && (
        <div className="bg-emerald-500 text-white text-[10px] sm:text-xs font-bold px-4 py-2 rounded-xl mb-4 text-center animate-fade-in shrink-0">
          ✓ {t("POS Wi-Fi IP address updated successfully!")}
        </div>
      )}

      {/* QR Codes Grid — grouped by floor */}
      <div className="flex-1 overflow-y-auto print:overflow-visible">
        {floorsToRender.map((floor, floorIdx) => {
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
                {floor.tables.map((table, tableIdx) => (
                  <div
                    key={`${floor.floorName}-${table}-${tableIdx}`}
                    className="bg-surface border-2 border-dashed border-border p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 sm:gap-3 break-inside-avoid print:border-black print:bg-white print:shadow-none shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
                  >
                    <h2 className="font-black text-sm sm:text-xl text-text-main uppercase tracking-wider">{restaurantName}</h2>

                    {/* Floor badge on card */}
                    <div className={`text-[8px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border print:hidden ${color.bg} ${color.text} ${color.border}`}>
                      {floor.floorName}
                    </div>

                    <div className="bg-white p-1.5 sm:p-2 rounded-xl shadow-inner">
                      <QRCodeSVG
                        value={getQRUrl(table)}
                        size={100}
                        level="H"
                        includeMargin={true}
                        className="sm:hidden"
                      />
                      <QRCodeSVG
                        value={getQRUrl(table)}
                        size={140}
                        level="H"
                        includeMargin={true}
                        className="hidden sm:block"
                      />
                    </div>
                    <div className="w-full">
                      <p className="text-[9px] sm:text-xs text-text-muted font-bold tracking-widest uppercase mb-0.5">{t("Scan to Order")}</p>
                      <h3 className="font-black text-lg sm:text-2xl text-primary">{table}</h3>
                      <div className="mt-1.5 text-[8px] sm:text-[10px] font-mono text-text-muted bg-background/80 px-2 py-1 rounded-lg break-all border border-border/50 max-w-full truncate print:hidden">
                        {getQRUrl(table)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Print Styles */}
      <style>{`
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