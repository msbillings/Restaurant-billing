import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import { Save, Building, Phone, MapPin, Mail, FileText, Settings as SettingsIcon, User, Upload, Trash2, Image as ImageIcon, Lock, Eye, EyeOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Toast from './Toast';
import { apiUpdateProfile } from '../api/auth';
import BackButton from './common/BackButton';

const Settings = ({ user, setUser, onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [settings, setSettings] = useState({
    restaurantName: '',
    restaurantType: '',
    address: '',
    phone: '',
    email: '',
    gstin: '',
    fssai: '',
    upiId: '',
    ownerPin: '',
    footerMessage: '*** THANK YOU! VISIT AGAIN ***',
    kotPrinter: '',
    billingPrinter: '',
    silentPrinting: true,
    enableQrPayment: true,
    enableCgst: true,
    cgstRate: 2.5,
    enableSgst: true,
    sgstRate: 2.5,
    enableGst: false,
    gstRate: 5,
    logo: '',
    printFormat: '80mm',
    enableGeoFencing: false,
    geoFencingRadius: 100,
    latitude: '',
    longitude: ''
  });

  const [username, setUsername] = useState(user ? user.username : '');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [showOwnerPin, setShowOwnerPin] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings((prev) => ({ ...prev, ...parsed }));
    }

    // Load available printers if running in Desktop App
    if (window.electronAPI && window.electronAPI.getPrinters) {
      window.electronAPI.getPrinters().then((printers) => {
        setSystemPrinters(printers || []);
      }).catch((err) => console.error("Failed to load printers:", err));
    }
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Immediately save restaurant settings locally
      localStorage.setItem('restaurantSettings', JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));

      const API_BASE_URL = getApiUrl();
      const tenantDb = localStorage.getItem('resto_db_name') || '';
      const token = localStorage.getItem('accessToken') || '';
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Tenant-DB': tenantDb,
        'Authorization': `Bearer ${token}`
      };

      // 2. Perform parallel network sync with 5s timeout
      const syncPromises = [];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      syncPromises.push(
        fetch(`${API_BASE_URL}/config/info`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ restaurantSettings: settings }),
          signal: controller.signal
        }).catch(err => console.warn("Sync info notice:", err))
      );

      if (settings.ownerPin) {
        syncPromises.push(
          fetch(`${API_BASE_URL}/config/security`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ownerPin: settings.ownerPin }),
            signal: controller.signal
          }).then(() => {
            setSettings(prev => ({ ...prev, ownerPin: '' }));
          }).catch(err => console.warn("Sync security notice:", err))
        );
      }

      if (username && username !== user?.username) {
        syncPromises.push(
          apiUpdateProfile(username).then(response => {
            if (response?.user) {
              setUser(response.user);
              localStorage.setItem('user', JSON.stringify(response.user));
            }
          }).catch(err => console.warn("Sync profile notice:", err))
        );
      }

      await Promise.all(syncPromises);
      clearTimeout(timeoutId);

      setToast({ message: t('Settings saved successfully!'), type: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ message: t('Settings saved locally!'), type: 'success' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    if (field === 'ownerPin') {
      value = value.replace(/\D/g, '').slice(0, 6);
    }
    setSettings((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGetLocation = () => {
    setLoading(true);

    const fallbackToIP = async () => {
      try {
        const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.latitude && data.longitude) {
          setSettings((prev) => ({
            ...prev,
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude)
          }));
          setToast({ message: t("Location captured successfully!"), type: 'success' });
        } else {
          setToast({ message: `IP Geolocation failed: No coordinates in response.`, type: 'error' });
        }
      } catch (err) {
        console.error('IP Geolocation error:', err);
        setToast({ message: `IP Fallback Error: ${err.message}`, type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    if (!navigator.geolocation) {
      fallbackToIP();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSettings((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setLoading(false);
        setToast({ message: t("Location captured successfully!"), type: 'success' });
      },
      (err) => {
        console.error('Geolocation error:', err);
        // Fallback to IP based geolocation for Desktop/Electron
        fallbackToIP();
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setToast({ message: 'Image size should be less than 2MB', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('logo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-secondary/10 rounded-2xl p-4 sm:p-6 border border-border">
          <div className="flex items-center gap-3 sm:gap-4">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
              <SettingsIcon className="text-primary" size={22} />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-text-main">{t("Restaurant Settings")}</h1>
              <p className="text-xs sm:text-sm text-text-muted">{t("Configure your restaurant information and preferences")}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          <div className="flex flex-col gap-4">
            {/* Profile Information */}
            <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <User className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-bold text-text-main">{t("Profile Information")}</h2>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <User size={14} />{t("Username")}

                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter username")} />

                
              </div>
            </div>

            {/* Desktop Printers */}
            <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <FileText className="text-primary" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-main">{t("Desktop Printers")}<span className="text-sm font-normal text-primary">{t("(v1.4.5)")}</span></h2>
                    <p className="text-xs text-text-muted mt-0.5">{t("Configure auto-printing")}</p>
                  </div>
                </div>
                {!window.electronAPI &&
                <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">{t("WEB APP MODE")}

                </span>
                }
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">{t("Default KOT Printer")}

                  </label>
                  <select
                    value={settings.kotPrinter}
                    onChange={(e) => handleInputChange('kotPrinter', e.target.value)}
                    disabled={!window.electronAPI}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main disabled:opacity-50">
                    
                    <option value="">{t("-- Select Printer --")}</option>
                    {systemPrinters.map((p) =>
                    <option key={p.name} value={p.name}>{p.name}</option>
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">{t("Default Billing Printer")}

                  </label>
                  <select
                    value={settings.billingPrinter}
                    onChange={(e) => handleInputChange('billingPrinter', e.target.value)}
                    disabled={!window.electronAPI}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main disabled:opacity-50">
                    
                    <option value="">{t("-- Select Printer --")}</option>
                    {systemPrinters.map((p) =>
                    <option key={p.name} value={p.name}>{p.name}</option>
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">{t("Print Format (Receipt Layout)")}

                  </label>
                  <select
                    value={settings.printFormat || '80mm'}
                    onChange={(e) => handleInputChange('printFormat', e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main">
                    
                    <option value="80mm">{t("Thermal 80mm (Standard Receipt)")}</option>
                    <option value="58mm">{t("Thermal 58mm (Small Receipt)")}</option>
                    <option value="A4">{t("A4 (Full Page Invoice)")}</option>
                  </select>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border mt-4">
                  <div className="space-y-0.5">
                    <label className="text-sm font-semibold text-text-main">{t("Silent Printing")}</label>
                    <p className="text-xs text-text-muted">{t("Print directly without showing the print dialog")}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={settings.silentPrinting !== false}
                      onChange={(e) => handleInputChange('silentPrinting', e.target.checked)}
                      disabled={!window.electronAPI} />
                    
                    <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${settings.silentPrinting !== false ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${settings.silentPrinting !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </label>
                </div>
                {!window.electronAPI &&
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">{t("Silent printing is only available in the Desktop App. In the web version, a print dialog will always appear.")}

                </p>
                }
              </div>
            </div>

            {/* Restaurant Information */}
            <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-bold text-text-main">{t("Restaurant Information")}</h2>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Restaurant Logo */}
              <div className="md:col-span-2 space-y-2 pb-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <ImageIcon size={14} />{t("Printed Bill Logo")}

                  </label>
                <div className="flex flex-wrap items-center gap-4 bg-background p-3 rounded-xl border border-border">
                  {settings.logo ?
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg border border-border shadow-sm">
                        <img src={settings.logo} alt="Restaurant Logo" className="h-14 max-w-[140px] object-contain" />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInputChange('logo', '')}
                        className="flex items-center gap-2 px-3 py-2 bg-error/10 hover:bg-error/20 text-error rounded-lg text-sm font-bold transition-all">
                        
                        <Trash2 size={16} />{t("Remove Logo")}

                      </button>
                    </div> :

                    <label className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-bold cursor-pointer transition-all">
                      <Upload size={16} />{t("Upload Logo (PNG/JPG)")}

                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleLogoUpload}
                        className="hidden" />
                      
                    </label>
                    }
                  <span className="text-xs text-text-muted">{t("Displayed at top of printed bills (max 2MB)")}</span>
                </div>
              </div>

              {/* Restaurant Name */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <Building size={14} />{t("Restaurant Name")}

                  </label>
                <input
                    type="text"
                    value={settings.restaurantName}
                    onChange={(e) => handleInputChange('restaurantName', e.target.value)}
                    onKeyPress={(e) => {
                      if (!/[a-zA-Z\s]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter restaurant name")} />

                  
              </div>

              {/* Restaurant Type */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />{t("Restaurant Type")}

                  </label>
                <input
                    type="text"
                    value={settings.restaurantType}
                    onChange={(e) => handleInputChange('restaurantType', e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("e.g., South Indian & Chinese")} />

                  
              </div>

              {/* Address */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <MapPin size={14} />{t("Address")}

                  </label>
                <textarea
                    value={settings.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main resize-none" placeholder={t("Enter full address")} />

                  
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <Phone size={14} />{t("Phone Number")}

                  </label>
                <input
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    onKeyPress={(e) => {
                      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter phone number")} />

                  
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <Mail size={14} />{t("Email")}

                  </label>
                <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    onKeyPress={(e) => {
                      if (!/[a-zA-Z0-9@._-]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter email address")} />

                  
              </div>

              {/* GSTIN */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />{t("GSTIN")}

                  </label>
                <input
                    type="text"
                    value={settings.gstin}
                    onChange={(e) => handleInputChange('gstin', e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter GSTIN")} />

                  
              </div>

              {/* FSSAI */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />{t("FSSAI Number")}

                  </label>
                <input
                    type="text"
                    value={settings.fssai || ''}
                    onChange={(e) => handleInputChange('fssai', e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter FSSAI License Number")} />

                  
              </div>

              {/* Individual Tax Configuration */}
              <div className="space-y-3 p-4 bg-background rounded-xl border border-border">
                <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                  <FileText size={14} className="text-primary" />{t("Individual Tax Options (CGST, SGST, GST)")}

                  </h3>
                <p className="text-xs text-text-muted">{t("Toggle ON/OFF each tax option and set its default percentage rate.")}</p>

                {/* CGST Option */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={settings.enableCgst !== false}
                          onChange={(e) => handleInputChange('enableCgst', e.target.checked)} />
                        
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-sm font-semibold text-text-main">{t("Enable CGST")}</span>
                  </div>
                  {settings.enableCgst !== false &&
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={settings.cgstRate !== undefined ? settings.cgstRate : 2.5}
                        onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-center bg-surface" />
                      
                      <span className="text-xs font-bold text-text-muted">%</span>
                    </div>
                    }
                </div>

                {/* SGST Option */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={settings.enableSgst !== false}
                          onChange={(e) => handleInputChange('enableSgst', e.target.checked)} />
                        
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-sm font-semibold text-text-main">{t("Enable SGST")}</span>
                  </div>
                  {settings.enableSgst !== false &&
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={settings.sgstRate !== undefined ? settings.sgstRate : 2.5}
                        onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-center bg-surface" />
                      
                      <span className="text-xs font-bold text-text-muted">%</span>
                    </div>
                    }
                </div>

                {/* GST / IGST Option */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={settings.enableGst === true}
                          onChange={(e) => handleInputChange('enableGst', e.target.checked)} />
                        
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-sm font-semibold text-text-main">{t("Enable GST (or IGST)")}</span>
                  </div>
                  {settings.enableGst === true &&
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={settings.gstRate !== undefined ? settings.gstRate : 5}
                        onChange={(e) => handleInputChange('gstRate', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-center bg-surface" />
                      
                      <span className="text-xs font-bold text-text-muted">%</span>
                    </div>
                    }
                </div>
              </div>

              {/* UPI ID */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />{t("UPI Payment VPA / ID")}

                  </label>
                <input
                    type="text"
                    value={settings.upiId || ''}
                    onChange={(e) => handleInputChange('upiId', e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main font-mono" placeholder={t("e.g. restaurant@upi or 9876543210@ybl")} />

                  
              </div>

              {/* Dynamic QR Payment Toggle */}
              <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                <div className="space-y-0.5">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                    <FileText size={14} className="text-primary" />{t("Dynamic QR Code Payment")}

                    </label>
                  <p className="text-xs text-text-muted">{t("Show dynamic scan-to-pay UPI QR code on checkout screen & printed bills")}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.enableQrPayment !== false}
                      onChange={(e) => handleInputChange('enableQrPayment', e.target.checked)} />
                    
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>


              {/* Owner Security PIN */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <Lock size={14} />{t("Owner Security PIN (Reports Lock)")}
                </label>
                <div className="relative">
                  <input
                    type={showOwnerPin ? "text" : "password"}
                    value={settings.ownerPin || ''}
                    onChange={(e) => handleInputChange('ownerPin', e.target.value)}
                    maxLength={10}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main font-mono tracking-widest font-bold pr-12"
                    placeholder={t("•••••• (Leave blank to keep)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOwnerPin(!showOwnerPin)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showOwnerPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Footer Message */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />{t("Footer Message")}

                  </label>
                <input
                    type="text"
                    value={settings.footerMessage}
                    onChange={(e) => handleInputChange('footerMessage', e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter footer message for receipts")} />

                  
              </div>

              {/* Geo-Fencing Security */}
              <div className="space-y-4 md:col-span-2 mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <MapPin size={14} />{t("Geo-Fencing (QR Code Location Security)")}
                    </label>
                    <span className="text-xs text-text-muted mt-1">{t("Block customers from ordering if they are not physically at the restaurant.")}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.enableGeoFencing || false}
                        onChange={(e) => handleInputChange('enableGeoFencing', e.target.checked)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {settings.enableGeoFencing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-hover p-4 rounded-xl border border-border">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-text-main">{t("Allowed Radius")}</label>
                      <select
                        value={[20, 50, 100, 500, 1000].includes(settings.geoFencingRadius) ? settings.geoFencingRadius : 'custom'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            handleInputChange('geoFencingRadius', 150); // initial custom value
                          } else {
                            handleInputChange('geoFencingRadius', Number(val));
                          }
                        }}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary bg-background text-sm">
                        <option value={20}>{t("20 Meters (Very Strict)")}</option>
                        <option value={50}>{t("50 Meters (Strict)")}</option>
                        <option value={100}>{t("100 Meters (Recommended)")}</option>
                        <option value={500}>{t("500 Meters (Lenient)")}</option>
                        <option value={1000}>{t("1 KM")}</option>
                        <option value="custom">{t("Custom (Enter value)")}</option>
                      </select>
                      
                      {![20, 50, 100, 500, 1000].includes(settings.geoFencingRadius) && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={settings.geoFencingRadius || ''}
                            onChange={(e) => handleInputChange('geoFencingRadius', Number(e.target.value))}
                            placeholder={t("Radius in meters")}
                            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary bg-background text-sm"
                          />
                          <span className="text-sm font-semibold text-text-muted">m</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-text-main">{t("Restaurant Coordinates")}</label>
                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-mono bg-background px-3 py-2 rounded-lg border border-border text-text-muted break-all">
                          Lat: {settings.latitude || t("Not Set")}<br/>
                          Lng: {settings.longitude || t("Not Set")}
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); handleGetLocation(); }}
                          className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100 flex items-center justify-center gap-1">
                          <MapPin size={12} /> {t("Set to Current Location")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Preview Section */}
          <div className="lg:sticky lg:top-24 h-fit bg-surface rounded-2xl p-4 border border-border shadow-lg">
            <h2 className="text-xl font-bold text-text-main mb-4">{t("Receipt Preview")}</h2>
            <div className="bg-white border border-border rounded-xl p-4 max-w-xs mx-auto shadow-sm">
              {settings.logo &&
              <div className="flex justify-center mb-2">
                  <img src={settings.logo} alt="Logo Preview" className="max-h-14 max-w-[140px] object-contain" />
                </div>
              }
              <div className="text-center font-bold text-lg mb-2">{settings.restaurantName || 'Restaurant Name'}</div>
              <div className="text-center text-sm text-gray-600 mb-4">
                {settings.restaurantType}<br />
                {settings.address && settings.address.split('\n').map((line, i) =>
                <div key={i}>{line}</div>
                )}
                {settings.phone && <>{t("Ph:")} {settings.phone}<br /></>}
                {settings.gstin && <>{`GSTIN: ${settings.gstin}`}<br /></>}
                {settings.fssai && `FSSAI: ${settings.fssai}`}
              </div>
              
              <div className="border-t border-b border-dashed py-2 my-2 text-center font-bold text-sm">
                {t("RECEIPT")}
              </div>
              
              {/* Mock Items Details */}
              <div className="text-xs my-3 space-y-1.5 font-mono">
                <div className="flex justify-between font-bold border-b border-dashed pb-1 mb-1">
                  <span>ITEM</span>
                  <span>AMT</span>
                </div>
                <div className="flex justify-between">
                  <span>1 x Chicken Biryani</span>
                  <span>250.00</span>
                </div>
                <div className="flex justify-between">
                  <span>2 x Sweet Corn Soup</span>
                  <span>180.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1 x Butter Naan</span>
                  <span>40.00</span>
                </div>
                <div className="flex justify-between border-t border-dashed pt-1 mt-1 font-medium">
                  <span>Subtotal</span>
                  <span>₹470.00</span>
                </div>
                {settings.enableCgst && (
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>CGST ({settings.cgstRate || 0}%)</span>
                    <span>₹{((470 * Number(settings.cgstRate || 0)) / 100).toFixed(2)}</span>
                  </div>
                )}
                {settings.enableSgst && (
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>SGST ({settings.sgstRate || 0}%)</span>
                    <span>₹{((470 * Number(settings.sgstRate || 0)) / 100).toFixed(2)}</span>
                  </div>
                )}
                {settings.enableGst && (
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>GST ({settings.gstRate || 0}%)</span>
                    <span>₹{((470 * Number(settings.gstRate || 0)) / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed pt-1 mt-1 font-bold text-sm">
                  <span>TOTAL</span>
                  <span>₹{(470 + (settings.enableCgst ? (470 * Number(settings.cgstRate || 0)) / 100 : 0) + (settings.enableSgst ? (470 * Number(settings.sgstRate || 0)) / 100 : 0) + (settings.enableGst ? (470 * Number(settings.gstRate || 0)) / 100 : 0)).toFixed(2)}</span>
                </div>
              </div>

              {settings.enableQrPayment !== false && (settings.upiId || '').trim() && (
                <div className="border-t border-dashed pt-3 mt-3 text-center flex flex-col items-center">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {t("SCAN TO PAY VIA UPI")}
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm my-1 inline-block">
                    <QRCodeSVG
                      value={`upi://pay?pa=${settings.upiId.trim()}&pn=${encodeURIComponent(settings.restaurantName || 'Restaurant')}&am=${(470 + (settings.enableCgst ? (470 * Number(settings.cgstRate || 0)) / 100 : 0) + (settings.enableSgst ? (470 * Number(settings.sgstRate || 0)) / 100 : 0) + (settings.enableGst ? (470 * Number(settings.gstRate || 0)) / 100 : 0)).toFixed(2)}&cu=INR&tn=Bill%20Payment`}
                      size={96}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  <div className="text-[10px] font-bold text-gray-600 font-mono mt-0.5">
                    {t("UPI ID:")} {settings.upiId.trim()}
                  </div>
                </div>
              )}

              <div className="border-t border-dashed pt-3 mt-3 text-center text-xs font-medium">
                {settings.footerMessage}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-3 px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]">
            
            <Save size={20} />
            <span>{loading ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {toast &&
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)} />

      }
    </div>);

};

export default Settings;