import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { Shield, Key, Loader2, ServerCrash, User, Eye, EyeOff, Sparkles, Settings, X, Save, Wifi, CheckCircle2, Smartphone, Server } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import BackgroundSlideshow from './BackgroundSlideshow';
import logoImg from '../assets/images/logo.png';

const isAPK = Capacitor.isNativePlatform();

const LicenseScreen = ({ onValidLicense }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const [superadminIp, setSuperadminIp] = useState('');

  // APK-specific: show IP panel if no server IP is stored
  const [showApkIpPanel, setShowApkIpPanel] = useState(false);
  const [apkIpInput, setApkIpInput] = useState('');
  const [apkIpStatus, setApkIpStatus] = useState(null); // null | 'testing' | 'ok' | 'fail'

  useEffect(() => {
    setServerIp(localStorage.getItem('resto_server_ip') || '');
    setSuperadminIp(localStorage.getItem('resto_superadmin_ip') || '');

    if (isAPK) {
      const storedIp = localStorage.getItem('resto_server_ip');
      if (storedIp) {
        setApkIpInput(storedIp);
      }
    }
  }, []);

  const handleSaveSettings = () => {
    let cleanServer = serverIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    let cleanSuper = superadminIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

    if (cleanServer) localStorage.setItem('resto_server_ip', cleanServer);
    else localStorage.removeItem('resto_server_ip');
    
    if (cleanSuper) localStorage.setItem('resto_superadmin_ip', cleanSuper);
    else localStorage.removeItem('resto_superadmin_ip');
    
    setShowSettings(false);
    window.location.reload();
  };

  // APK: Test connection to a given IP and save if successful
  const handleApkTestConnection = async () => {
    const ip = apkIpInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!ip) return;
    setApkIpStatus('testing');
    try {
      const res = await fetch(`http://${ip}:5002/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        localStorage.setItem('resto_server_ip', ip);
        setServerIp(ip);
        setApkIpStatus('ok');
        setTimeout(() => setShowApkIpPanel(false), 1200);
      } else {
        setApkIpStatus('fail');
      }
    } catch {
      setApkIpStatus('fail');
    }
  };

  const handleApkSaveIp = () => {
    const ip = apkIpInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!ip) return;
    localStorage.setItem('resto_server_ip', ip);
    setServerIp(ip);
    setShowApkIpPanel(false);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const SUPERADMIN_API_URL = getSuperadminApiUrl();
      const response = await fetch(`${SUPERADMIN_API_URL}/api/clients/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // Setup local database configuration
        if (data.databaseName && data.plainTextPassword) {
          try {
            const API_BASE_URL = getApiUrl();
            const setupResponse = await fetch(`${API_BASE_URL}/config/setup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tenant-DB': data.databaseName
              },
              body: JSON.stringify({
                databaseName: data.databaseName,
                username: data.restaurantName,
                password: data.plainTextPassword,
                staffAccounts: data.staffAccounts
              })
            });

            if (!setupResponse.ok) {
              let errText = 'Backend Error';
              try {
                const errObj = await setupResponse.json();
                errText = errObj.message || errObj.error || JSON.stringify(errObj);
              } catch (e) {
                errText = await setupResponse.text().catch(() => setupResponse.statusText);
              }
              throw new Error(`[${setupResponse.status}] ${errText}`);
            }
          } catch (setupErr) {
            console.error('Failed to configure local database:', setupErr);
            setError(`Failed to setup database: ${setupErr.message}`);
            setLoading(false);
            return;
          }
        }

        localStorage.setItem('resto_license', data.licenseKey || 'ACCOUNT-LOGIN');
        localStorage.setItem('resto_license_expiry', data.validUntil);
        if (data.databaseName) localStorage.setItem('resto_db_name', data.databaseName);

        try {
          const API_BASE_URL = getApiUrl();
          await fetch(`${API_BASE_URL}/config/info`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-DB': data.databaseName || localStorage.getItem('resto_db_name') || ''
            },
            body: JSON.stringify({ licenseExpiry: data.validUntil })
          });
        } catch (e) {}

        onValidLicense();
      } else {
        setError(data.message || 'Invalid email or password.');
      }
    } catch (err) {
      setError(`Connection Error: ${err.message}. Please check your internet connection or contact support.`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    localStorage.setItem('resto_license', 'MSBILL-DEMO-TEAM-2026');
    localStorage.setItem('resto_license_expiry', '2126-12-31T23:59:59.000Z');
    localStorage.setItem('resto_db_name', 'client_demo_db');
    onValidLicense();
  };

  return (
    <BackgroundSlideshow formPosition="left">
      <div className="w-full max-w-md relative z-10 animate-fade-in mx-auto px-2 sm:px-0">



        {/* Logo Header */}
        <div className="text-center mb-4 sm:mb-8 relative">
          <button 
            type="button"
            onClick={() => setShowSettings(true)}
            className="absolute top-0 right-0 p-2 text-white/50 hover:text-white transition-colors z-30"
            title="Server Settings"
          >
            <Settings size={20} />
          </button>
          
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 mb-3 sm:mb-6 shadow-2xl rounded-full relative mt-2 sm:mt-4">
            <img src={logoImg} alt="MS Billing Logo" className="w-full h-full object-cover rounded-full shadow-[0_0_20px_rgba(255,100,0,0.4)] border-2 border-orange-500/50 z-10 relative" />
            <Sparkles className="absolute -top-1 -right-1 text-yellow-400 animate-pulse z-20" size={16} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-1 sm:mb-2 tracking-tight drop-shadow-lg">{t("msbillings")}</h1>
          <p className="text-gray-300 font-bold uppercase tracking-widest text-xs sm:text-sm">{t("Software Activation")}</p>
        </div>

        {/* Activation Form (Premium Glassmorphism) */}
        <div className="bg-white/10 backdrop-blur-xl p-4 sm:p-8 border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative overflow-hidden w-full max-w-full" style={{ borderRadius: '20px' }}>
          
          <div className="relative z-10">
            <p className="text-center text-[11px] sm:text-sm text-gray-300 mb-4 sm:mb-8 font-medium">{t("Please enter your registered Email and Password to activate your terminal.")}</p>

            <form onSubmit={handleActivate} className="space-y-4 sm:space-y-6">
              <div>
                <label className="text-xs sm:text-sm font-bold text-gray-200 flex items-center gap-2 mb-1.5 sm:mb-2">
                  <User size={14} />{t("Email Address")}
                </label>
                <div className="relative flex items-center">
                  <User size={18} className="absolute left-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder={t("restaurant@example.com")}
                    className="w-full py-3 sm:py-4 px-4 pl-11 sm:pl-12 border border-white/20 bg-white/5 text-white text-sm sm:text-base placeholder:text-gray-400 focus:outline-none focus:border-white focus:bg-white/10 transition-all duration-300"
                    style={{ borderRadius: '12px' }}
                    autoFocus
                    required />
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-bold text-gray-200 flex items-center gap-2 mb-1.5 sm:mb-2">
                  <Key size={14} />{t("Password")}
                </label>
                <div className="relative flex items-center">
                  <Key size={18} className="absolute left-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full py-3 sm:py-4 px-4 pl-11 sm:pl-12 pr-12 border border-white/20 bg-white/5 text-white text-sm sm:text-base placeholder:text-gray-400 focus:outline-none focus:border-white focus:bg-white/10 transition-all duration-300"
                    style={{ borderRadius: '12px' }}
                    required />
                  
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 inset-y-0 flex items-center justify-center text-gray-400 hover:text-white transition-colors focus:outline-none">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error &&
                <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-red-100 p-3 sm:p-4 text-xs sm:text-sm font-bold flex flex-col gap-2.5 animate-shake" style={{ borderRadius: '12px' }}>
                  <div className="flex items-start gap-3">
                    <ServerCrash size={18} className="shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                  {error.toLowerCase().includes('failed to fetch') && (
                    <button 
                      type="button" 
                      onClick={() => setShowSettings(true)}
                      className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-black self-start transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                    >
                      <Settings size={14} /> Configure POS Server IP (WiFi)
                    </button>
                  )}
                </div>
              }

              <button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full py-3 sm:py-4 px-6 font-black text-white bg-orange-500 hover:bg-orange-600 transition-all duration-300 shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm sm:text-base"
                style={{ borderRadius: '12px' }}>
                
                {loading ?
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{t("Verifying License...")}</span>
                  </> :
                  <>
                    <Shield size={18} />
                    <span>{t("Activate Software")}</span>
                  </>
                }
              </button>
            </form>

            <div className="relative flex py-4 sm:py-6 items-center">
              <div className="flex-grow border-t border-white/20"></div>
              <span className="flex-shrink mx-4 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">{t("Or try it out")}</span>
              <div className="flex-grow border-t border-white/20"></div>
            </div>

            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full py-3 sm:py-4 px-6 font-bold text-white border-2 border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2 text-sm sm:text-base"
              style={{ borderRadius: '12px' }}>{t("🚀 Quick Demo Mode (No License Required)")}
            </button>
          </div>
        </div>
      </div>
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-gray-900 border border-white/10 p-6 shadow-2xl w-full max-w-sm relative" style={{ borderRadius: '24px' }}>
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Settings size={20} className="text-orange-500" />
              Network Settings
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-bold text-gray-300 block mb-2">
                  Server IP (e.g. 192.168.1.10)
                </label>
                <input
                  type="text"
                  value={serverIp}
                  onChange={(e) => setServerIp(e.target.value)}
                  placeholder="Leave empty for default"
                  className="w-full py-3 px-4 border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                  style={{ borderRadius: '12px' }}
                />
              </div>
              
              <div>
                <label className="text-sm font-bold text-gray-300 block mb-2">
                  Superadmin IP
                </label>
                <input
                  type="text"
                  value={superadminIp}
                  onChange={(e) => setSuperadminIp(e.target.value)}
                  placeholder="Leave empty for default"
                  className="w-full py-3 px-4 border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                  style={{ borderRadius: '12px' }}
                />
              </div>
              
              <p className="text-xs text-gray-400">
                If the app fails to connect from a mobile device on the same WiFi, enter your PC's local IP address here.
              </p>
            </div>
            
            <button
              onClick={handleSaveSettings}
              className="w-full py-3 px-4 font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              style={{ borderRadius: '12px' }}
            >
              <Save size={18} />
              Save & Reload
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </BackgroundSlideshow>
  );
};

export default LicenseScreen;