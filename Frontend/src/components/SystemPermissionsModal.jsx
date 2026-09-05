import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Camera, MapPin, Mic, Bell, ShieldCheck, Loader2, CheckCircle2, XCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { 
  requestCameraPermissions, 
  requestLocationPermissions, 
  requestMicPermissions, 
  requestNotificationPermissions,
  checkAllPermissions,
  openAppSettings
} from '../services/permissionsService';

const isNative = Capacitor.isNativePlatform();

const StatusIcon = ({ status }) => {
  if (status === 'granted') return <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300/80"><CheckCircle2 size={14} /> Granted</span>;
  if (status === 'denied') return <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-red-700 bg-red-100/90 px-2.5 py-0.5 rounded-full border border-red-300/80"><XCircle size={14} /> Denied</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-orange-700 bg-orange-100/90 px-2.5 py-0.5 rounded-full border border-orange-300/80">Ready</span>;
};

const SystemPermissionsModal = ({ onComplete }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [statusMsg, setStatusMsg] = useState(null);
  const [hasDenied, setHasDenied] = useState(false);
  const [selected, setSelected] = useState({
    camera: true,
    location: true,
    mic: true,
    notifications: true
  });
  // Current status: 'granted' | 'denied' | 'prompt'
  const [permStatus, setPermStatus] = useState({
    camera: 'prompt',
    mic: 'prompt',
    location: 'prompt',
    notifications: 'prompt'
  });

  // Check current permission statuses on mount
  useEffect(() => {
    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const statuses = await checkAllPermissions();
        setPermStatus(statuses);
        if (isNative) {
          const anyDenied = Object.values(statuses).some(s => s === 'denied');
          setHasDenied(anyDenied);
        }
        setSelected({
          camera: statuses.camera !== 'granted',
          location: statuses.location !== 'granted',
          mic: statuses.mic !== 'granted',
          notifications: statuses.notifications !== 'granted',
        });
      } catch (err) {
        console.warn('Could not check permissions:', err);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, []);

  const refreshStatuses = async () => {
    try {
      const statuses = await checkAllPermissions();
      setPermStatus(statuses);
      if (isNative) {
        const anyDenied = Object.values(statuses).some(s => s === 'denied');
        setHasDenied(anyDenied);
      }
      return statuses;
    } catch (err) {
      console.warn('Could not refresh permission status:', err);
      return null;
    }
  };

  const requestSinglePermission = async (key) => {
    if (permStatus[key] === 'granted') return;
    setLoading(true);
    try {
      if (key === 'notifications') {
        setStatusMsg(t('Requesting Notifications...'));
        await requestNotificationPermissions();
      } else if (key === 'camera') {
        setStatusMsg(t('Requesting Camera...'));
        await requestCameraPermissions();
      } else if (key === 'location') {
        setStatusMsg(t('Requesting Location...'));
        await requestLocationPermissions();
      } else if (key === 'mic') {
        setStatusMsg(t('Requesting Microphone...'));
        await requestMicPermissions();
      }
      await refreshStatuses();
    } catch (err) {
      console.warn(`Failed requesting permission for ${key}`, err);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key) => {
    if (permStatus[key] === 'granted') return;
    requestSinglePermission(key);
  };

  const requestAllPermissions = async () => {
    setLoading(true);
    try {
      // 1. Notifications first
      if (permStatus.notifications !== 'granted') {
        setStatusMsg(t('Requesting Notifications...'));
        await requestNotificationPermissions();
      }
      
      // 2. Camera for AI face attendance / QR
      if (permStatus.camera !== 'granted') {
        setStatusMsg(t('Requesting Camera...'));
        await requestCameraPermissions();
      }

      // 3. Location for delivery
      if (permStatus.location !== 'granted') {
        setStatusMsg(t('Requesting Location...'));
        await requestLocationPermissions();
      }

      // 4. Mic for voice
      if (permStatus.mic !== 'granted') {
        setStatusMsg(t('Requesting Microphone...'));
        await requestMicPermissions();
      }

      await refreshStatuses();
    } catch (err) {
      console.warn("Some permissions were denied or failed", err);
    } finally {
      setLoading(false);
      onComplete();
    }
  };

  const allGranted = Object.values(permStatus).every(s => s === 'granted');

  const permItems = [
    {
      key: 'notifications',
      icon: Bell,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-100 border-orange-200',
      label: t("Push & Local Notifications"),
      desc: t("Instant popups & sounds for digital orders & KOTs.")
    },
    {
      key: 'camera',
      icon: Camera,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100 border-blue-200',
      label: t("Camera Access"),
      desc: t("Required for AI Face Attendance & QR Scanning.")
    },
    {
      key: 'location',
      icon: MapPin,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-100 border-emerald-200',
      label: t("Location Services"),
      desc: t("Required for delivery & store geo-verification.")
    },
    {
      key: 'mic',
      icon: Mic,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-100 border-purple-200',
      label: t("Microphone"),
      desc: t("Required for AI voice command billing.")
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-2.5 sm:p-4 overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      <div className="bg-white text-gray-900 rounded-2xl sm:rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full my-auto overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 bg-gradient-to-b from-orange-100/60 via-orange-50/30 to-white flex flex-col items-center border-b border-gray-100 text-center shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-500 text-white border border-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/25 mb-2 sm:mb-3">
            <ShieldCheck size={28} className="sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
            {t("App Permissions Setup")}
          </h2>
          <p className="text-[12px] sm:text-xs text-gray-600 font-medium mt-1 max-w-xs">
            {checkingStatus
              ? t("Checking system permission status...")
              : t("Allow the required permissions below for smooth billing, instant order alerts, and AI features.")}
          </p>
        </div>

        {/* Scrollable Permissions List */}
        <div className="p-3.5 sm:p-5 space-y-2.5 sm:space-y-3 overflow-y-auto flex-1 overscroll-contain">
          {checkingStatus ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={32} className="animate-spin text-orange-500" />
              <p className="text-xs text-gray-500 font-medium">{t("Scanning hardware permissions...")}</p>
            </div>
          ) : (
            permItems.map(({ key, icon: Icon, iconColor, iconBg, label, desc }) => {
              const status = permStatus[key];
              const isDenied = status === 'denied';
              const isGranted = status === 'granted';

              return (
                <div
                  key={key}
                  onClick={() => toggle(key)}
                  className={`flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${
                    isGranted 
                      ? 'bg-emerald-50/80 border-emerald-200 cursor-default' 
                      : isDenied 
                      ? 'bg-red-50/80 border-red-200 cursor-pointer' 
                      : 'bg-gray-50 border-gray-200 hover:bg-orange-50/60 hover:border-orange-300 cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 border`}>
                      <Icon size={18} className={`sm:w-5 sm:h-5 ${iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">{label}</p>
                      <p className={`text-[11px] sm:text-xs truncate ${isDenied ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {isDenied && isNative ? t("Denied — tap to grant or fix in Settings") : desc}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <StatusIcon status={status} />
                  </div>
                </div>
              );
            })
          )}

          {/* Open Settings hint for native if any are denied */}
          {isNative && hasDenied && !checkingStatus && (
            <button
              onClick={openAppSettings}
              className="w-full py-2.5 px-3 border border-orange-300 bg-orange-50 text-orange-800 rounded-xl font-semibold text-[11px] sm:text-xs flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors"
            >
              <ExternalLink size={14} />
              {t("Open Device Settings to unlock denied permissions")}
            </button>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-5 pt-2 sm:pt-3 border-t border-gray-100 bg-gray-50/80 shrink-0 space-y-2">
          <button
            onClick={allGranted ? onComplete : requestAllPermissions}
            disabled={loading || checkingStatus}
            className={`w-full py-3 sm:py-3.5 font-black text-sm sm:text-base rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98] ${
              allGranted
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span className="truncate">{statusMsg || t("Granting permissions...")}</span>
              </>
            ) : allGranted ? (
              <>
                <CheckCircle2 size={18} />
                <span>{t("All Permissions Granted — Continue")}</span>
              </>
            ) : (
              <>
                <span>{t("Allow All Permissions")}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {!allGranted && !loading && (
            <button
              onClick={onComplete}
              className="w-full py-1.5 text-center text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            >
              {t("Skip for now (some features may be restricted)")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemPermissionsModal;
