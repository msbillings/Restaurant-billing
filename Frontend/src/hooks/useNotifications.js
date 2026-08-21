import { useState, useEffect, useCallback, useRef } from 'react';
import realtimeService from '../services/realtimeService';
import api from '../api/axios';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';

// ── 1. BULLETPROOF OFFLINE WEB AUDIO CHIME ENGINE ────────────────────────────
// Works 100% offline, on Android APK, iOS IPA, macOS DMG, Windows EXE, and Vercel
let audioCtx = null;
let lastChimeTime = 0;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

// Auto-unlock AudioContext on the first user touch/click in mobile WebViews (.apk & .ipa)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        ['touchstart', 'touchend', 'click', 'keydown'].forEach(evt =>
          window.removeEventListener(evt, unlockAudio)
        );
      }).catch(() => {});
    }
  };
  ['touchstart', 'touchend', 'click', 'keydown'].forEach(evt =>
    window.addEventListener(evt, unlockAudio, { passive: true })
  );
}

/**
 * Plays a pleasant, harmonic restaurant notification chime (D5 -> A5 bell curve)
 */
export const playNotificationSound = () => {
  const now = Date.now();
  if (now - lastChimeTime < 2500) return; // Debounce
  lastChimeTime = now;

  try {
    const ctx = getAudioContext();
    if (ctx) {
      const audioTime = ctx.currentTime;

      // Bell Tone 1 (D5 ~587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioTime);
      gain1.gain.setValueAtTime(0.28, audioTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.55);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(audioTime);
      osc1.stop(audioTime + 0.6);

      // Bell Tone 2 (A5 ~880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, audioTime + 0.12);
      gain2.gain.setValueAtTime(0.35, audioTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(audioTime + 0.12);
      osc2.stop(audioTime + 0.9);
      return;
    }
  } catch (err) {
    console.warn('[useNotifications] Web Audio chime:', err);
  }

  // Fallback to HTML5 audio if Web Audio is unavailable
  try {
    const fallbackAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    fallbackAudio.play().catch(() => {});
  } catch (e) {}
};

export const getNotificationSocket = () => {
  return realtimeService.getSocket();
};

// ── 2.5 CAPACITOR ANDROID NOTIFICATION CHANNEL & PERMISSION AUTO-INIT ────────
let isChannelInitialized = false;
export const initCapacitorNotifications = async () => {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform() || isChannelInitialized) return;
  try {
    // 1. Runtime permission request (Mandatory for Android 13+ / API 33+)
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // 2. High-Priority Notification Channel (Mandatory for Android 8.0+)
    await LocalNotifications.createChannel({
      id: 'restaurant_orders',
      name: 'Restaurant Orders & KOT',
      description: 'High-priority notifications for new orders, KOT updates, and table service',
      importance: 5, // High / Max (Popup + Sound + Heads Up)
      visibility: 1, // Public
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#EA580C'
    });
    isChannelInitialized = true;
    console.log('[useNotifications] Native High-Priority Notification Channel initialized');
  } catch (err) {
    console.warn('[useNotifications] Capacitor notification init:', err);
  }
};

// ── 3. ROLE-BASED NOTIFICATION FILTERING HELPER ─────────────────────────────
export const isNotificationForRole = (notification, role = 'Admin') => {
  if (!notification) return false;
  const userRole = (role || 'Admin').trim().toLowerCase();
  if (userRole === 'admin' || userRole === 'manager') return true; // Admin & Manager see all

  const targetRoles = Array.isArray(notification.targetRoles)
    ? notification.targetRoles.map(r => String(r).toLowerCase())
    : [];

  const title = (notification.title || '').toLowerCase();
  const msg = (notification.message || '').toLowerCase();
  const notifType = (notification.data?.type || notification.type || '').toLowerCase();

  // 🍳 Role: Chef / Kitchen / KDS
  if (userRole === 'chef' || userRole === 'kds') {
    // Exclude waiter calls, water requests, bill payment requests, cancellations & withdrawals
    if (
      title.includes('water') ||
      title.includes('call waiter') ||
      title.includes('pay the bill') ||
      title.includes('cancel') ||
      title.includes('withdrawn') ||
      msg.includes('need water') ||
      msg.includes('call waiter') ||
      msg.includes('pay the bill') ||
      msg.includes('cancel') ||
      msg.includes('withdrawn') ||
      notifType === 'service_request' ||
      notifType === 'cancel_item_request' ||
      notifType === 'cancel_item_withdrawn'
    ) {
      return false;
    }

    if (
      targetRoles.includes('chef') ||
      targetRoles.includes('kds') ||
      title.includes('kot') ||
      title.includes('order placed') ||
      title.includes('order updated') ||
      title.includes('item quantity') ||
      title.includes('kitchen') ||
      title.includes('food') ||
      notifType.includes('kot') ||
      notifType.includes('kitchen') ||
      notifType.includes('order')
    ) {
      return true;
    }
    return false;
  }

  // 🤵 Role: Captain / Waiter
  if (userRole === 'captain' || userRole === 'waiter') {
    if (
      targetRoles.includes('captain') ||
      targetRoles.includes('waiter') ||
      title.includes('service') ||
      title.includes('waiter') ||
      title.includes('water') ||
      title.includes('cutlery') ||
      title.includes('food ready') ||
      title.includes('kot accepted') ||
      title.includes('cancel') ||
      title.includes('withdrawn') ||
      notifType.includes('cancel') ||
      notifType.includes('service')
    ) {
      return true;
    }
    return false;
  }

  // 💵 Role: Cashier
  if (userRole === 'cashier') {
    if (
      targetRoles.includes('cashier') ||
      title.includes('pay the bill') ||
      title.includes('bill') ||
      title.includes('payment') ||
      title.includes('settle') ||
      title.includes('due') ||
      title.includes('cancel') ||
      msg.includes('pay the bill') ||
      notifType.includes('bill') ||
      notifType.includes('cancel')
    ) {
      return true;
    }
    return false;
  }

  // Generic fallback if targetRoles contains role
  return targetRoles.length === 0 || targetRoles.includes(userRole);
};

// Robust helper to determine if a notification is the cancellation request targeted by criteria
const isTargetCancelNotification = (n, criteria) => {
  if (!n || !criteria) return false;
  if (criteria.id && n.id === criteria.id) return true;

  const isCancelReq = n.data?.type === 'cancel_item_request' || (n.title && n.title.includes('Cancel Req'));
  if (!isCancelReq) return false;

  // 1. Direct itemId match
  if (criteria.itemId && n.data?.itemId && String(n.data.itemId) === String(criteria.itemId)) {
    return true;
  }

  // 2. Item Name match (case-insensitive substring or exact match)
  const targetItemName = (criteria.itemName || criteria.name || '').trim().toLowerCase();
  if (targetItemName) {
    const notifItemName = (n.data?.itemName || '').trim().toLowerCase();
    const notifMsg = (n.message || '').trim().toLowerCase();
    if (
      (notifItemName && notifItemName === targetItemName) ||
      (notifMsg && notifMsg.includes(targetItemName)) ||
      (targetItemName && notifItemName && targetItemName.includes(notifItemName) && notifItemName.length > 3)
    ) {
      return true;
    }
  }

  // 3. Order ID match
  if (criteria.orderId && n.data?.orderId && String(n.data.orderId) === String(criteria.orderId)) {
    if (!criteria.itemName || (n.message && n.message.toLowerCase().includes((criteria.itemName || '').toLowerCase()))) {
      return true;
    }
  }

  return false;
};

// ── 4. MAIN USE_NOTIFICATIONS HOOK ──────────────────────────────────────────
const useNotifications = (userRole = 'Admin') => {
  const getTenantKey = () => localStorage.getItem('resto_db_name') || 'default';
  const roleKey = (userRole || 'Admin').toLowerCase();
  const knownNotifIdsRef = useRef(new Set());
  const isInitialLoadDoneRef = useRef(false);

  const [notifications, setNotifications] = useState(() => {
    try {
      const tenantKey = getTenantKey();
      const saved = localStorage.getItem(`realtime_notifications_${tenantKey}_${roleKey}`) ||
                    localStorage.getItem(`realtime_notifications_${tenantKey}`) ||
                    localStorage.getItem('realtime_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;

        // Collect all withdrawn items from saved notifications
        const withdrawnItems = [];
        parsed.forEach(n => {
          if (n.data?.type === 'cancel_item_withdrawn' || (n.title && n.title.includes('Cancel Withdrawn'))) {
            withdrawnItems.push({
              itemId: n.data?.itemId,
              itemName: n.data?.itemName,
              orderId: n.data?.orderId,
              message: n.message
            });
          }
        });

        const filtered = parsed
          .filter(n => {
            const t = new Date(n.time || n.timestamp || Date.now()).getTime();
            if (t <= twoDaysAgo) return false;

            // If this is an old cancel request for an item that has a corresponding withdrawal, purge it!
            const isCancelReq = n.data?.type === 'cancel_item_request' || (n.title && n.title.includes('Cancel Req'));
            if (isCancelReq) {
              for (const w of withdrawnItems) {
                if (isTargetCancelNotification(n, w)) return false;
              }
            }
            return true;
          })
          .filter(n => isNotificationForRole(n, userRole));

        filtered.forEach(n => {
          if (n.id) knownNotifIdsRef.current.add(String(n.id));
        });

        return filtered;
      }
    } catch (e) {
      console.error('Failed to parse realtime notifications', e);
    }
    return [];
  });

  const [unreadCount, setUnreadCount] = useState(() => {
    try {
      const tenantKey = getTenantKey();
      return parseInt(
        localStorage.getItem(`realtime_unread_count_${tenantKey}_${roleKey}`) ||
        localStorage.getItem(`realtime_unread_count_${tenantKey}`) ||
        localStorage.getItem('realtime_unread_count') || '0',
        10
      );
    } catch {
      return 0;
    }
  });

  // Save to localStorage whenever notifications change (tenant + role scoped)
  useEffect(() => {
    const tenantKey = getTenantKey();
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    const freshNotifs = notifications.filter(n => {
      const t = new Date(n.time || n.timestamp || Date.now()).getTime();
      return t > twoDaysAgo;
    });
    // Save to role-scoped key ONLY — do NOT write to shared key which would pollute other roles
    localStorage.setItem(`realtime_notifications_${tenantKey}_${roleKey}`, JSON.stringify(freshNotifs));
  }, [notifications, roleKey]);

  useEffect(() => {
    const tenantKey = getTenantKey();
    localStorage.setItem(`realtime_unread_count_${tenantKey}_${roleKey}`, unreadCount.toString());
  }, [unreadCount, roleKey]);

  // Dispatch Native Notification Helper (Android APK & iOS)
  const triggerNativeNotification = (notification) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title || 'New Notification',
            body: notification.message || '',
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 50) },
            sound: 'beep.wav',
            channelId: 'restaurant_orders', // High priority channel for Android
            actionTypeId: '',
            extra: notification.data || null
          }
        ]
      }).catch(e => console.warn('Failed to schedule native notification', e));
    } catch (e) {
      console.warn('LocalNotifications plugin error', e);
    }
  };

  // Fetch active notifications from backend database (with smart fallback detection for Vercel/offline)
  const fetchActiveNotifications = async (isBackgroundPoll = false) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return;

      const res = await api.get('/bills/active-notifications');
      if (Array.isArray(res.data)) {
        // Filter by role
        const roleFiltered = res.data.filter(n => isNotificationForRole(n, userRole));
        const now = Date.now();
        const freshWindow = 3 * 60 * 1000; // 3 minutes window for triggering chimes on newly polled items

        let hasNewIncoming = false;

        // On background polling, detect newly arrived items that were not seen before
        if (isBackgroundPoll && isInitialLoadDoneRef.current) {
          roleFiltered.forEach(n => {
            const notifId = String(n.id || n._id || '');
            if (notifId && !knownNotifIdsRef.current.has(notifId)) {
              knownNotifIdsRef.current.add(notifId);
              const notifTime = new Date(n.time || n.timestamp || n.createdAt || now).getTime();
              // If notification was created recently, trigger chime & native push
              if (now - notifTime <= freshWindow) {
                hasNewIncoming = true;
                triggerNativeNotification(n);
              }
            }
          });

          if (hasNewIncoming) {
            playNotificationSound();
            setUnreadCount(prev => prev + 1);
          }
        } else {
          // Initial population of known IDs
          roleFiltered.forEach(n => {
            if (n.id) knownNotifIdsRef.current.add(String(n.id));
          });
          isInitialLoadDoneRef.current = true;
        }

        setNotifications(prev => {
          const newMap = new Map();
          roleFiltered.forEach(n => newMap.set(n.id, n));
          prev.forEach(n => {
            if (!newMap.has(n.id) && isNotificationForRole(n, userRole)) {
              newMap.set(n.id, n);
            }
          });
          return Array.from(newMap.values()).sort((a, b) => {
            const timeA = new Date(a.time || a.timestamp || 0);
            const timeB = new Date(b.time || b.timestamp || 0);
            return timeB - timeA;
          });
        });
      }
    } catch (err) {
      console.warn('[useNotifications] Active notifications fetch:', err.message);
    }
  };

  // ── 5. LIFECYCLE & FALLBACK POLLING ENGINE ─────────────────────────────────
  useEffect(() => {
    // 1. Initialize Capacitor Android Notification Channel & Permissions
    initCapacitorNotifications();

    // 2. Initial fetch
    fetchActiveNotifications(false);
    const handleLogin = () => fetchActiveNotifications(false);
    window.addEventListener('loginSuccess', handleLogin);

    // 3. Fallback Adaptive Polling for Vercel & Socket.io Disconnection
    // Checks every 6 seconds (or 15s in background) to guarantee notifications arrive even on serverless hosting
    const pollInterval = setInterval(() => {
      const socket = realtimeService.getSocket();
      const isSocketDisconnected = !socket || !socket.connected;
      const isVercelHost = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

      // Poll if socket is disconnected, running on Vercel, or on native APK
      if (isSocketDisconnected || isVercelHost || Capacitor.isNativePlatform()) {
        fetchActiveNotifications(true);
      }
    }, 6000);

    // 4. Tab focus & visibility change listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchActiveNotifications(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 5. Capacitor native app state listener
    let appStateListener;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('[useNotifications] App returned to foreground. Syncing notifications...');
          realtimeService.rejoinTenant();
          fetchActiveNotifications(false);
        }
      }).then(listener => {
        appStateListener = listener;
      }).catch(err => console.warn('App state listener failed', err));
    }

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('loginSuccess', handleLogin);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (appStateListener) appStateListener.remove();
    };
  }, [userRole]);

  // ── 6. REAL-TIME WEBSOCKET SUBSCRIPTIONS ──────────────────────────────────
  useEffect(() => {
    const handleNewNotification = (notification) => {
      if (!notification) return;

      // 1. Strict Tenant Filtering on Client
      const activeTenant = localStorage.getItem('resto_db_name');
      if (notification.tenantDb && activeTenant && notification.tenantDb !== activeTenant) {
        console.warn(`[useNotifications] Blocked notification from other tenant (${notification.tenantDb} != ${activeTenant})`);
        return;
      }

      // 2. Strict Role-Based Filtering
      if (!isNotificationForRole(notification, userRole)) {
        return;
      }

      const notifId = String(notification.id || '');
      if (notifId) knownNotifIdsRef.current.add(notifId);

      setNotifications((prev) => {
        let updatedList = prev;

        // If this new notification is a withdrawal notification, immediately remove previous cancel request notifications!
        const isWithdrawnNotice = notification.data?.type === 'cancel_item_withdrawn' || (notification.title && notification.title.includes('Cancel Withdrawn'));
        if (isWithdrawnNotice) {
          const criteria = {
            itemId: notification.data?.itemId,
            itemName: notification.data?.itemName,
            orderId: notification.data?.orderId,
            message: notification.message
          };
          updatedList = updatedList.filter(n => !isTargetCancelNotification(n, criteria));
        }

        // Deduplicate: Don't add if we already have this notification ID
        if (updatedList.some(n => n.id === notification.id)) return updatedList;
        return [notification, ...updatedList];
      });
      
      setUnreadCount((prev) => prev + 1);
      // Play sound only for notifications meant for this role
      playNotificationSound();

      // Trigger native system notification on Mobile (APK/IPA)
      triggerNativeNotification(notification);
    };

    const handleDismissNotification = (criteria) => {
      if (!criteria) return;
      setNotifications((prev) => prev.filter((n) => !isTargetCancelNotification(n, criteria)));
    };

    const handleItemCancellationWithdrawn = (data) => {
      if (!data) return;
      setNotifications((prev) => prev.filter((n) => !isTargetCancelNotification(n, data)));
    };

    const handleCancellationResolved = (data) => {
      if (!data) return;
      setNotifications((prev) => prev.filter((n) => !isTargetCancelNotification(n, data)));
    };

    const unsubNotif = realtimeService.subscribe('new_notification', handleNewNotification);
    const unsubDismiss = realtimeService.subscribe('dismiss_notification', handleDismissNotification);
    const unsubWithdrawn = realtimeService.subscribe('itemCancellationWithdrawn', handleItemCancellationWithdrawn);
    const unsubResolved = realtimeService.subscribe('cancellationResolved', handleCancellationResolved);

    return () => {
      unsubNotif();
      unsubDismiss();
      unsubWithdrawn();
      unsubResolved();
    };
  }, [userRole]);

  const markAllAsRead = () => {
    setUnreadCount(0);
    try {
      const tenantKey = getTenantKey();
      // Strictly role-scoped: only write read IDs for THIS role's key - do NOT touch other role keys
      const readKey = `realtime_read_ids_${tenantKey}_${roleKey}`;
      const existingRead = JSON.parse(localStorage.getItem(readKey) || '[]');
      const allNotifIds = notifications.map(n => n.id);
      const combined = Array.from(new Set([...existingRead, ...allNotifIds]));
      localStorage.setItem(readKey, JSON.stringify(combined));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  const clearNotification = (id) => {
    if (id === 'ALL') {
      // Strictly role-scoped clear: ONLY remove THIS role's notifications from localStorage
      // Other roles (Admin, Captain, Cashier) are NOT affected
      setNotifications([]);
      setUnreadCount(0);
      try {
        const tenantKey = getTenantKey();
        localStorage.removeItem(`realtime_notifications_${tenantKey}_${roleKey}`);
        localStorage.setItem(`realtime_unread_count_${tenantKey}_${roleKey}`, '0');
        // Also clear the shared key ONLY if we are admin/manager (full clear)
        const isAdminRole = roleKey === 'admin' || roleKey === 'manager';
        if (isAdminRole) {
          localStorage.removeItem(`realtime_notifications_${tenantKey}`);
          localStorage.setItem(`realtime_unread_count_${tenantKey}`, '0');
        }
      } catch (e) {
        console.error('Error clearing notifications:', e);
      }
    } else {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return { notifications, unreadCount, markAllAsRead, clearNotification };
};

export default useNotifications;
