import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { 
  X, CheckCircle2, RefreshCw, Smartphone, LogOut, Send, 
  AlertCircle, QrCode, Phone, Copy, Check, Info, ShieldCheck, Laptop
} from 'lucide-react';
import { 
  getWhatsAppStatus, 
  logoutWhatsApp, 
  sendWhatsAppMessage, 
  requestWhatsAppPairingCode, 
  refreshWhatsAppQR 
} from '../api/whatsapp';

const WhatsAppConnectModal = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [statusData, setStatusData] = useState({ status: 'CONNECTING', connectedNumber: null, qr: null, platform: null, deviceName: null });
  const [loading, setLoading] = useState(true);
  const [connectTab, setConnectTab] = useState('qr'); // 'qr' | 'pairing'
  
  // Pairing Code State
  const [pairPhone, setPairPhone] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [loadingPairing, setLoadingPairing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Refresh QR state
  const [refreshingQR, setRefreshingQR] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Test Message State
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await getWhatsAppStatus();
      if (res) {
        setStatusData(res);
        if (res.status === 'CONNECTED') {
          setPairingCode(null);
        }
        if (res.connectedNumber) {
          let num = String(res.connectedNumber).replace(/[^0-9]/g, '');
          if (num.length === 12 && num.startsWith('91')) {
            num = num.slice(2);
          }
          setTestPhone(prev => (prev ? prev : num));
        }
      }
    } catch (e) {
      console.warn('Could not fetch WhatsApp status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();

    // Slower polling when already connected to keep connection rock-solid
    const pollTime = statusData.status === 'CONNECTED' ? 8000 : 2500;
    const interval = setInterval(fetchStatus, pollTime);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchStatus();
      }
    };
    const handleFocus = () => fetchStatus();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    let appListener;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          fetchStatus();
          setTimeout(fetchStatus, 800);
          setTimeout(fetchStatus, 1800);
        }
      }).then(l => { appListener = l; }).catch(() => {});
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      if (appListener) appListener.remove();
    };
  }, [isOpen, statusData.status]);

  const handleRefreshQR = async () => {
    setRefreshingQR(true);
    setActionMessage(null);
    try {
      const res = await refreshWhatsAppQR();
      if (res?.status) {
        setStatusData(res.status);
      }
      setActionMessage({ text: t('Fresh QR Code generated! Please scan immediately.'), type: 'info' });
    } catch (e) {
      setActionMessage({ text: t('Failed to refresh QR. Retrying...'), type: 'error' });
      fetchStatus();
    } finally {
      setRefreshingQR(false);
    }
  };

  const handleRequestPairingCode = async (e) => {
    e?.preventDefault();
    let clean = (pairPhone || '').replace(/[^0-9]/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      clean = clean.slice(2);
    }

    if (!clean || clean.length !== 10) {
      setActionMessage({ text: t('Please enter a valid 10-digit WhatsApp mobile number'), type: 'error' });
      return;
    }

    setLoadingPairing(true);
    setActionMessage(null);
    setPairingCode(null);
    try {
      const res = await requestWhatsAppPairingCode(clean);
      if (res?.pairingCode) {
        setPairingCode(res.pairingCode);
        setActionMessage({ text: t('Pairing code generated! Enter it in WhatsApp now.'), type: 'success' });
      }
    } catch (e) {
      console.error('Pairing code error:', e);
      const errDetail = e.response?.data?.error || e.message || t('Failed to generate pairing code');
      setActionMessage({ text: errDetail, type: 'error' });
    } finally {
      setLoadingPairing(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    const cleanCode = pairingCode.replace(/-/g, '');
    navigator.clipboard.writeText(cleanCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setPairingCode(null);
    try {
      await logoutWhatsApp();
      setActionMessage({ text: t('Disconnected successfully. Ready to re-link!'), type: 'info' });
      await fetchStatus();
    } catch (e) {
      setActionMessage({ text: t('Failed to disconnect'), type: 'error' });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSendTest = async () => {
    let clean = (testPhone || '').replace(/[^0-9]/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      clean = clean.slice(2);
    }

    if (!clean || clean.length !== 10) {
      setActionMessage({ text: t('Please enter a valid 10-digit mobile number'), type: 'error' });
      return;
    }

    setSendingTest(true);
    setActionMessage(null);
    try {
      await sendWhatsAppMessage(clean, '🎉 *MS Billings POS Test Message*\nYour automated WhatsApp service is connected and working perfectly!');
      setActionMessage({ text: t('Test message delivered successfully! ✓'), type: 'success' });
    } catch (e) {
      console.error('Test message send error:', e);
      let errDetail = e.response?.data?.error || e.message || t('Failed to send test message');
      if (errDetail.includes('Connection Closed') || errDetail.includes('closed')) {
        errDetail = t('WhatsApp connection was temporarily closed. Auto-reconnecting in background... Please click Test Send again in 2 seconds.');
      }
      setActionMessage({ text: errDetail, type: 'error' });
    } finally {
      setSendingTest(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = statusData.status === 'CONNECTED' && Boolean(statusData.connectedNumber);
  const isCapacitor = Capacitor.isNativePlatform();
  const isAndroid = isCapacitor && /android/i.test(navigator.userAgent || '');
  const isIOS = isCapacitor && /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const isMac = !isCapacitor && (statusData?.platform 
    ? statusData.platform.toLowerCase().includes('mac') 
    : (typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)));
  
  const savedSettings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
  const activeRestaurantName = statusData?.restaurantName || savedSettings?.restaurantName || 'MS Billings';
  const currentPlatformName = statusData?.platform || (isAndroid ? 'Android APK' : isIOS ? 'iOS App' : isMac ? 'Mac OS' : 'Windows');
  const currentDeviceName = statusData?.deviceName || `${activeRestaurantName} Gateway`;

  const modalContent = (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto overscroll-contain">
      <div className="bg-slate-900 border border-white/15 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-lg shadow-2xl text-white animate-in zoom-in-95 duration-150 relative overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh] my-auto">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-48 sm:w-60 h-48 sm:h-60 bg-[#25D366]/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-36 sm:w-48 h-36 sm:h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10 mb-3 sm:mb-4 relative z-10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] shadow-[0_0_15px_rgba(37,211,102,0.3)] shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                {activeRestaurantName} {t("WhatsApp Automated Bot")}
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-400 truncate">{t("Direct background e-Bills & DayBook reports")}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close modal">
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Action Feedback Banner */}
        {actionMessage && (
          <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-xs font-semibold flex items-start sm:items-center gap-2 mb-3 shrink-0 ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
              : actionMessage.type === 'error' 
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' 
              : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
          }`}>
            {actionMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5 sm:mt-0" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span className="leading-tight break-words min-w-0 flex-1">{actionMessage.text}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 sm:pr-1 space-y-3 sm:space-y-4 relative z-10 custom-scrollbar overscroll-contain pb-1">
          {statusData.status === 'CONNECTING' && !isConnected ? (
            <div className="bg-slate-800/90 rounded-xl sm:rounded-2xl p-6 border border-emerald-500/30 text-center space-y-4 shadow-xl animate-in zoom-in-95">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#25D366]/20 animate-ping"></div>
                <div className="w-14 h-14 rounded-full bg-[#25D366]/30 border-2 border-[#25D366] flex items-center justify-center text-[#25D366] shadow-[0_0_20px_rgba(37,211,102,0.4)]">
                  <RefreshCw size={24} className="animate-spin text-[#25D366]" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center justify-center gap-1.5">
                  
                  <span>{t("Connecting to WhatsApp...")}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-300 max-w-xs mx-auto leading-relaxed">
                  {t("Exchanging secure encryption keys with WhatsApp servers. Connecting in a few seconds...")}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={fetchStatus}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <RefreshCw size={12} />
                  <span>{t("Check Status Now")}</span>
                </button>
              </div>
            </div>
          ) : isConnected ? (
            <div className="bg-slate-800/90 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border border-emerald-500/30 space-y-3 sm:space-y-4 shadow-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 animate-ping"></div>
                  <span>{t("Connected & Automated")}</span>
                </div>
                {(() => {
                  const rawNum = String(statusData.connectedNumber || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                  const displayNum = rawNum.length === 12 && rawNum.startsWith('91') ? rawNum.slice(2) : rawNum;
                  if (!displayNum) return null;
                  return (
                    <span className="text-[11px] sm:text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-emerald-500/30">
                      +91 {displayNum}
                    </span>
                  );
                })()}
              </div>

              {/* Linked Device Status Card */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-300 uppercase tracking-wider">
                    {t("Linked Device")}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-400">
                    ● {t("Active Gateway")}
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-2.5 sm:p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Laptop size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{currentDeviceName}</h4>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">{t("Platform")}: {currentPlatformName} Gateway • {t("Live")}</p>
                    </div>
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md shrink-0">
                    {t("Active")}
                  </span>
                </div>
              </div>

              {/* Test Message Dispatch */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <label className="text-[11px] sm:text-xs font-semibold text-gray-300 block">{t("Send Test WhatsApp Message:")}</label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-slate-900 border border-white/10 rounded-xl px-2.5 sm:px-3 py-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-400 mr-1.5 sm:mr-2 shrink-0">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={testPhone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length === 12 && val.startsWith('91')) val = val.slice(2);
                        setTestPhone(val);
                      }}
                      placeholder={t("10-digit mobile number")}
                      className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none w-full min-w-0"
                    />
                  </div>
                  <button
                    onClick={handleSendTest}
                    disabled={sendingTest}
                    className="px-3 sm:px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap">
                    <Send size={13} className={sendingTest ? 'animate-spin' : ''} />
                    <span>{sendingTest ? t("Sending...") : t("Test Send")}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full sm:w-auto justify-center px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer active:scale-95">
                  {loggingOut ? <RefreshCw size={14} className="animate-spin" /> : <LogOut size={14} />}
                  <span>{loggingOut ? t("Disconnecting...") : t("Disconnect / Re-link")}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* Tabs for connection method */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 bg-slate-800/80 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => { setConnectTab('qr'); setActionMessage(null); }}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    connectTab === 'qr'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}>
                  <QrCode size={15} className="shrink-0 sm:w-4 sm:h-4" />
                  <span className="truncate">{t("Method 1: Scan QR")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setConnectTab('pairing'); setActionMessage(null); }}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl font-bold text-xs transition-all cursor-pointer relative ${
                    connectTab === 'pairing'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}>
                  <Phone size={15} className="shrink-0 sm:w-4 sm:h-4" />
                  <span className="truncate">{t("Method 2: Phone Code")}</span>
                  <span className="absolute -top-1 -right-0.5 sm:-top-1.5 sm:-right-1 bg-amber-500 text-[8px] sm:text-[9px] font-black text-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter shadow-sm animate-pulse">
                    {t("Easy")}
                  </span>
                </button>
              </div>

              {/* Method 1: QR Code Tab */}
              {connectTab === 'qr' && (
                <div className="bg-slate-800/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border border-white/10 space-y-3 sm:space-y-4 text-center">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-amber-400 font-bold text-xs">
                      <Smartphone size={15} className="shrink-0" />
                      <span className="text-left">{t("Scan with WhatsApp Camera")}</span>
                    </div>
                    <button
                      onClick={handleRefreshQR}
                      disabled={refreshingQR}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/15 active:scale-95 text-gray-300 hover:text-white rounded-lg text-[10px] sm:text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0">
                      <RefreshCw size={12} className={refreshingQR ? 'animate-spin text-emerald-400' : ''} />
                      <span>{refreshingQR ? t("Refreshing...") : t("Refresh QR")}</span>
                    </button>
                  </div>

                  {statusData.qr ? (
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl inline-block shadow-2xl border-2 sm:border-4 border-white max-w-[190px] sm:max-w-[220px]">
                        <img 
                          src={statusData.qr} 
                          alt="WhatsApp Pairing QR" 
                          className="w-40 h-40 sm:w-52 sm:h-52 object-contain block mx-auto [image-rendering:pixelated]" 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 sm:py-8 space-y-2">
                      <RefreshCw size={24} className="animate-spin text-emerald-400 mx-auto" />
                      <p className="text-xs text-gray-300 font-bold">{t("Generating fresh pairing QR code...")}</p>
                    </div>
                  )}

                  {/* Step by step guide */}
                  <div className="text-[11px] sm:text-xs text-left bg-slate-900/90 p-3 sm:p-3.5 rounded-xl border border-white/10 space-y-1 sm:space-y-1.5 font-medium">
                    <p className="text-amber-300 font-bold text-[11px] flex items-center gap-1.5 mb-1">
                      <Info size={13} className="shrink-0" />
                      <span>{t("Crucial: Do NOT scan with Google Lens or standard phone camera!")}</span>
                    </p>
                    <p className="text-gray-300">1. {t("Open WhatsApp on your mobile phone")}</p>
                    <p className="text-gray-300">2. {t("Tap 3 dots (⋮) or Settings ➔ Linked Devices ➔ Link a Device")}</p>
                    <p className="text-gray-300">3. {t("Point your phone camera directly at the QR code above")}</p>
                  </div>
                </div>
              )}

              {/* Method 2: Phone Pairing Code Tab (100% Reliable without Camera) */}
              {connectTab === 'pairing' && (
                <div className="bg-slate-800/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border border-emerald-500/30 space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <ShieldCheck size={16} className="shrink-0" />
                    <span>{t("Link via 8-Digit Pairing Code (No Camera Needed)")}</span>
                  </div>

                  <p className="text-[11px] sm:text-xs text-gray-300 leading-relaxed">
                    {t("Enter your WhatsApp phone number below to generate a secure 8-character pairing code. This works 100% reliably without camera glare or scan issues!")}
                  </p>

                  {/* Phone input & generate button */}
                  <form onSubmit={handleRequestPairingCode} className="space-y-3">
                    <div className="flex gap-1.5 sm:gap-2">
                      <div className="flex items-center bg-slate-900 border border-white/15 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 flex-1 min-w-0 focus-within:border-[#25D366] transition-colors">
                        <span className="text-xs font-black text-gray-400 mr-1.5 sm:mr-2 shrink-0">+91</span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={pairPhone}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9]/g, '');
                            if (val.length === 12 && val.startsWith('91')) val = val.slice(2);
                            setPairPhone(val);
                          }}
                          placeholder={t("10-digit mobile number")}
                          className="bg-transparent text-white font-mono font-bold text-xs sm:text-sm focus:outline-none w-full placeholder:text-gray-600 min-w-0"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loadingPairing}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap">
                        {loadingPairing ? <RefreshCw size={14} className="animate-spin" /> : null}
                        <span>{loadingPairing ? t("Generating...") : t("Get Code")}</span>
                      </button>
                    </div>
                  </form>

                  {/* Pairing Code Display */}
                  {pairingCode && (
                    <div className="bg-slate-900/95 border-2 border-[#25D366]/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center space-y-2 sm:space-y-3 shadow-xl animate-in zoom-in-95">
                      <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest block">
                        {t("Your 8-Digit Pairing Code:")}
                      </span>
                      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                        <div className="text-xl sm:text-2xl md:text-3xl font-black font-mono tracking-wider sm:tracking-widest text-[#25D366] bg-black/40 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-emerald-500/30 select-all break-all">
                          {pairingCode}
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl text-white transition-all cursor-pointer shrink-0"
                          title="Copy Code">
                          {copiedCode ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                        </button>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-gray-400">
                        {copiedCode ? <span className="text-emerald-400 font-bold">{t("Copied to clipboard! ✓")}</span> : t("Code expires in 60 seconds")}
                      </p>

                      {/* Live Sync Status & Manual Verify Button */}
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2 sm:p-2.5 mt-2">
                        <div className="flex items-center gap-2 text-left min-w-0 pr-1">
                          <span className="flex h-2.5 w-2.5 relative shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          <span className="text-[11px] font-bold text-emerald-300 truncate">
                            {t("Waiting for WhatsApp approval...")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={fetchStatus}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                        >
                          <RefreshCw size={11} />
                          <span>{t("Check Status")}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3 Step Instructions for Phone Code */}
                  <div className="text-[11px] sm:text-xs text-left bg-slate-900/90 p-3 sm:p-3.5 rounded-xl border border-white/10 space-y-1.5 sm:space-y-2 font-medium">
                    <p className="text-emerald-400 font-bold text-[10px] sm:text-[11px] uppercase tracking-wider">
                      {t("How to enter code on WhatsApp:")}
                    </p>
                    <p className="text-gray-300 leading-relaxed">
                      1. {t("Open WhatsApp on your phone ➔ Settings / 3 dots (⋮) ➔ Linked Devices ➔ Link a Device")}
                    </p>
                    <p className="text-gray-300 leading-relaxed">
                      2. {t("Tap ")}
                      <span className="text-amber-300 font-bold underline">
                        "{t("Link with phone number instead")}"
                      </span>
                      {t(" at the bottom of your phone screen")}
                    </p>
                    <p className="text-gray-300 leading-relaxed">
                      3. {t("Type the 8-digit code")} (<span className="font-mono text-emerald-400 font-bold">{pairingCode || 'XXXX-XXXX'}</span>). {t("It connects instantly!")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default WhatsAppConnectModal;
