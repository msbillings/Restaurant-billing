import { useState, useEffect, useCallback, useRef } from 'react';
import realtimeService from '../services/realtimeService';
import api from '../api/axios';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
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
export const initCapacitorNotifications = async (requestPermissionNow = false) => {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
  try {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('user');

    // 1. Runtime permission request (Mandatory for Android 13+ / API 33+) - ONLY when logged in and requested!
    if (token && requestPermissionNow) {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    }

    if (!isChannelInitialized) {
      // 2. High-Priority Notification Channel (Mandatory for Android 8.0+)
      await LocalNotifications.createChannel({
        id: 'restaurant_alerts_v1',
        name: 'Restaurant Alerts',
        description: 'High-priority real-time alerts for orders and KOTs',
        importance: 5, // High / Max (Popup + Sound + Heads Up)
        visibility: 1, // Public
        vibration: true,
        lights: true,
        lightColor: '#EA580C'
      });
      isChannelInitialized = true;
    }

    // 3. Initialize Firebase Push Notifications ONLY when logged in and requested!
    if (token && requestPermissionNow) {
      let pushPermStatus = await PushNotifications.checkPermissions();
      if (pushPermStatus.receive !== 'granted') {
        pushPermStatus = await PushNotifications.requestPermissions();
      }
      
      if (pushPermStatus.receive === 'granted') {
        PushNotifications.register();
      }
    }

    // Add listeners once
    try {
      PushNotifications.addListener('registration', (token) => {
        console.log('[useNotifications] Push registration success, token:', token.value);
        // Send token to backend
        api.post('/auth/fcm-token', { token: token.value })
          .catch(err => console.error('[useNotifications] Failed to register FCM token with backend', err));
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[useNotifications] Error on FCM registration:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[useNotifications] Push received:', notification);
        playNotificationSound(); // Local chime fallback if app is open
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[useNotifications] Push action performed:', notification);
      });
    } catch (e) {}

    console.log('[useNotifications] Native High-Priority Notification Channel & FCM initialized');
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
      // Strictly load role-scoped tenant notifications — do NOT fall back to shared/global keys which resurrect stale notifications
      const saved = localStorage.getItem(`realtime_notifications_${tenantKey}_${roleKey}`);
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
        localStorage.getItem(`realtime_unread_count_${tenantKey}_${roleKey}`) || '0',
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

  // Dispatch Native Notification Helper (Windows OS .exe, Mobile APK/IPA, and Web)
  const triggerNativeNotification = (notification) => {
    if (!notification) return;
    const title = notification.title || 'New Order Notification';
    const body = notification.message || 'New order / service request received';

    // 1. Electron Desktop App (Windows .exe / macOS) -> Native Windows Action Center / Notification Panel
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.showNotification === 'function') {
      try {
        window.electronAPI.showNotification({ title, body });
      } catch (e) {
        console.warn('[useNotifications] Electron notification failed:', e);
      }
      return;
    }

    // 2. Android APK & iOS IPA (Capacitor)
    if (Capacitor.isNativePlatform()) {
      try {
        LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Math.floor(Math.random() * 1000000),
              smallIcon: 'ic_launcher',
              largeIcon: 'ic_launcher',
              iconColor: '#EA580C',
              channelId: 'restaurant_alerts_v1', // High priority channel for Android
              actionTypeId: '',
              extra: notification.data || null
            }
          ]
        }).catch(e => console.warn('Failed to schedule native notification', e));
      } catch (e) {
        console.warn('LocalNotifications plugin error', e);
      }
      return;
    }

    // 3. Web Browsers on Windows / Mac (Chrome, Edge, Firefox, Brave)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new window.Notification(title, {
          body,
          icon: '/icon.png'
        });
      } catch (e) {
        console.warn('[useNotifications] HTML5 Notification error:', e);
      }
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
        const freshWindow = 10 * 60 * 1000; // 10 minutes window for triggering chimes and popups on newly polled items

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
            // Notify active floor views and billing tables to update instantly
            window.dispatchEvent(new CustomEvent('refreshFloorOrders'));
          }
        } else {
          // Initial population of known IDs
          roleFiltered.forEach(n => {
            if (n.id) knownNotifIdsRef.current.add(String(n.id));
          });
          isInitialLoadDoneRef.current = true;
        }

        // Calculate accurate unread count from database & read IDs
        const tenantKey = getTenantKey();
        const readKey = `realtime_read_ids_${tenantKey}_${roleKey}`;
        const clearedKey = `realtime_cleared_ids_${tenantKey}_${roleKey}`;
        let readIds = new Set();
        let clearedIds = new Set();
        try {
          readIds = new Set(JSON.parse(localStorage.getItem(readKey) || '[]'));
        } catch (e) {}
        try {
          clearedIds = new Set(JSON.parse(localStorage.getItem(clearedKey) || '[]'));
        } catch (e) {}

        const visibleItems = roleFiltered.filter(n => !clearedIds.has(String(n.id)));

        setNotifications(prev => {
          const newMap = new Set();
          const seenSemantic = new Set();
          const seenCancelReqs = new Set();

          const getKey = (n) => {
            const id = String(n.id || '');
            const titleMsg = `${n.title || ''}::${n.message || ''}`;
            const timeBucket = Math.floor(new Date(n.time || n.timestamp || 0).getTime() / 5000);
            return { id, semantic: `${titleMsg}::${timeBucket}` };
          };

          const allItems = [...visibleItems, ...prev];
          const deduplicated = [];

          allItems.forEach(n => {
            if (!isNotificationForRole(n, userRole)) return;
            if (clearedIds.has(String(n.id))) return;
            const { id, semantic } = getKey(n);
            if (id && newMap.has(id)) return;
            if (seenSemantic.has(semantic)) return;

            // Extra deduplication for cancel requests: never show duplicate cancel requests for the same item
            const isCancel = n.data?.type === 'cancel_item_request' || (n.title && n.title.includes('Cancel Req'));
            if (isCancel) {
              const cancelKey = `cancel_${n.data?.orderId || ''}_${n.data?.itemId || ''}_${(n.message || '').toLowerCase().trim()}`;
              if (seenCancelReqs.has(cancelKey)) return;
              seenCancelReqs.add(cancelKey);
            }

            if (id) newMap.add(id);
            seenSemantic.add(semantic);
            deduplicated.push(n);
          });

          const merged = deduplicated.sort((a, b) => {
            const timeA = new Date(a.time || a.timestamp || 0);
            const timeB = new Date(b.time || b.timestamp || 0);
            return timeB - timeA;
          });

          // Calculate role-accurate unread count from all role notifications
          const unreadItems = merged.filter(n => !readIds.has(String(n.id)));
          setUnreadCount(unreadItems.length);

          return merged;
        });
      }
    } catch (err) {
      console.warn('[useNotifications] Active notifications fetch:', err.message);
    }
  };

  // ── 5. LIFECYCLE & UNIVERSAL REAL-TIME SYNC ENGINE ─────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('user');

    // 1. Initialize Capacitor Android Notification Channel (permissions requested ONLY if user is already logged in)
    if (token) {
      initCapacitorNotifications(false);
      // Request Web Notification permissions for browser users ONLY after login
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      // Initial fetch
      fetchActiveNotifications(false);
    }

    const handleLogin = () => {
      initCapacitorNotifications(true);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      fetchActiveNotifications(false);
    };
    window.addEventListener('loginSuccess', handleLogin);

    // 4. Universal Real-Time Polling Engine (Every 4 seconds)
    // Ensures digital menu cloud orders immediately trigger chimes, table refreshes,
    // and Windows OS toasts on .exe, .apk, and Web without relying solely on local sockets.
    const pollInterval = setInterval(() => {
      const currentToken = localStorage.getItem('accessToken') || localStorage.getItem('user');
      if (currentToken) {
        fetchActiveNotifications(true);
      }
    }, 4000);

    // 5. Visibility / Window Focus listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useNotifications] Window focused. Re-syncing notifications & socket...');
        realtimeService.rejoinTenant();
        fetchActiveNotifications(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 6. Capacitor native app state listener
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

      // Check if already cleared
      const tenantKey = getTenantKey();
      const clearedKey = `realtime_cleared_ids_${tenantKey}_${roleKey}`;
      let clearedIds = new Set();
      try {
        clearedIds = new Set(JSON.parse(localStorage.getItem(clearedKey) || '[]'));
      } catch (e) {}
      if (notification.id && clearedIds.has(String(notification.id))) return;

      const notifId = String(notification.id || '');
      if (notifId) knownNotifIdsRef.current.add(notifId);

      let isDuplicate = false;

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

        // Deduplicate: Don't add if we already have this notification ID or same message within 5 seconds
        isDuplicate = updatedList.some(n => {
          if (String(n.id) === String(notification.id)) return true;
          if (n.title === notification.title && n.message === notification.message) {
            const timeDiff = Math.abs(new Date(n.time || n.timestamp || 0) - new Date(notification.time || notification.timestamp || 0));
            if (timeDiff < 5000) return true;
          }
          // If cancel request for the same item/order already exists, ignore duplicate
          const isThisCancel = notification.data?.type === 'cancel_item_request' || (notification.title && notification.title.includes('Cancel Req'));
          const isExistingCancel = n.data?.type === 'cancel_item_request' || (n.title && n.title.includes('Cancel Req'));
          if (isThisCancel && isExistingCancel) {
            if (
              (notification.data?.itemId && n.data?.itemId && String(notification.data.itemId) === String(n.data.itemId)) ||
              (notification.message && n.message && notification.message.trim().toLowerCase() === n.message.trim().toLowerCase())
            ) {
              return true;
            }
          }
          return false;
        });

        if (isDuplicate) return updatedList;
        return [notification, ...updatedList];
      });
      
      if (!isDuplicate) {
        setUnreadCount((prev) => prev + 1);
        playNotificationSound();
        triggerNativeNotification(notification);
      }
    };

    const recordDismissedIds = (removedIds = []) => {
      if (!Array.isArray(removedIds) || removedIds.length === 0) return;
      try {
        const tenantKey = getTenantKey();
        const clearedKey = `realtime_cleared_ids_${tenantKey}_${roleKey}`;
        const current = JSON.parse(localStorage.getItem(clearedKey) || '[]');
        const updated = Array.from(new Set([...current, ...removedIds.map(String)]));
        localStorage.setItem(clearedKey, JSON.stringify(updated.slice(-300)));
      } catch (e) {}
    };

    const handleDismissNotification = (criteria) => {
      if (!criteria) return;
      if (criteria.deletedIds && Array.isArray(criteria.deletedIds)) {
        recordDismissedIds(criteria.deletedIds);
      }
      setNotifications((prev) => {
        const matchingIds = prev.filter(n => isTargetCancelNotification(n, criteria)).map(n => n.id);
        recordDismissedIds(matchingIds);
        return prev.filter((n) => !isTargetCancelNotification(n, criteria));
      });
    };

    const handleItemCancellationWithdrawn = (data) => {
      if (!data) return;
      setNotifications((prev) => {
        const matchingIds = prev.filter(n => isTargetCancelNotification(n, data)).map(n => n.id);
        recordDismissedIds(matchingIds);
        return prev.filter((n) => !isTargetCancelNotification(n, data));
      });
    };

    const handleCancellationResolved = (data) => {
      if (!data) return;
      setNotifications((prev) => {
        const matchingIds = prev.filter(n => isTargetCancelNotification(n, data)).map(n => n.id);
        recordDismissedIds(matchingIds);
        return prev.filter((n) => !isTargetCancelNotification(n, data));
      });
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
    const tenantKey = getTenantKey();
    const clearedKey = `realtime_cleared_ids_${tenantKey}_${roleKey}`;

    if (id === 'ALL') {
      const allIds = notifications.map(n => String(n.id)).filter(Boolean);
      setNotifications([]);
      setUnreadCount(0);
      try {
        const existingCleared = JSON.parse(localStorage.getItem(clearedKey) || '[]');
        const combined = Array.from(new Set([...existingCleared, ...allIds]));
        localStorage.setItem(clearedKey, JSON.stringify(combined));

        localStorage.removeItem(`realtime_notifications_${tenantKey}_${roleKey}`);
        localStorage.setItem(`realtime_unread_count_${tenantKey}_${roleKey}`, '0');
        // Also clear legacy shared keys so they never resurrect old notifications
        localStorage.removeItem(`realtime_notifications_${tenantKey}`);
        localStorage.setItem(`realtime_unread_count_${tenantKey}`, '0');
        localStorage.removeItem('realtime_notifications');
        localStorage.setItem('realtime_unread_count', '0');

        // Delete permanently from backend
        api.delete('/bills/notifications/all').catch(() => {});
      } catch (e) {
        console.error('Error clearing notifications:', e);
      }
    } else {
      const idStr = String(id);
      setNotifications((prev) => prev.filter((n) => String(n.id) !== idStr));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        const existingCleared = JSON.parse(localStorage.getItem(clearedKey) || '[]');
        existingCleared.push(idStr);
        localStorage.setItem(clearedKey, JSON.stringify(Array.from(new Set(existingCleared))));

        // Delete permanently from backend
        api.delete(`/bills/notifications/${encodeURIComponent(idStr)}`).catch(() => {});
      } catch (e) {
        console.error('Error clearing notification:', e);
      }
    }
  };

  return { notifications, unreadCount, markAllAsRead, clearNotification };
};

export default useNotifications;
