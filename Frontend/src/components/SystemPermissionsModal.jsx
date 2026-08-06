import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Camera, MapPin, Mic, Bell, ShieldCheck, Loader2, CheckCircle2, XCircle, HelpCircle, ExternalLink } from 'lucide-react';
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
  if (status === 'granted') return <CheckCircle2 className="text-success" size={22} />;
  if (status === 'denied') return <XCircle className="text-danger" size={22} />;
  return <HelpCircle className="text-text-muted" size={22} />;
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
        // If any are denied on a native platform, show the Open Settings hint
        if (isNative) {
          const anyDenied = Object.values(statuses).some(s => s === 'denied');
          setHasDenied(anyDenied);
        }
        // Auto-deselect already granted ones (no need to re-request)
        setSelected(prev => ({
          camera: statuses.camera !== 'granted',
          location: statuses.location !== 'granted',
          mic: statuses.mic !== 'granted',
          notifications: statuses.notifications !== 'granted',
        }));
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
      if (key === 'camera') {
        setStatusMsg('Requesting Camera...');
        await requestCameraPermissions();
      } else if (key === 'location') {
        setStatusMsg('Requesting Location...');
        await requestLocationPermissions();
      } else if (key === 'mic') {
        setStatusMsg('Requesting Microphone...');
        await requestMicPermissions();
      } else if (key === 'notifications') {
        setStatusMsg('Requesting Notifications...');
        await requestNotificationPermissions();
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

  const requestPermissions = async () => {
    setLoading(true);
    try {
      if (selected.camera && permStatus.camera !== 'granted') {
        setStatusMsg('Requesting Camera...');
        await requestCameraPermissions();
      }
      
      if (selected.mic && permStatus.mic !== 'granted') {
        setStatusMsg('Requesting Microphone...');
        await requestMicPermissions();
      }

      if (selected.notifications && permStatus.notifications !== 'granted') {
        setStatusMsg('Requesting Notifications...');
        await requestNotificationPermissions();
      }

      if (selected.location && permStatus.location !== 'granted') {
        setStatusMsg('Requesting Location...');
        await requestLocationPermissions();
      }
      await refreshStatuses();
    } catch (err) {
      console.warn("Some permissions were denied or failed", err);
    } finally {
      setLoading(false);
      onComplete();
    }
  };

  const permItems = [
    {
      key: 'camera',
      icon: Camera,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/20',
      label: t("Camera"),
      desc: t("Required for AI Face Attendance.")
    },
    {
      key: 'location',
      icon: MapPin,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/20',
      label: t("Location"),
      desc: t("Required for delivery tracking.")
    },
    {
      key: 'mic',
      icon: Mic,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/20',
      label: t("Microphone"),
      desc: t("Required for voice commands.")
    },
    {
      key: 'notifications',
      icon: Bell,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/20',
      label: t("Notifications"),
      desc: t("Instant alerts for KOTs.")
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] animate-in fade-in duration-300">
      <div className="bg-surface rounded-3xl border border-border shadow-2xl max-w-lg w-full mx-4 overflow-hidden relative">
        
        <div className="px-8 py-6 bg-linear-to-r from-primary/20 to-primary/5 flex flex-col items-center border-b border-border text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shadow-inner mb-4">
            <ShieldCheck size={36} />
          </div>
          <h2 className="text-2xl font-black text-text-main tracking-tight">
            {t("System Permissions")}
          </h2>
          <p className="text-sm text-text-muted font-medium mt-2">
            {checkingStatus
              ? t("Checking current permission status...")
              : t("Select the permissions you want to grant for this application.")}
          </p>
        </div>

        <div className="p-8 space-y-4">

          {checkingStatus ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {permItems.map(({ key, icon: Icon, iconColor, iconBg, label, desc }) => {
                const status = permStatus[key];
                const isDenied = status === 'denied';
                const isGranted = status === 'granted';
                const isSelected = selected[key];

                return (
                  <div
                    key={key}
                    onClick={() => toggle(key)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-colors
                      ${isGranted ? 'bg-success/10 border-success/30 cursor-default' :
                        isDenied ? 'bg-danger/10 border-danger/30 cursor-default' :
                        isSelected ? 'bg-primary/10 border-primary/30 cursor-pointer' :
                        'bg-background border-border hover:bg-surface-hover cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${iconBg} ${iconColor} flex items-center justify-center`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-text-main">{label}</p>
                        <p className={`text-xs ${isDenied ? 'text-danger font-semibold' : 'text-text-muted'}`}>
                          {isDenied && isNative ? t("Denied — open Settings to enable") : desc}
                        </p>
                      </div>
                    </div>
                    <StatusIcon status={isGranted ? 'granted' : isDenied ? 'denied' : isSelected ? 'prompt' : 'none'} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Open Settings hint for native when some are denied */}
          {isNative && hasDenied && !checkingStatus && (
            <button
              onClick={openAppSettings}
              className="w-full py-3 border border-border text-text-muted rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-surface-hover transition-colors"
            >
              <ExternalLink size={16} />
              {t("Open Device Settings to fix denied permissions")}
            </button>
          )}

          <div className="pt-2">
            <button
              onClick={requestPermissions}
              disabled={loading || checkingStatus}
              className="w-full py-4 bg-primary text-primary-foreground font-black text-lg rounded-xl shadow-lg shadow-primary/30 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  {statusMsg}
                </>
              ) : (
                t("Proceed & Grant")
              )}
            </button>
            <p className="text-center text-xs text-text-muted mt-4">
              {t("You only need to do this once.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPermissionsModal;
