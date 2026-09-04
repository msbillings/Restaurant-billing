import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config.js';
import api from '../api/axios';
import { useLanguage } from '../context/LanguageContext';
import { Save, Building, Phone, MapPin, Mail, FileText, Settings as SettingsIcon, User, Upload, Trash2, Image as ImageIcon, Lock, Eye, EyeOff, Globe, Wifi, Server, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Toast from './Toast';
import { apiUpdateProfile } from '../api/auth';
import BackButton from './common/BackButton';
import WhatsAppConnectModal from './WhatsAppConnectModal';
import CustomTimePicker from './common/CustomTimePicker';

const Settings = ({ user, setUser, onNavigate, onGoBack }) => {
  const { t } = useLanguage();

  // Production vs Dev mode detection
  const isDevPort = typeof window !== 'undefined' && ['5173', '5174', '5175', '3000'].includes(window.location.port);
  const isDevMode = Boolean(
    import.meta.env.DEV && isDevPort && !window.location.hostname?.includes('vercel.app')
  );
  const isProduction = !isDevMode;

  const [settings, setSettings] = useState({
    restaurantName: '',
    restaurantType: '',
    address: '',
    phone: '',
    whatsappNumber: '',
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
    geoFencingRadius: 50,
    latitude: '',
    longitude: '',
    qrMenuMode: 'cloud',
    vercelUrl: 'https://restaurant-billing-seven.vercel.app',
    serverIp: '',
    autoSendDaybook: false,
    autoSendTime: '22:00'
  });

  const [username, setUsername] = useState(user ? user.username : '');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [showOwnerPin, setShowOwnerPin] = useState(false);
  const [showWhatsAppConnectModal, setShowWhatsAppConnectModal] = useState(false);

  useEffect(() => {
    // 1. Load settings from localStorage first for instant display
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.logo === '[logo_stored]') {
          parsed.logo = '';
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (e) { }
    }

    // 2. Dynamically fetch latest settings from backend (with automatic cloud fallback on localhost/mobile)
    api.get('/config/info')
      .then((res) => {
        const data = res.data;
        const incoming = data?.restaurantSettings || data;
        if (incoming && typeof incoming === 'object') {
          setSettings((prev) => {
            const cleanIncoming = { ...incoming };
            if (cleanIncoming.logo === '[logo_stored]') {
              cleanIncoming.logo = '';
            } else if (!cleanIncoming.logo && prev.logo && prev.logo !== '[logo_stored]') {
              cleanIncoming.logo = prev.logo;
            }
            const updated = { ...prev, ...cleanIncoming };
            try {
              localStorage.setItem('restaurantSettings', JSON.stringify(updated));
              if (updated.vercelUrl) localStorage.setItem('resto_vercel_url', updated.vercelUrl);
              if (updated.serverIp) localStorage.setItem('resto_server_ip', updated.serverIp);
              if (updated.qrMenuMode) localStorage.setItem('resto_qr_mode', updated.qrMenuMode);
            } catch (e) { }
            return updated;
          });
        }
      })
      .catch((err) => console.warn("Notice: could not load remote shop settings:", err));

    // Load available printers if running in Desktop App
    if (window.electronAPI && window.electronAPI.getPrinters) {
      window.electronAPI.getPrinters().then((printers) => {
        setSystemPrinters(printers || []);
      }).catch((err) => console.error("Failed to load printers:", err));
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Immediately save restaurant settings locally in localStorage (0ms instant)
      const cleanSettings = { ...settings };
      if (cleanSettings.logo === '[logo_stored]') cleanSettings.logo = '';
      localStorage.setItem('restaurantSettings', JSON.stringify(cleanSettings));
      if (cleanSettings.vercelUrl) localStorage.setItem('resto_vercel_url', cleanSettings.vercelUrl);
      if (cleanSettings.serverIp) localStorage.setItem('resto_server_ip', cleanSettings.serverIp);
      if (cleanSettings.qrMenuMode) localStorage.setItem('resto_qr_mode', cleanSettings.qrMenuMode);
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: cleanSettings }));

      // 2. Perform fast network sync in parallel
      const syncPromises = [];

      syncPromises.push(
        api.post('/config/info', { restaurantSettings: cleanSettings })
          .catch(err => console.warn("Sync info notice:", err))
      );

      if (settings.ownerPin) {
        syncPromises.push(
          api.post('/config/security', { ownerPin: settings.ownerPin })
            .then(() => {
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

      // 3. Race sync with a 600ms threshold for ultra-responsive UI
      await Promise.race([
        Promise.all(syncPromises),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);

      setToast({ message: t('Settings saved successfully!'), type: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ message: t('Settings saved locally!'), type: 'success' });
    } finally {
      setSaving(false);
    }
  };

  const validateField = (field, val) => {
    let errorMsg = '';
    const trimmed = String(val).trim();
    if (trimmed) {
      if (field === 'phone' || field === 'whatsappNumber') {
        if (trimmed.length !== 10) {
          errorMsg = t('Phone number must be exactly 10 digits');
        } else if (!/^\d{10}$/.test(trimmed)) {
          errorMsg = t('Phone number must contain only numbers');
        }
      } else if (field === 'gstin') {
        if (trimmed.length !== 15) {
          errorMsg = t('GSTIN must be exactly 15 characters');
        } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(trimmed)) {
          errorMsg = t('Invalid GSTIN format (e.g., 22AAAAA0000A1Z5)');
        }
      } else if (field === 'fssai') {
        if (trimmed.length !== 14) {
          errorMsg = t('FSSAI License must be exactly 14 digits');
        } else if (!/^\d{14}$/.test(trimmed)) {
          errorMsg = t('FSSAI License must contain only numbers');
        }
      } else if (field === 'upiId') {
        if (!trimmed.includes('@')) {
          errorMsg = t('UPI ID must contain an @ symbol');
        } else if (!/^[\w.-]+@[\w.-]+$/.test(trimmed)) {
          errorMsg = t('Invalid UPI format (e.g., restaurantname@bank)');
        }
      }
    }
    setErrors((prev) => {
      const newErrors = { ...prev };
      if (errorMsg) newErrors[field] = errorMsg;
      else delete newErrors[field];
      return newErrors;
    });
  };

  const handleInputChange = (field, value) => {
    if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    if (field === 'ownerPin') {
      value = value.replace(/\D/g, '').slice(0, 6);
    }
    if (field === 'whatsappNumber') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    setSettings((prev) => ({
      ...prev,
      [field]: value
    }));
    validateField(field, value);
  };

  const fetchIpLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          setSettings((prev) => ({
            ...prev,
            latitude: Number(data.latitude),
            longitude: Number(data.longitude)
          }));
          setLocating(false);
          setToast({ message: t(`Location detected via network (${data.city || 'Local Area'})!`), type: 'success' });
          return true;
        }
      }
    } catch (e) {
      try {
        const res2 = await fetch('https://api.ipify.org?format=json');
        if (res2.ok) {
          const ipData = await res2.json();
          const geoRes = await fetch(`https://ipwho.is/${ipData.ip}`);
          const geoData = await geoRes.json();
          if (geoData && geoData.latitude && geoData.longitude) {
            setSettings((prev) => ({
              ...prev,
              latitude: Number(geoData.latitude),
              longitude: Number(geoData.longitude)
            }));
            setLocating(false);
            setToast({ message: t(`Location detected via network (${geoData.city || 'Local Area'})!`), type: 'success' });
            return true;
          }
        }
      } catch (err2) {}
    }
    return false;
  };

  const handleGetLocation = async () => {
    setLocating(true);

    const isElectron = (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron')) || Boolean(window.electronAPI);

    // If running inside Desktop Electron App, immediately use fast IP-based geolocation (<200ms)
    if (isElectron) {
      console.log('[Location] Running inside Desktop Electron app, using network geolocation...');
      const success = await fetchIpLocation();
      if (success) return;
    }

    if (!navigator.geolocation) {
      const success = await fetchIpLocation();
      if (!success) {
        setLocating(false);
        setToast({ message: t("Geolocation is not supported. Please enter coordinates manually."), type: 'error' });
      }
      return;
    }

    let isResolved = false;
    const gpsTimer = setTimeout(async () => {
      if (!isResolved) {
        isResolved = true;
        console.log('[Location] GPS hardware taking too long, falling back to network IP location...');
        const success = await fetchIpLocation();
        if (!success) {
          setLocating(false);
          setToast({ message: t("Could not capture GPS location. Please enter coordinates manually."), type: 'error' });
        }
      }
    }, 2500);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(gpsTimer);
        setSettings((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setLocating(false);
        setToast({ message: t("Location captured successfully!"), type: 'success' });
      },
      async (err) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(gpsTimer);
        console.warn('GPS failed, attempting IP Geolocation fallback:', err.message);
        const success = await fetchIpLocation();
        if (!success) {
          setLocating(false);
          if (err.code === 1) {
            setToast({ message: t("Location permission denied. Please enter coordinates manually."), type: 'error' });
          } else {
            setToast({ message: t("GPS unavailable on this PC. Please enter coordinates manually."), type: 'error' });
          }
        }
      },
      { timeout: 3000, enableHighAccuracy: false }
    );
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: t('Image size should be less than 5MB'), type: 'error' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Automatically optimize and resize logo for instant rendering & printing
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const optimizedDataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
        handleInputChange('logo', optimizedDataUrl);
      };
      img.onerror = () => {
        // If image loading fails, fallback to direct data URL
        handleInputChange('logo', event.target.result);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="h-full overflow-y-auto p-1.5 sm:p-2.5 md:p-3">
      <div className="w-full space-y-2.5 sm:space-y-3">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-secondary/10 rounded-2xl p-2 sm:p-3 border border-border">
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
                    {Boolean(settings.logo && settings.logo !== '[logo_stored]') ?
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white rounded-lg border border-border shadow-sm flex items-center justify-center min-w-[60px] min-h-[56px]">
                          <img 
                            src={settings.logo} 
                            alt="Restaurant Logo" 
                            className="h-14 max-w-[140px] object-contain" 
                            onError={() => {
                              console.warn("Logo failed to load, resetting");
                              handleInputChange('logo', '');
                            }}
                          />
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
                    className={`w-full px-4 py-2 border ${errors.phone ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-xl focus:outline-none focus:ring-2 bg-background text-text-main`} placeholder={t("Enter phone number")} />
                  {errors.phone && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.phone}</p>}
                </div>

                {/* WhatsApp Report Number */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                    <Phone size={14} className="text-emerald-600" />{t("WhatsApp Report Number (Optional)")}
                  </label>
                  <input
                    type="tel"
                    value={settings.whatsappNumber || ''}
                    onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                    onKeyPress={(e) => {
                      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className={`w-full px-4 py-2 border ${errors.whatsappNumber ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-xl focus:outline-none focus:ring-2 bg-background text-text-main`}
                    placeholder={t("e.g. 9876543210 (Defaults to Phone Number)")} />
                  {errors.whatsappNumber && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.whatsappNumber}</p>}
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
                    onChange={(e) => handleInputChange('gstin', e.target.value.toUpperCase())}
                    className={`w-full px-4 py-3 border ${errors.gstin ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-xl focus:outline-none focus:ring-2 bg-background text-text-main`} placeholder={t("Enter GSTIN")} />
                  {errors.gstin && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.gstin}</p>}
                </div>

                {/* Left Column Settings (FSSAI, UPI, WhatsApp, Footer) */}
                {/* Left Column Settings */}
                <div className="flex flex-col gap-6">
                  {/* FSSAI */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <FileText size={14} />{t("FSSAI Number")}
                    </label>
                    <input
                      type="text"
                      value={settings.fssai || ''}
                      onChange={(e) => handleInputChange('fssai', e.target.value.replace(/\D/g, '').slice(0, 14))}
                      className={`w-full px-4 py-3 border ${errors.fssai ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-xl focus:outline-none focus:ring-2 bg-background text-text-main`} placeholder={t("Enter FSSAI License Number")} />
                    {errors.fssai && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.fssai}</p>}
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
                      className={`w-full px-4 py-3 border ${errors.upiId ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-blue-200 focus:ring-blue-500/20 focus:border-blue-500'} rounded-xl focus:outline-none focus:ring-2 bg-blue-50 text-blue-900 font-mono`} placeholder={t("e.g. restaurant@upi")} />
                    {errors.upiId && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.upiId}</p>}
                  </div>

                  {/* WhatsApp Automated Bot Configuration */}
                  <div className="p-4 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors rounded-2xl border border-emerald-500/20 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] shrink-0 mt-0.5 shadow-sm">
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-sm font-bold text-text-main leading-tight block">
                            {t("WhatsApp Automated Gateway")}
                          </label>
                          <p className="text-xs text-text-muted leading-relaxed mt-1">
                            {t("Link your WhatsApp to send automatic e-bills & DayBook reports in background.")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setShowWhatsAppConnectModal(true)}
                        className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                        <RefreshCw size={14} />
                        <span>{t("Scan QR / Link Bot")}</span>
                      </button>
                    </div>
                    
                    <div className="pt-3 mt-3 border-t border-emerald-500/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-text-main">
                          {t("Auto-Send DayBook Report")}
                        </label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.autoSendDaybook || false}
                            onChange={(e) => handleInputChange('autoSendDaybook', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366]"></div>
                        </label>
                      </div>

                      {settings.autoSendDaybook && (
                        <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                          <label className="text-xs text-text-muted">
                            {t("Report Time")}
                          </label>
                          <CustomTimePicker 
                            value={settings.autoSendTime || '22:00'}
                            onChange={(val) => handleInputChange('autoSendTime', val)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Message */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <FileText size={14} />{t("Footer Message")}
                    </label>
                    <input
                      type="text"
                      value={settings.footerMessage}
                      onChange={(e) => handleInputChange('footerMessage', e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter footer message for receipts")} />
                  </div>
                </div>

                {/* Right Column Settings */}
                <div className="flex flex-col gap-6">
                  {/* Individual Tax Configuration */}
                  <div className="space-y-3 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                    <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                      <FileText size={14} className="text-orange-600" />{t("Individual Tax Options (CGST, SGST, GST)")}
                    </h3>
                    <p className="text-xs text-orange-700/70">{t("Toggle ON/OFF each tax option and set its default percentage rate.")}</p>

                    {/* CGST Option */}
                    <div className="flex items-center justify-between pt-2 border-t border-orange-200/50">
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
                            className="w-20 px-2 py-1 border border-orange-200 rounded-lg text-sm font-mono text-center bg-white" />
                          <span className="text-xs font-bold text-text-muted">%</span>
                        </div>
                      }
                    </div>

                    {/* SGST Option */}
                    <div className="flex items-center justify-between pt-2 border-t border-orange-200/50">
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
                            className="w-20 px-2 py-1 border border-orange-200 rounded-lg text-sm font-mono text-center bg-white" />
                          <span className="text-xs font-bold text-text-muted">%</span>
                        </div>
                      }
                    </div>

                    {/* GST / IGST Option */}
                    <div className="flex items-center justify-between pt-2 border-t border-orange-200/50">
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
                            className="w-20 px-2 py-1 border border-orange-200 rounded-lg text-sm font-mono text-center bg-white" />
                          <span className="text-xs font-bold text-text-muted">%</span>
                        </div>
                      }
                    </div>
                  </div>

                  {/* Dynamic QR Payment Toggle */}
                  <div className="flex items-center justify-between p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                    <div className="space-y-0.5">
                      <label className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                        <FileText size={14} className="text-orange-600" />{t("Dynamic QR Code Payment")}
                      </label>
                      <p className="text-xs text-orange-700/70">{t("Show dynamic scan-to-pay UPI QR code on checkout screen & printed bills")}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.enableQrPayment !== false}
                        onChange={(e) => handleInputChange('enableQrPayment', e.target.checked)} />
                      <div className="w-11 h-6 bg-orange-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-orange-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>

                  {/* Owner Security PIN */}
                  <div className="space-y-2 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                    <label className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                      <Lock size={14} className="text-orange-600" />{t("Owner Security PIN (Reports Lock)")}
                    </label>
                    <div className="relative">
                      <input
                        type={showOwnerPin ? "text" : "password"}
                        value={settings.ownerPin || ''}
                        onChange={(e) => handleInputChange('ownerPin', e.target.value)}
                        maxLength={10}
                        className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white text-orange-900 font-mono tracking-widest font-bold pr-12 placeholder:text-orange-900/40"
                        placeholder={t("•••••• (Leave blank to keep)")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOwnerPin(!showOwnerPin)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-400 hover:text-orange-600 transition-colors"
                      >
                        {showOwnerPin ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
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
                            Lat: {settings.latitude || t("Not Set")}<br />
                            Lng: {settings.longitude || t("Not Set")}
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); handleGetLocation(); }}
                            disabled={locating}
                            className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100 flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer">
                            {locating ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />} 
                            {locating ? t("Getting Location...") : t("Set to Current Location")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* QR Code Menu & URL Routing Configuration */}
                <div className="space-y-4 md:col-span-2 mt-4 pt-4 border-t border-border">
                  <div className="flex flex-col">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <Globe size={14} className="text-primary" />{t("Digital Menu Cloud URL")}
                    </label>
                    <span className="text-xs text-text-muted mt-1">
                      {isProduction
                        ? t("Table QR codes automatically route to your secure Vercel cloud domain.")
                        : t("Configure whether table QR codes route to your Cloud (Vercel) domain or Local Wi-Fi IP.")}
                    </span>
                  </div>

                  {isProduction ? (
                    /* Production: Clean, locked Vercel URL with no edit option and no IP fields */
                    <div className="bg-surface-hover p-4 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                          <Globe size={20} />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{t("Active Cloud Menu Domain")}</div>
                          <div className="text-sm font-black text-text-main font-mono mt-0.5">
                            {settings.vercelUrl || 'https://restaurant-billing-seven.vercel.app'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck size={12} /> {t("Production Active (4G/5G/Wi-Fi)")}
                      </span>
                    </div>
                  ) : (
                    /* Development Mode: Local IP & URL options */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-hover p-4 rounded-xl border border-border">
                      {/* Mode Selector */}
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-semibold text-text-main">{t("Default QR Menu Mode")}</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleInputChange('qrMenuMode', 'cloud')}
                            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${settings.qrMenuMode === 'cloud' || !settings.qrMenuMode
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-background text-text-muted border-border hover:bg-surface'
                              }`}
                          >
                            <Globe size={14} />
                            <span>{t("Cloud / Vercel Menu")}</span>
                            <span className="text-[9px] opacity-80 uppercase px-1 rounded bg-white/20">4G/5G</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInputChange('qrMenuMode', 'wifi')}
                            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${settings.qrMenuMode === 'wifi'
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-background text-text-muted border-border hover:bg-surface'
                              }`}
                          >
                            <Wifi size={14} />
                            <span>{t("Local Wi-Fi / LAN")}</span>
                            <span className="text-[9px] opacity-80 uppercase px-1 rounded bg-white/20">Offline</span>
                          </button>
                        </div>
                      </div>

                      {/* Cloud / Vercel Domain Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                          <Globe size={12} className="text-blue-500" />
                          <span>{t("Cloud / Vercel Menu Base URL")}</span>
                        </label>
                        <input
                          type="url"
                          value={settings.vercelUrl || ''}
                          onChange={(e) => handleInputChange('vercelUrl', e.target.value)}
                          placeholder="https://restaurant-billing-seven.vercel.app"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary bg-background text-xs font-mono"
                        />
                        <p className="text-[10px] text-text-muted">{t("Target web address where customer digital menu is hosted.")}</p>
                      </div>

                      {/* Local Server IP / Port Input */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                            <Server size={12} className="text-emerald-500" />
                            <span>{t("Local Server IP / Wi-Fi Address")}</span>
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch(`${getApiUrl()}/public/system-ip`);
                                if (res.ok) {
                                  const d = await res.json();
                                  if (d.ip) {
                                    handleInputChange('serverIp', d.ip);
                                    setToast({ message: `Detected LAN IP: ${d.ip}`, type: 'success' });
                                  }
                                }
                              } catch (e) {
                                setToast({ message: 'Could not auto-detect IP', type: 'error' });
                              }
                            }}
                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <RefreshCw size={10} />
                            <span>{t("Auto-Detect IP")}</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={settings.serverIp || ''}
                          onChange={(e) => handleInputChange('serverIp', e.target.value)}
                          placeholder="e.g. 192.168.1.100"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary bg-background text-xs font-mono"
                        />
                        <p className="text-[10px] text-text-muted">{t("Used when QR codes are in Local Wi-Fi mode.")}</p>
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
              {Boolean(settings.logo && settings.logo !== '[logo_stored]') &&
                <div className="flex justify-center mb-2">
                  <img 
                    src={settings.logo} 
                    alt="Logo Preview" 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    className="max-h-14 max-w-[140px] object-contain" 
                  />
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
        <div className="flex justify-center flex-col items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(errors).length > 0}
            className={`flex items-center gap-3 px-8 py-4 ${Object.keys(errors).length > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50'} text-white rounded-xl font-bold transition-all disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]`}>
            <Save size={20} className={saving ? 'animate-spin' : ''} />
            <span>{saving ? t('Saving...') : t('Save Settings')}</span>
          </button>
          {Object.keys(errors).length > 0 && (
            <p className="text-xs font-bold text-red-500 mt-1">{t("Please fix the validation errors above before saving.")}</p>
          )}
        </div>
      </div>

      {toast &&
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)} />
      }

      <WhatsAppConnectModal
        isOpen={showWhatsAppConnectModal}
        onClose={() => setShowWhatsAppConnectModal(false)}
      />
    </div>);

};

export default Settings;