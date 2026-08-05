import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { QrCode, Printer } from 'lucide-react';
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
  // Default: use current hostname (works for network access). Electron starts at 127.0.0.1 until we fetch the real IP.
  const [localIP, setLocalIP] = useState(isElectron ? '127.0.0.1' : window.location.hostname);
  // Port: For Electron, default to Vite dev port 5173. For browser, use current port.
  const [localPort, setLocalPort] = useState(isElectron ? '5173' : (window.location.port || ''));

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

  useEffect(() => {
    const fetchFloorsAndSettings = async () => {
      let extracted = [];

      // 1. Try fetching live floor layout from backend API
      try {
        const response = await api.get('/floors');
        if (response.data && Array.isArray(response.data)) {
          extracted = extractAllSpaces(response.data);
          localStorage.setItem('msbillings_spaces', JSON.stringify(response.data));
        }
      } catch (err) {
        console.warn('Could not fetch floors from API, reading from localStorage', err);
      }

      // 2. Fallback to localStorage if API empty
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

      // Load Restaurant Settings
      try {
        const settings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
        if (settings.restaurantName) setRestaurantName(settings.restaurantName);
      } catch (error) {
        console.error('Error loading settings for QRs:', error);
      }
    };

    fetchFloorsAndSettings();

    // Listen for live floor layout updates
    const handleSpacesUpdated = (event) => {
      if (event.detail && Array.isArray(event.detail)) {
        const updated = extractAllSpaces(event.detail);
        if (updated.length > 0) setTables(updated);
      }
    };
    window.addEventListener('spacesUpdated', handleSpacesUpdated);

    // Always fetch the real local IP from the backend.
    // This is needed for both localhost (browser) and Electron (file: protocol).
    const fetchIP = async () => {
      try {
        const API_BASE_URL = getApiUrl();
        const response = await fetch(`${API_BASE_URL}/public/system-ip`);
        if (response.ok) {
          const data = await response.json();
          if (data.ip && data.ip !== 'localhost' && data.ip !== '127.0.0.1') {
            setLocalIP(data.ip);
          }
          if (data.port) {
            setLocalPort(String(data.port));
          }
        }
      } catch (err) {
        // If backend is unreachable, keep using window.location.hostname as fallback
        if (!isElectron && window.location.hostname !== 'localhost') {
          setLocalIP(window.location.hostname);
          setLocalPort(window.location.port || '');
        }
        console.warn('Could not fetch system IP, using hostname fallback:', err);
      }
    };
    fetchIP();

    return () => {
      window.removeEventListener('spacesUpdated', handleSpacesUpdated);
    };
  }, []);

  const getQRUrl = (table) => {
    // ALWAYS use http:// — never file:// — so phones can actually open the URL
    const portStr = localPort ? `:${localPort}` : '';
    const baseUrl = `http://${localIP}${portStr}`;
    const dbName = localStorage.getItem('resto_db_name') || 'default';
    return `${baseUrl}/order?tenant=${dbName}&table=${encodeURIComponent(table)}`;
  };

  const printQRCodes = () => {
    window.print();
  };

  const tablesToRender = selectedTable === 'ALL' ? tables : [selectedTable];

  return (
    <div className="h-full flex flex-col bg-background p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <h1 className="text-2xl font-black text-text-main flex items-center gap-2">
            <QrCode className="text-primary" />{t("QR MENU GENERATOR")}
          </h1>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full sm:w-48 bg-surface border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary text-text-main">
            <option value="ALL">{t("All Tables")}</option>
            {tables.map((tbl, index) => (
              <option key={`${tbl}-${index}`} value={tbl}>{tbl}</option>
            ))}
          </select>
          <button
            onClick={printQRCodes}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity">
            <Printer size={18} /> <span className="hidden sm:inline">{t("Print QRs")}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
          {tablesToRender.map((table, index) => (
            <div key={`${table}-${index}`} className="bg-surface border-2 border-dashed border-border p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-4 break-inside-avoid print:border-black print:bg-white print:shadow-none shadow-sm">
              <h2 className="font-black text-xl text-text-main uppercase tracking-wider">{restaurantName}</h2>
              <div className="bg-white p-2 rounded-xl shadow-inner">
                <QRCodeSVG
                  value={getQRUrl(table)}
                  size={140}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div>
                <p className="text-xs text-text-muted font-bold tracking-widest uppercase mb-1">{t("Scan to Order")}</p>
                <h3 className="font-black text-2xl text-primary">{table}</h3>
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