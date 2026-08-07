import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { QrCode, Printer, Wifi, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/axios';
import BackButton from './common/BackButton';

const QRCodeGenerator = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [tables, setTables] = useState([]);
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

  const extractAllSpaces = (floorsList) => {
    const tableNames = new Set();
    if (Array.isArray(floorsList)) {
      floorsList.forEach((floor) => {
        if (!floor) return;
        Object.keys(floor).forEach((key) => {
          if (Array.isArray(floor[key])) {
            floor[key].forEach((item) => {
              if (item && item.name) {
                tableNames.add(item.name);
              }
            });
          }
        });
      });
    }
    return Array.from(tableNames);
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
          extracted = extractAllSpaces(response.data);
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
            extracted = extractAllSpaces(parsed);
          }
        } catch (e) {
          console.error('Error parsing local spaces:', e);
        }
      }

      setTables(extracted.length > 0 ? extracted : ['Table 1', 'Table 2', 'Table 3']);

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
        const updated = extractAllSpaces(event.detail);
        if (updated.length > 0) setTables(updated);
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
      fetchIP();
    }
    setIpSavedToast(true);
    setTimeout(() => setIpSavedToast(false), 2500);
  };

  const getQRUrl = (table) => {
    const activeHost = localIP || '127.0.0.1';
    const portStr = localPort ? `:${localPort}` : '';
    const baseUrl = activeHost.includes(':') ? `http://${activeHost}` : `http://${activeHost}${portStr}`;
    const dbName = localStorage.getItem('resto_db_name') || 'default';
    return `${baseUrl}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
  };

  const printQRCodes = () => {
    window.print();
  };

  const isLoopback = localIP === '127.0.0.1' || localIP === 'localhost';
  const tablesToRender = selectedTable === 'ALL' ? tables : [selectedTable];

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
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full sm:w-48 bg-surface border border-border rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-primary text-text-main">
            <option value="ALL">{t("All Tables")}</option>
            {tables.map((tbl, index) => (
              <option key={`${tbl}-${index}`} value={tbl}>{tbl}</option>
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

      {/* QR Codes Grid */}
      <div className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 print:grid-cols-3 print:gap-4">
          {tablesToRender.map((table, index) => (
            <div key={`${table}-${index}`} className="bg-surface border-2 border-dashed border-border p-3 sm:p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 sm:gap-3 break-inside-avoid print:border-black print:bg-white print:shadow-none shadow-sm">
              <h2 className="font-black text-sm sm:text-xl text-text-main uppercase tracking-wider">{restaurantName}</h2>
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