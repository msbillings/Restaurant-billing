import { getApiUrl, getSuperadminApiUrl, isCapacitorApp, isElectronApp } from "./config.js";
import React, { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import api from './api/axios';
import { useLanguage } from './context/LanguageContext';
// Lazy load components for performance
const BillingPage = React.lazy(() => import('./components/BillingPage'));
const BillHistory = React.lazy(() => import('./components/BillHistory'));
const LoginPage = React.lazy(() => import('./components/LoginPage'));
const MenuManagement = React.lazy(() => import('./components/MenuManagement'));
const ActiveOrders = React.lazy(() => import('./components/ActiveOrders'));
const Analytics = React.lazy(() => import('./components/Analytics'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const FloorManagement = React.lazy(() => import('./components/FloorManagement'));
const Settings = React.lazy(() => import('./components/Settings'));
const Operations = React.lazy(() => import('./components/Operations'));
const TaxConfig = React.lazy(() => import('./components/TaxConfig'));
const DiscountConfig = React.lazy(() => import('./components/DiscountConfig'));
const CashOperations = React.lazy(() => import('./components/CashOperations'));
const DuePayment = React.lazy(() => import('./components/DuePayment'));
const Reservation = React.lazy(() => import('./components/Reservation'));
const Feedback = React.lazy(() => import('./components/Feedback'));
const PushOrders = React.lazy(() => import('./components/PushOrders'));
const PrinterConfig = React.lazy(() => import('./components/PrinterConfig'));
const OnlineConfig = React.lazy(() => import('./components/OnlineConfig'));
const OnlineOrders = React.lazy(() => import('./components/OnlineOrders'));
const ManualSync = React.lazy(() => import('./components/ManualSync'));
const LanguageSwitcher = React.lazy(() => import('./components/LanguageSwitcher'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const PlaceholderScreen = React.lazy(() => import('./components/PlaceholderScreen'));
const MenuToggle = React.lazy(() => import('./components/MenuToggle'));
const NotificationCenter = React.lazy(() => import('./components/NotificationCenter'));
const CustomStatus = React.lazy(() => import('./components/CustomStatus'));
const LanguageProfile = React.lazy(() => import('./components/LanguageProfile'));
const SecuritySettings = React.lazy(() => import('./components/SecuritySettings'));
const CurrencyConversion = React.lazy(() => import('./components/CurrencyConversion'));
const BillingScreenSettings = React.lazy(() => import('./components/BillingScreenSettings'));
const LiveView = React.lazy(() => import('./components/LiveView'));
const HelpSupport = React.lazy(() => import('./components/HelpSupport'));
const ServiceRenewal = React.lazy(() => import('./components/ServiceRenewal'));
const LoyaltyProgram = React.lazy(() => import('./components/LoyaltyProgram'));
const SalesForecasting = React.lazy(() => import('./components/AIForecasting'));
const Expenses = React.lazy(() => import('./components/Expenses'));
const DeliveryOrders = React.lazy(() => import('./components/DeliveryOrders'));
const PickupOrders = React.lazy(() => import('./components/PickupOrders'));
const KOTHistory = React.lazy(() => import('./components/KOTHistory'));
const EditedBills = React.lazy(() => import('./components/EditedBills'));
const LicenseScreen = React.lazy(() => import('./components/LicenseScreen'));
const DayBook = React.lazy(() => import('./components/DayBook'));
const InventoryManagement = React.lazy(() => import('./components/InventoryManagement'));
const KDS = React.lazy(() => import('./components/KDS'));
const CRM = React.lazy(() => import('./components/CRM'));
const QRCodeGenerator = React.lazy(() => import('./components/QRCodeGenerator'));
const StaffManagement = React.lazy(() => import('./components/StaffManagement'));
const CustomerMenu = React.lazy(() => import('./components/CustomerMenu'));
const AIClockIn = React.lazy(() => import('./components/AIClockIn'));
const SystemPermissionsModal = React.lazy(() => import('./components/SystemPermissionsModal'));
const ServiceRequestAlert = React.lazy(() => import('./components/ServiceRequestAlert'));
const ContactSupportModal = React.lazy(() => import('./components/ContactSupportModal'));
const UserManualModal = React.lazy(() => import('./components/UserManualModal'));
const AboutModal = React.lazy(() => import('./components/AboutModal'));
const UpdateModal = React.lazy(() => import('./components/UpdateModal'));
const CalculatorModal = React.lazy(() => import('./components/CalculatorModal'));
const LandingPage = React.lazy(() => import('./landing/LandingPage'));
import GlobalHeader from './components/GlobalHeader';
import packageJson from '../package.json';
import useBroadcasts from './hooks/useBroadcasts';
import useNotifications from './hooks/useNotifications';
import { clearMenuCache } from './api/menu';
import { clearCategoryCache } from './api/category';
import { clearAllOfflineData } from './db/offlineDb';
import { logoutUser } from './api/auth';

import { LogOut, LayoutDashboard, History, User, UtensilsCrossed, ClipboardList, BarChart3, LayoutGrid, Home, Settings as SettingsIcon, Truck, ShoppingBag, Wallet, Printer, BookOpen, Lock, ShieldAlert, CalendarClock, X, Phone, Menu, Receipt, Clock, Package, WifiOff, RefreshCw, Users as UsersIcon, QrCode, UserCheck, Radio, Search, Calculator, Bell, Power, PhoneCall, ChevronDown, ChevronRight, MoreVertical, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle, ChefHat, Send, Edit } from 'lucide-react';
import { getOpenOrders } from './api/billing';
import { AnimatePresence, motion } from 'framer-motion';
import { initSyncEngine } from './utils/syncEngine';
import realtimeService from './services/realtimeService';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import './App.css';
import logoImg from './assets/images/logo.png';

function App() {
  const { t } = useLanguage();
  const onlineStatus = useOnlineStatus();
  const [view, setView] = useState(() => {
    const isNative = isCapacitorApp() || isElectronApp();
    const path = window.location.pathname.replace(/^\/+/, '');

    // 1. Native mobile (APK/IPA) and Desktop (EXE/DMG/file:) go directly to POS app
    if (isNative || window.location.protocol === 'file:' || path.includes('.html')) {
      return 'floor';
    }

    // 2. Customer menu / QR order deep links or KDS
    if (path === 'order' || path.startsWith('order/') || path === 'kds') {
      return path;
    }

    // 3. Explicit routes requested by user
    if (path === 'login' || path === 'app') {
      return 'floor';
    }

    // 4. Direct route paths on web (e.g. /discount, /menu, /settings, /floor, /orders, /history, /analytics, /inventory, etc.)
    if (path && path !== '' && path !== 'landing' && path !== 'home' && path !== 'index.html') {
      return path;
    }

    // 5. If user is logged in, navigate to floor rather than landing on refresh
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (token) {
      return 'floor';
    }

    // 6. Web browser (Vercel / Localhost) without login defaults to Landing Page!
    return 'landing';
  });

  // Keep URL clean as '/' when on the landing page in a web browser
  useEffect(() => {
    const isNative = isCapacitorApp() || isElectronApp();
    if (!isNative && view === 'landing' && window.location.pathname !== '/' && window.location.pathname !== '') {
      try {
        window.history.replaceState(null, '', '/');
      } catch (e) {}
    }
  }, [view]);

  // Handle browser back / forward navigation between Landing Page and App on web
  useEffect(() => {
    const handlePopState = () => {
      const isNative = isCapacitorApp() || isElectronApp();
      const path = window.location.pathname.replace(/^\/+/, '');
      if (isNative || window.location.protocol === 'file:') return;
      if (!path || path === '' || path === 'landing' || path === 'home' || path === 'index.html') {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        setView(token ? 'floor' : 'landing');
      } else if (path === 'login' || path === 'app' || path === 'floor') {
        setView('floor');
      } else {
        setView(path);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [settingsUpdateTicker, setSettingsUpdateTicker] = useState(0);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Keyboard shortcut for Calculator (Alt + C or Ctrl + Alt + C)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setShowCalculator((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dummy notifications removed
  const dummyNotifications = [];

  // Search Bill
  const [searchBillNo, setSearchBillNo] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchBillNo.trim().length > 0) {
        window.dispatchEvent(new CustomEvent('billSearch', { detail: searchBillNo }));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchBillNo]);

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter' && searchBillNo.trim()) {
      handleViewChange('history');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('executeBillSearch', { detail: searchBillNo }));
      }, 300);
    }
  };

  // Help Modals State
  const [showContactModal, setShowContactModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdateDownloading, setIsUpdateDownloading] = useState(false);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState(0);
  const [appVersion, setAppVersion] = useState(packageJson?.version || '6.0.76');
  const [updateSnoozeInfo, setUpdateSnoozeInfo] = useState(() => {
    try {
      const tenantKey = localStorage.getItem('resto_db_name') || 'default';
      const saved = localStorage.getItem(`update_snooze_${tenantKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.snoozeUntil && Date.now() < parsed.snoozeUntil) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const handleSnoozeUpdate = (durationMs, label) => {
    try {
      const tenantKey = localStorage.getItem('resto_db_name') || 'default';
      const snoozeUntil = Date.now() + durationMs;
      const data = {
        snoozeUntil,
        label,
        version: updateInfo?.version || appVersion,
        snoozedAt: Date.now()
      };
      localStorage.setItem(`update_snooze_${tenantKey}`, JSON.stringify(data));
      setUpdateSnoozeInfo(data);
    } catch (e) {
      console.error('[App] Failed to save snooze info:', e);
    }
    setShowUpdateModal(false);
  };

  // AI Clock-In State
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [resolvedDropdownNotifs, setResolvedDropdownNotifs] = useState({});

  const [, setRestaurantName] = useState(() => {
    try {
      const cached = localStorage.getItem('restaurantSettings');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.restaurantName || 'msbillings';
      }
    } catch {/* ignore */ }
    return 'msbillings';
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [showMobileQuickActions, setShowMobileQuickActions] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [viewHistory, setViewHistory] = useState(() => {
    const path = window.location.pathname.replace(/^\/+/, '');
    if (window.location.protocol === 'file:' || path.includes('.html')) return ['floor'];
    if (path === 'dashboard') return ['dashboard'];
    if (path && !['login', 'app', 'index.html', ''].includes(path)) {
      return ['floor', path];
    }
    return ['floor'];
  });
  const [hasLicense, setHasLicense] = useState(false);
  const [unlockedFeatures, setUnlockedFeatures] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('unlockedFeatures') || '{}');
    } catch {
      return {};
    }
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [licenseExpiry, setLicenseExpiry] = useState(null); // Date object
  const [daysRemaining, setDaysRemaining] = useState(null);
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [sidebarSections, setSidebarSections] = useState({
    main: true,
    operations: true,
    management: true,
    system: true
  });
  const [features, setFeatures] = useState(() => {
    try {
      const cached = localStorage.getItem('resto_features');
      if (cached) return JSON.parse(cached);
    } catch {/* ignore */ }
    return { kds: true, inventory: true, crm: true, staff: true, analytics: true, daybook: true, qrcode: true, delivery: true, expenses: true };
  });
  // Broadcasts are kept strictly in notifications dropdown & Notification Center without blocking screen popups

  const rawRole = user?.role || 'Admin';
  const usernameLower = user?.username?.toLowerCase() || '';
  const userRole = usernameLower.includes('captain') ? 'Captain' : usernameLower.includes('cashier') ? 'Cashier' : rawRole;
  const isCaptain = userRole === 'Captain';
  const isAdmin = userRole === 'Admin';
  const isChef = userRole === 'Chef';
  const isManager = userRole === 'Manager';

  const { broadcasts, unreadCount, markAsRead, markAllAsRead, clearAllBroadcasts } = useBroadcasts(userRole);
  const { notifications: realTimeNotifs, unreadCount: rtUnreadCount, markAllAsRead: rtMarkAllAsRead, clearNotification: rtClearNotification } = useNotifications(userRole);

  // Calculate role-accurate unread count based on current shop and role
  const totalUnreadCount = React.useMemo(() => {
    try {
      const tenantKey = localStorage.getItem('resto_db_name') || 'default';
      const roleKeyLC = (userRole || 'Admin').toLowerCase();
      const readRtIds = new Set(JSON.parse(localStorage.getItem(`realtime_read_ids_${tenantKey}_${roleKeyLC}`) || '[]'));
      const readBcIds = new Set(JSON.parse(localStorage.getItem('read_broadcasts') || '[]'));

      const unreadRt = realTimeNotifs.filter(n => !readRtIds.has(String(n.id))).length;
      const unreadBc = broadcasts.filter(b => !readBcIds.has(String(b._id))).length;
      return unreadRt + unreadBc;
    } catch {
      return (unreadCount || 0) + (rtUnreadCount || 0);
    }
  }, [broadcasts, realTimeNotifs, userRole, unreadCount, rtUnreadCount]);

  const [resolvingCancelIds, setResolvingCancelIds] = useState({});

  const handleResolveCancelItem = async (e, n, action) => {
    e.stopPropagation();
    if (resolvingCancelIds[n.id]) return;

    setResolvingCancelIds(prev => ({ ...prev, [n.id]: action }));
    try {
      const token = localStorage.getItem('accessToken');
      const tenantDb = localStorage.getItem('resto_db_name') || '';
      await axios.post(`${getApiUrl()}/bills/resolve-item-cancel`, {
        orderId: n.data?.orderId,
        itemId: n.data?.itemId,
        action
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-DB': tenantDb
        }
      });

      setResolvingCancelIds(prev => ({ ...prev, [n.id]: `${action}_done` }));
      window.dispatchEvent(new CustomEvent('cancellationResolved', { detail: { orderId: n.data?.orderId, itemId: n.data?.itemId, action } }));
      setTimeout(() => {
        rtClearNotification(n.id);
        setResolvingCancelIds(prev => {
          const next = { ...prev };
          delete next[n.id];
          return next;
        });
      }, 700);
    } catch (err) {
      console.error(err);
      setResolvingCancelIds(prev => {
        const next = { ...prev };
        delete next[n.id];
        return next;
      });
      alert(`Failed to ${action} cancellation request`);
    }
  };

  const [broadcastReplies, setBroadcastReplies] = useState({});
  const [submittingBroadcastReply, setSubmittingBroadcastReply] = useState({});
  const [broadcastReplySuccess, setBroadcastReplySuccess] = useState({});
  const [editingReplyId, setEditingReplyId] = useState({});
  const [sentReplies, setSentReplies] = useState({});

  const handleSendBroadcastReply = async (e, n) => {
    e.stopPropagation();
    const rawId = n.broadcastId || n.data?.broadcastId || n.id;
    const broadcastId = String(rawId).replace(/^broadcast_/, '');
    const text = (broadcastReplies[n.id] || '').trim();
    if (!text) return;

    setSubmittingBroadcastReply(prev => ({ ...prev, [n.id]: true }));
    try {
      const SUPERADMIN_API_URL = getSuperadminApiUrl();
      const tenantDb = localStorage.getItem('resto_db_name') || 'client_demo_db';
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const senderName = userData.username || userRole;
      const shopName = localStorage.getItem('restaurant_name') || tenantDb || 'Restaurant';

      const replyPayload = {
        broadcastId,
        clientId: tenantDb,
        shopName,
        senderRole: userRole,
        senderUsername: senderName,
        message: text
      };

      try {
        await api.post('/broadcasts/reply', replyPayload, { timeout: 10000 });
      } catch (e1) {
        await axios.post(`${SUPERADMIN_API_URL}/api/broadcasts/reply`, replyPayload, { timeout: 10000 });
      }

      localStorage.setItem(`broadcast_sent_reply_${broadcastId}_${tenantDb}`, text);
      localStorage.setItem(`broadcast_sent_reply_${n.id}_${tenantDb}`, text);

      setSentReplies(prev => ({ ...prev, [n.id]: text, [broadcastId]: text }));
      setEditingReplyId(prev => ({ ...prev, [n.id]: false }));
      setBroadcastReplySuccess(prev => ({ ...prev, [n.id]: true }));
      setTimeout(() => {
        setBroadcastReplySuccess(prev => ({ ...prev, [n.id]: false }));
      }, 3000);
    } catch (err) {
      console.error('Failed to send broadcast reply from dropdown:', err);
      const msg = err.response?.data?.message || err.message || t("Failed to send reply. Please try again.");
      alert(`${t("Failed to send reply")}: ${msg}`);
    } finally {
      setSubmittingBroadcastReply(prev => ({ ...prev, [n.id]: false }));
    }
  };

  const [toastNotifInfo, setToastNotifInfo] = useState(null);
  const prevRtNotifIdRef = React.useRef(undefined);
  const prevBroadcastIdRef = React.useRef(undefined);

  useEffect(() => {
    // 1. Check if a new real-time notification arrived (KOT, Food Ready, Service Request, Bill Printed)
    if (realTimeNotifs.length > 0) {
      const topRt = realTimeNotifs[0];
      const topRtId = String(topRt?.id || topRt?._id || '');
      if (topRtId) {
        if (prevRtNotifIdRef.current === undefined) {
          // Initial population on page load / fetch completion: record baseline ID, DO NOT popup toast
          prevRtNotifIdRef.current = topRtId;
        } else if (prevRtNotifIdRef.current !== topRtId) {
          // A genuinely new real-time notification arrived while the user is using the app!
          prevRtNotifIdRef.current = topRtId;
          setToastNotifInfo({
            title: topRt.title || 'Notification',
            message: topRt.message || '',
            type: topRt.type || 'info',
            imageUrl: topRt.imageUrl
          });
          return;
        }
      }
    }

    // 2. Check if a new Broadcast arrived from SuperAdmin
    if (broadcasts.length > 0) {
      const topBc = broadcasts[0];
      const topBcId = String(topBc?._id || topBc?.id || '');
      if (topBcId) {
        // Also check if user has already read or dismissed this broadcast in localStorage
        const readBcIds = new Set(JSON.parse(localStorage.getItem('read_broadcasts') || '[]'));
        const isAlreadyRead = readBcIds.has(topBcId);

        if (prevBroadcastIdRef.current === undefined) {
          // Initial population on page load / fetch completion: record baseline ID, DO NOT popup toast
          prevBroadcastIdRef.current = topBcId;
        } else if (prevBroadcastIdRef.current !== topBcId) {
          // A genuinely NEW broadcast was sent from SuperAdmin while the page is open!
          prevBroadcastIdRef.current = topBcId;
          if (!isAlreadyRead) {
            setToastNotifInfo({
              title: topBc.title || 'New Broadcast',
              message: topBc.message || '',
              type: 'broadcast',
              imageUrl: topBc.imageUrl
            });
          }
        }
      }
    }
  }, [realTimeNotifs, broadcasts]);

  // Auto-hide toast messages after 5 seconds
  useEffect(() => {
    if (toastNotifInfo) {
      const timer = setTimeout(() => {
        setToastNotifInfo(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotifInfo]);

  // Helper to format notification time clearly in 12-hour AM/PM format
  const formatNotifTime = (n) => {
    try {
      const d = n.timestamp || (n.time ? new Date(n.time) : null) || (n.createdAt ? new Date(n.createdAt) : null);
      if (!d || isNaN(new Date(d).getTime())) return n.time || '';
      const dateObj = new Date(d);
      const now = new Date();
      const isToday = dateObj.toDateString() === now.toDateString();
      const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      if (isToday) return timeStr;
      return `${dateObj.getDate()} ${dateObj.toLocaleString('en', { month: 'short' })}, ${timeStr}`;
    } catch {
      return n.time || '';
    }
  };

  // Format broadcasts for the dropdown
  const formattedBroadcasts = React.useMemo(() => {
    return broadcasts.map((b) => ({
      id: b._id,
      title: b.title,
      message: b.message,
      imageUrl: b.imageUrl,
      time: new Date(b.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      timestamp: new Date(b.createdAt),
      type: 'broadcast',
      isBroadcast: true
    }));
  }, [broadcasts]);

  const notifications = React.useMemo(() => {
    const raw = [...formattedBroadcasts, ...realTimeNotifs];
    const uniqueMap = new Map();
    raw.forEach(n => {
      if (n && n.id && !uniqueMap.has(String(n.id))) {
        uniqueMap.set(String(n.id), n);
      }
    });
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const timeA = new Date(a.timestamp || a.time || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamp || b.time || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [formattedBroadcasts, realTimeNotifs]);

  useEffect(() => {
    if (isCaptain && !['floor', 'orders', 'kothistory', 'billing'].includes(view)) {
      setTimeout(() => setView('floor'), 0);
    }
  }, [isCaptain, view]);

  useEffect(() => {
    if (isChef && !['kds', 'kothistory', 'notification'].includes(view)) {
      setTimeout(() => setView('kds'), 0);
    }
  }, [isChef, view]);

  // Sync license expiry and restaurant settings from Backend Database so ALL devices (Desktop & Mobile) match 100%!
  const syncConfigFromBackend = async () => {
    try {
      const API_BASE_URL = getApiUrl();
      const res = await fetch(`${API_BASE_URL}/config/info`, {
        headers: {
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || '',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.licenseExpiry) {
          localStorage.setItem('resto_license_expiry', data.licenseExpiry);
          const expiryDate = new Date(data.licenseExpiry);
          if (!isNaN(expiryDate.getTime())) {
            setLicenseExpiry(expiryDate);
          }
        }
        if (data.restaurantSettings) {
          try {
            const secRes = await fetch(`${API_BASE_URL}/config/security`, {
              headers: {
                'X-Tenant-DB': localStorage.getItem('resto_db_name') || '',
                'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
              }
            });
            if (secRes.ok) {
              const secData = await secRes.json();
              data.restaurantSettings.requireMasterPin = secData.requireMasterPin;
              data.restaurantSettings.customLocks = secData.customLocks;
            }
          } catch (e) { console.error('Security fetch failed', e); }

          localStorage.setItem('restaurantSettings', JSON.stringify(data.restaurantSettings));
          setRestaurantName(data.restaurantSettings.restaurantName || 'msbillings');
          document.title = `${data.restaurantSettings.restaurantName || 'msbillings'} - Restaurant Management`;
        }
        if (data.spaces) {
          localStorage.setItem('msbillings_spaces', JSON.stringify(data.spaces));
          window.dispatchEvent(new Event('spacesUpdated'));
        }
        return;
      }
    } catch {/* ignore */ }
    // Fallback to localStorage if offline/not synced yet (no hardcoded dates)
    let expiryStr = localStorage.getItem('resto_license_expiry');
    if (expiryStr) {
      const expiryDate = new Date(expiryStr);
      if (!isNaN(expiryDate.getTime())) {
        setLicenseExpiry(expiryDate);
      }
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Invalid user JSON in localStorage:", err);
        localStorage.removeItem('user');
      }
    }
    const savedLicense = localStorage.getItem('resto_license');
    const savedDbName = localStorage.getItem('resto_db_name');
    const isDesktopApp = !!window.electronAPI;

    // For cloud/mobile apps, we MUST have the database name for multi-tenancy isolation.
    // If it's missing (e.g. old cached state), force them back to the license screen.
    if (savedLicense && (savedDbName || isDesktopApp)) {
      setTimeout(() => setHasLicense(true), 0);
    } else if (savedLicense && !savedDbName && !isDesktopApp) {
      localStorage.removeItem('resto_license');
      localStorage.removeItem('resto_license_expiry');
      setTimeout(() => setHasLicense(false), 0);
    }

    setTimeout(() => setLoading(false), 0);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const hasCustomerParams = searchParams.has('table') && searchParams.has('tenant');

    // Initialize the Offline Sync Engine (caches menu/categories/floors, processes sync queue for POS only)
    if (!window.location.pathname.includes('order') && !hasCustomerParams) {
      initSyncEngine();
      setTimeout(() => syncConfigFromBackend(), 0);
    }

    const fetchSuperAdminConfig = async () => {
      try {
        const licenseKey = localStorage.getItem('resto_license');
        if (licenseKey) {
          const SUPERADMIN_API_URL = getSuperadminApiUrl();
          const saRes = await fetch(`${SUPERADMIN_API_URL}/api/clients/license/${licenseKey}`);
          if (saRes.ok) {
            const saData = await saRes.json();


            // 1. Check for suspension
            if (saData.status === 'Suspended') {
              localStorage.removeItem('user');
              localStorage.removeItem('resto_license');
              localStorage.removeItem('resto_db_name');
              setUser(null);
              setHasLicense(false);
              alert("Your account has been suspended by the administrator. Please contact support: +91 9701800140 , 9032223352");
              return;
            }

            // 2. Check for license expiry directly
            if (saData.validUntil) {
              const expiryDate = new Date(saData.validUntil);
              if (new Date() > expiryDate) {
                localStorage.removeItem('user');
                localStorage.removeItem('resto_license');
                localStorage.removeItem('resto_db_name');
                setUser(null);
                setHasLicense(false);
                alert("Your license has expired. Please contact support: +91 9701800140 , 9032223352");
                return;
              } else {
                localStorage.setItem('resto_license_expiry', saData.validUntil);
                setLicenseExpiry(expiryDate);
              }
            }

            // 3. Sync Passwords to Local Backend if present
            if (saData.plainTextPassword || saData.staffAccounts && saData.staffAccounts.length > 0) {
              try {
                const API_BASE_URL = getApiUrl();
                await fetch(`${API_BASE_URL}/config/sync-users`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    plainTextPassword: saData.plainTextPassword,
                    staffAccounts: saData.staffAccounts
                  })
                });
              } catch (syncErr) {
                console.error("Failed to sync passwords locally", syncErr);
              }
            }

            // 4. Update Features
            if (saData.features) {
              setFeatures(saData.features);
              localStorage.setItem('resto_features', JSON.stringify(saData.features));
            }

            // 5. Broadcasts are loaded and displayed solely in notification center/dropdown
          } else if (saRes.status === 404) {
            // Kill switch: Account was deleted or license key was changed in SuperAdmin
            localStorage.removeItem('user');
            localStorage.removeItem('resto_license');
            localStorage.removeItem('resto_db_name');
            setUser(null);
            setHasLicense(false);
            alert("Your license key is invalid or your account has been removed. Please contact support: +91 9701800140 , 9032223352");
          }
        }
      } catch {/* ignore */ }
    };

    setTimeout(() => syncConfigFromBackend(), 0);
    setTimeout(() => fetchSuperAdminConfig(), 0);

    // Poll SuperAdmin for broadcasts every 60 seconds
    const intervalId = setInterval(fetchSuperAdminConfig, 60000);

    if (window.electronAPI) {
      if (window.electronAPI.onForceSync) {
        window.electronAPI.onForceSync(() => {
          fetchSuperAdminConfig();
        });
      }

      if (window.electronAPI.onShowContactSupport) {
        window.electronAPI.onShowContactSupport(() => {
          setShowContactModal(true);
        });
      }

      if (window.electronAPI.onShowUserManual) {
        window.electronAPI.onShowUserManual(() => {
          setShowManualModal(true);
        });
      }

      if (window.electronAPI.onShowAbout) {
        window.electronAPI.onShowAbout((version) => {
          if (version) setAppVersion(version);
          setShowAboutModal(true);
        });
      }

      if (window.electronAPI.onCheckingForUpdate) {
        window.electronAPI.onCheckingForUpdate(() => {
          console.log('[App] Checking for auto-updates...');
        });
      }

      if (window.electronAPI.onUpdateAvailable) {
        window.electronAPI.onUpdateAvailable((info) => {
          console.log('[App] Update available info:', info);
          setUpdateInfo(info);
          setIsUpdateDownloading(true);
          setUpdateDownloadProgress(0);

          // Check tenant-scoped snooze
          const tenantKey = localStorage.getItem('resto_db_name') || 'default';
          const savedSnooze = localStorage.getItem(`update_snooze_${tenantKey}`);
          let isSnoozed = false;
          if (savedSnooze) {
            try {
              const parsed = JSON.parse(savedSnooze);
              if (parsed.snoozeUntil && Date.now() < parsed.snoozeUntil) {
                isSnoozed = true;
                setUpdateSnoozeInfo(parsed);
              } else {
                localStorage.removeItem(`update_snooze_${tenantKey}`);
                setUpdateSnoozeInfo(null);
              }
            } catch {
              localStorage.removeItem(`update_snooze_${tenantKey}`);
            }
          }
          if (!isSnoozed) {
            setShowUpdateModal(true);
          }
        });
      }

      if (window.electronAPI.onDownloadProgress) {
        window.electronAPI.onDownloadProgress((progress) => {
          setIsUpdateDownloading(true);
          setUpdateDownloadProgress(Math.round(progress?.percent || 0));
        });
      }

      if (window.electronAPI.onUpdateReady) {
        window.electronAPI.onUpdateReady((info) => {
          console.log('[App] Update downloaded and ready:', info);
          if (info) setUpdateInfo(info);
          setIsUpdateDownloading(false);
          setUpdateDownloadProgress(100);

          // Check tenant-scoped snooze
          const tenantKey = localStorage.getItem('resto_db_name') || 'default';
          const savedSnooze = localStorage.getItem(`update_snooze_${tenantKey}`);
          let isSnoozed = false;
          if (savedSnooze) {
            try {
              const parsed = JSON.parse(savedSnooze);
              if (parsed.snoozeUntil && Date.now() < parsed.snoozeUntil) {
                isSnoozed = true;
                setUpdateSnoozeInfo(parsed);
              } else {
                localStorage.removeItem(`update_snooze_${tenantKey}`);
                setUpdateSnoozeInfo(null);
              }
            } catch {
              localStorage.removeItem(`update_snooze_${tenantKey}`);
            }
          }
          if (!isSnoozed) {
            setShowUpdateModal(true);
          }
        });
      }

      if (window.electronAPI.onUpdateNotAvailable) {
        window.electronAPI.onUpdateNotAvailable((info) => {
          console.log('[App] App is up to date:', info);
        });
      }

      if (window.electronAPI.onUpdateError) {
        window.electronAPI.onUpdateError((err) => {
          console.error('[App] Auto-updater error:', err);
          setIsUpdateDownloading(false);
        });
      }
    }

    return () => clearInterval(intervalId);
  }, []);

  // Calculate days remaining and auto-show popup
  useEffect(() => {
    if (!licenseExpiry) return;
    const calcDays = () => {
      const now = new Date();
      const diff = licenseExpiry.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      setDaysRemaining(days);
      return days;
    };
    const days = calcDays();
    // Show popup if 15 days or less remain (only once per session)
    const popupShownKey = 'expiry_popup_shown_' + new Date().toDateString();
    if (days <= 15 && !sessionStorage.getItem(popupShownKey)) {
      setTimeout(() => setShowExpiryPopup(true), 0);
      sessionStorage.setItem(popupShownKey, 'true');
    }
    const interval = setInterval(calcDays, 60000); // update every minute
    return () => clearInterval(interval);
  }, [licenseExpiry]);

  // Check for first login system permissions
  useEffect(() => {
    if (hasLicense && user && !localStorage.getItem('system_permissions_granted')) {
      // Delay it slightly so it doesn't collide with the license popup animation
      const timer = setTimeout(() => {
        setShowPermissionsModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasLicense, user]);

  useEffect(() => {
    // Load restaurant settings
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('restaurantSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setRestaurantName(settings.restaurantName);
        document.title = `${settings.restaurantName} - Restaurant Management`;
      } else {
        setRestaurantName('msbillings');
        document.title = 'msbillings - Restaurant Management';
      }
    };

    const fetchLatestSettings = async () => {
      try {
        const res = await api.get('/config/info');
        const settingsData = res.data?.restaurantSettings || res.data;
        if (settingsData && (settingsData.restaurantName || typeof settingsData === 'object')) {
          localStorage.setItem('restaurantSettings', JSON.stringify(settingsData));
          if (settingsData.restaurantName) {
            setRestaurantName(settingsData.restaurantName);
            document.title = `${settingsData.restaurantName} - Restaurant Management`;
          }
          window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settingsData }));
        }
      } catch (e) {
        console.warn('Could not fetch latest settings from backend, using cached:', e);
      }
    };

    loadSettings();
    if (user) {
      fetchLatestSettings();
    }

    // Listen for settings updates
    const handleSettingsUpdate = (event) => {
      if (event.detail && event.detail.restaurantName) {
        setRestaurantName(event.detail.restaurantName);
        document.title = `${event.detail.restaurantName} - Restaurant Management`;
      } else {
        loadSettings();
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Listen for forceLogout events dispatched by axios interceptor / SessionManager.
  // This replaces all window.location.reload() calls with a clean React state reset.
  useEffect(() => {
    const handleForceLogout = () => {
      console.warn('[App] forceLogout event received — resetting user state');
      setUser(null);
      setView('landing');
      window.history.replaceState(null, '', '/');
      // Re-check license status from localStorage in case license was cleared
      // (e.g. via "Reset License" button). If resto_license is gone, show LicenseScreen.
      const savedLicense = localStorage.getItem('resto_license');
      const savedDbName = localStorage.getItem('resto_db_name');
      const isDesktopApp = !!window.electronAPI;
      if (!savedLicense || !savedDbName && !isDesktopApp) {
        setHasLicense(false);
      }
    };

    window.addEventListener('forceLogout', handleForceLogout);
    return () => window.removeEventListener('forceLogout', handleForceLogout);
  }, []);

  const fetchActiveOrdersCount = async () => {
    try {
      const orders = await getOpenOrders();
      setActiveOrdersCount(orders.length);
    } catch (error) {
      console.error('Error fetching active orders count:', error);
    }
  };

  useEffect(() => {
    if (user) {
      setTimeout(() => fetchActiveOrdersCount(), 0);
    }
  }, [user]);

  const handleLoginSuccess = (data) => {
    // Step 1: Clear ALL old restaurant-specific cached data FIRST (Memory, Storage, IndexedDB)
    clearMenuCache();
    clearCategoryCache();
    clearAllOfflineData().catch(() => { });
    localStorage.removeItem('restaurantSettings');
    localStorage.removeItem('msbillings_spaces');
    localStorage.removeItem('resto_license_expiry');

    // Step 2: Set the NEW user's auth and restaurant data
    setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.databaseName) {
      localStorage.setItem('resto_db_name', data.databaseName);
    }
    if (data.licenseKey) {
      localStorage.setItem('resto_license', data.licenseKey);
    }
    if (data.licenseExpiry) {
      localStorage.setItem('resto_license_expiry', data.licenseExpiry);
    }

    // Step 3: Sync React state without doing a hard page reload.
    if (data.licenseExpiry) {
      const expiryDate = new Date(data.licenseExpiry);
      if (!isNaN(expiryDate.getTime())) {
        setLicenseExpiry(expiryDate);
      }
    }

    // Now fetch the configuration before going to dashboard
    syncConfigFromBackend().then(() => {
      const rawRole = data.user?.role || 'Admin';
      const usernameLower = data.user?.username?.toLowerCase() || '';
      const userRole = usernameLower.includes('captain') ? 'Captain' : usernameLower.includes('cashier') ? 'Cashier' : rawRole;
      const isChefUser = userRole === 'Chef';

      if (isChefUser) {
        setView('kds');
        setActiveOrdersCount(0);
        window.history.replaceState(null, '', '/kds');
      } else {
        setView('floor');
        setActiveOrdersCount(0);
        window.history.replaceState(null, '', '/floor');
      }
    });
  };

  useEffect(() => {
    if (user && window.location.pathname === '/login' && view !== 'landing') {
      window.history.replaceState(null, '', '/floor');
    }
  }, [user, view]);

  useEffect(() => {
    if (user) {
      realtimeService.rejoinTenant();

      const unsubOrder = realtimeService.subscribe('orderUpdated', fetchActiveOrdersCount);
      const unsubBill = realtimeService.subscribe('billSettled', fetchActiveOrdersCount);
      const unsubTable = realtimeService.subscribe('tableStatusChanged', fetchActiveOrdersCount);
      const unsubKOT = realtimeService.subscribe('newKOT', fetchActiveOrdersCount);
      const unsubSettings = realtimeService.subscribe('settingsUpdated', (newSettings) => {
        const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
        const updated = { ...newSettings, requireMasterPin: s.requireMasterPin, customLocks: s.customLocks };
        localStorage.setItem('restaurantSettings', JSON.stringify(updated));
        setSettingsUpdateTicker(prev => prev + 1);
      });
      const unsubSecurity = realtimeService.subscribe('securitySettingsUpdated', (newSecurity) => {
        const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
        s.requireMasterPin = newSecurity.requireMasterPin;
        s.customLocks = newSecurity.customLocks;
        localStorage.setItem('restaurantSettings', JSON.stringify(s));
        setSettingsUpdateTicker(prev => prev + 1);
      });

      return () => {
        unsubOrder();
        unsubBill();
        unsubTable();
        unsubKOT();
        unsubSettings();
        unsubSecurity();
      };
    }
  }, [user]);

  const handleLogout = () => {
    // Fire and forget the logout API call so the UI doesn't hang if backend is down
    logoutUser().catch((error) => console.error('Logout API error:', error));

    // Clear ALL caches and state immediately across memory, localStorage, and IndexedDB
    clearMenuCache();
    clearCategoryCache();
    clearAllOfflineData().catch(() => { });

    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    // Clear restaurant-specific cached data
    localStorage.removeItem('resto_db_name');
    localStorage.removeItem('resto_license');
    localStorage.removeItem('resto_license_expiry');
    localStorage.removeItem('restaurantSettings');
    localStorage.removeItem('msbillings_spaces');
    sessionStorage.removeItem('unlockedFeatures');
    setView('landing');
    window.history.replaceState(null, '', '/');
  };

  const handleViewChange = (newView, tableSelection = null) => {
    setSelectedTable(tableSelection);
    setView(newView);
    setViewHistory(prev => {
      // Don't push duplicate sequential views
      if (prev[prev.length - 1] === newView) return prev;
      return [...prev, newView];
    });
    setMobileMenuOpen(false);

    window.history.pushState(null, '', '/' + (newView || 'floor'));
  };

  const handleGoBack = () => {
    if (viewHistory.length <= 1) {
      setView('floor');
      window.history.pushState(null, '', '/floor');
      return;
    }

    const previousView = viewHistory[viewHistory.length - 2];

    setViewHistory(prev => {
      const newHistory = [...prev];
      newHistory.pop();
      return newHistory;
    });

    setView(previousView);
    window.history.pushState(null, '', '/' + (previousView || 'floor'));
  };

  // BYPASS LICENSE/AUTH FOR DIGITAL MENU — must be BEFORE any loading/auth guard!
  const currentSearchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isCustomerOrderRoute = window.location.pathname === '/order' ||
    window.location.pathname.startsWith('/order/') ||
    (currentSearchParams.has('table') && currentSearchParams.has('tenant'));

  if (isCustomerOrderRoute) {
    return (
      <>
        <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50">{t("Loading Menu...")}</div>}>
          <CustomerMenu />
        </Suspense>
        <Suspense fallback={null}>
          <ContactSupportModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
          <UserManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} />
          <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} version={appVersion} />
          <UpdateModal isOpen={showUpdateModal} isDownloading={isUpdateDownloading} downloadProgress={updateDownloadProgress} updateInfo={updateInfo} onInstall={() => window.electronAPI?.installUpdate()} onClose={() => setShowUpdateModal(false)} />
        </Suspense>
      </>);
  }

  if (loading) return <div className="flex items-center justify-center h-screen bg-background text-text-muted">{t("Loading...")}</div>;

  // BYPASS LICENSE/AUTH FOR DIGITAL MENU! (old location — kept as fallback)
  // const isCustomerOrderRoute = window.location.pathname === '/order';
  // if (isCustomerOrderRoute) { ... }

  if (isClockingIn) {
    return (
      <>
        <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-900 text-white">{t("Loading AI...")}</div>}>
          <AIClockIn onBack={() => setIsClockingIn(false)} />
        </Suspense>
        <Suspense fallback={null}>
          <ContactSupportModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
          <UserManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} />
          <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} version={appVersion} />
          <UpdateModal isOpen={showUpdateModal} isDownloading={isUpdateDownloading} downloadProgress={updateDownloadProgress} updateInfo={updateInfo} onInstall={() => window.electronAPI?.installUpdate()} onClose={() => setShowUpdateModal(false)} />
        </Suspense>
      </>);

  }

  // 1. Web visitors / Google Search Crawlers: Show Landing Page first
  if (view === 'landing') {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-900 text-white font-medium">{t("Loading MS Billings...")}</div>}>
        <LandingPage 
          isLoggedIn={!!user}
          onLaunchApp={(targetView = 'floor') => {
            setView(targetView);
            try {
              window.history.pushState(null, '', `/${targetView === 'floor' ? 'floor' : targetView}`);
            } catch (e) {}
          }} 
        />
      </Suspense>
    );
  }

  // 2. POS App Terminal flow (Native APK/EXE or Web users entering /login or /app)
  if (!hasLicense) {
    return (
      <>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">{t("Verifying License...")}</div>}>
          <LicenseScreen onValidLicense={() => setHasLicense(true)} />
        </Suspense>
        <Suspense fallback={null}>
          <ContactSupportModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
          <UserManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} />
          <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} version={appVersion} />
          <UpdateModal isOpen={showUpdateModal} isDownloading={isUpdateDownloading} downloadProgress={updateDownloadProgress} updateInfo={updateInfo} onInstall={() => window.electronAPI?.installUpdate()} onClose={() => setShowUpdateModal(false)} />
        </Suspense>
      </>);
  }

  if (!user) {
    return (
      <>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">{t("Loading...")}</div>}>
          <LoginPage onLoginSuccess={handleLoginSuccess} onClockInClick={() => setIsClockingIn(true)} />
        </Suspense>
        <Suspense fallback={null}>
          <ContactSupportModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
          <UserManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} />
          <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} version={appVersion} />
          <UpdateModal isOpen={showUpdateModal} isDownloading={isUpdateDownloading} downloadProgress={updateDownloadProgress} updateInfo={updateInfo} onInstall={() => window.electronAPI?.installUpdate()} onClose={() => setShowUpdateModal(false)} />
          <CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
        </Suspense>
      </>);

  }

  const getTitle = () => {
    switch (view) {
      case 'dashboard': return 'Dashboard';
      case 'floor': return 'Floor Management';
      case 'orders': return 'Active Orders';
      case 'billing': return isCaptain ? 'Take Order / KOT Menu' : 'Billing / POS';
      case 'history': return 'Bill History';
      case 'kothistory': return 'KOT History';
      case 'analytics': return 'Analytics';
      case 'daybook': return 'DayBook';
      case 'menu': return 'Menu Management';
      case 'delivery': return 'Delivery Orders';
      case 'pickup': return 'Pickup Orders';
      case 'expenses': return 'Petty Cash & Expenses';
      case 'inventory': return 'Inventory & Stock';
      case 'crm': return 'Customer Directory (CRM)';
      case 'staff': return 'Staff Management';
      case 'qrcode': return 'QR Menu Generator';
      case 'settings': return 'System Settings';
      case 'kds': return 'Kitchen Display System';
      default: return 'Restaurant Management';
    }
  };

  // Helper for Tailored Notification Styling & Badges across ALL notification types
  const getToastStyling = (info) => {
    if (!info) return { border: 'border-l-blue-500', bgIcon: 'bg-blue-100 text-blue-600', Icon: Bell, badge: null, badgeBg: 'bg-blue-100 text-blue-700' };
    const title = (info.title || '').toLowerCase();
    const msg = (info.message || '').toLowerCase();
    const type = (info.type || '').toLowerCase();

    // 1. Broadcast (SuperAdmin Announcements)
    if (type === 'broadcast' || title.includes('broadcast')) {
      return { border: 'border-l-purple-600 shadow-purple-500/10', bgIcon: 'bg-purple-100 text-purple-600', Icon: Radio, badge: 'Broadcast', badgeBg: 'bg-purple-100 text-purple-700' };
    }
    // 2. Cancellation Request
    if (type === 'error' || type.includes('cancel') || title.includes('cancel')) {
      return { border: 'border-l-red-500 shadow-red-500/10', bgIcon: 'bg-red-100 text-red-600', Icon: AlertTriangle, badge: 'Cancellation Req', badgeBg: 'bg-red-100 text-red-700' };
    }
    // 3. Food Ready / Dish Ready
    if (title.includes('food ready') || title.includes('dish ready') || title.includes('ready for table') || type === 'success') {
      return { border: 'border-l-emerald-500 shadow-emerald-500/10', bgIcon: 'bg-emerald-100 text-emerald-600', Icon: CheckCircle, badge: 'Food Ready', badgeBg: 'bg-emerald-100 text-emerald-700' };
    }
    // 4. Bill Saved & Printed / Invoice / Settle Bill
    if (title.includes('bill saved') || title.includes('print') || title.includes('paid') || title.includes('settle')) {
      return { border: 'border-l-cyan-600 shadow-cyan-500/10', bgIcon: 'bg-cyan-100 text-cyan-600', Icon: Receipt, badge: 'Bill Printed', badgeBg: 'bg-cyan-100 text-cyan-700' };
    }
    // 5. Table Service / Waiter Call / Water Request / Bill Request
    if (type.includes('service') || title.includes('service') || msg.includes('water') || msg.includes('waiter') || msg.includes('pay the bill')) {
      return { border: 'border-l-amber-500 shadow-amber-500/10', bgIcon: 'bg-amber-100 text-amber-600', Icon: UserCheck, badge: 'Table Service', badgeBg: 'bg-amber-100 text-amber-700' };
    }
    // 6. Kitchen / KOT Updates / Order Placed / New Items
    if (title.includes('kot') || title.includes('order placed') || title.includes('order updated') || title.includes('item quantity')) {
      return { border: 'border-l-orange-500 shadow-orange-500/10', bgIcon: 'bg-orange-100 text-orange-600', Icon: ChefHat, badge: 'Kitchen / KOT', badgeBg: 'bg-orange-100 text-orange-700' };
    }
    // 7. Low Stock / Inventory Reorder Alert
    if (title.includes('stock') || type.includes('inventory')) {
      return { border: 'border-l-rose-500 shadow-rose-500/10', bgIcon: 'bg-rose-100 text-rose-600', Icon: Package, badge: 'Stock Alert', badgeBg: 'bg-rose-100 text-rose-700' };
    }
    // Default system alert
    return { border: 'border-l-blue-500 shadow-blue-500/10', bgIcon: 'bg-blue-100 text-blue-600', Icon: Bell, badge: 'System Alert', badgeBg: 'bg-blue-100 text-blue-700' };
  };

  return (
    <div className={`h-screen flex flex-col font-sans overflow-hidden relative ${view === 'kds' ? 'bg-slate-950 text-slate-100' : 'bg-background text-text-main'}`}>

      {/* Toast Notification Banner (Exact Content for all notification types) */}
      <AnimatePresence>
        {toastNotifInfo && (() => {
          const style = getToastStyling(toastNotifInfo);
          const IconComponent = style.Icon;
          return (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 20, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              className={`fixed z-[99999] top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md sm:top-6 sm:left-auto sm:-translate-x-0 sm:right-6 sm:w-auto sm:min-w-[350px] bg-white border border-gray-200 border-l-4 ${style.border} px-4 py-3.5 rounded-2xl shadow-2xl flex items-start gap-3 cursor-pointer`}
              onClick={() => {
                setToastNotifInfo(null);
                handleViewChange('notification');
              }}
            >
              {/* Dynamic Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.bgIcon}`}>
                <IconComponent size={18} className="animate-pulse" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h4 className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                    {toastNotifInfo.title}
                  </h4>
                  {style.badge && (
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 ${style.badgeBg}`}>
                      {style.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 leading-snug line-clamp-2">
                  {toastNotifInfo.message}
                </p>
                {toastNotifInfo.imageUrl && (
                  <div className="mt-2 w-full h-20 rounded-lg bg-gray-100 overflow-hidden relative border border-gray-200">
                    <img src={toastNotifInfo.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToastNotifInfo(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Offline / Sync Status Banner */}
      {/* 
        {(!onlineStatus.isOnline || onlineStatus.pendingCount > 0) && (
         <div className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold tracking-wide shrink-0 z-50 ${
           !onlineStatus.isOnline 
             ? 'bg-red-600 text-white' 
             : 'bg-amber-500 text-amber-950'
         }`}>
           {!onlineStatus.isOnline ? (
             <>
               <WifiOff size={18} />
               <span>You are offline — orders will be saved locally and synced when internet returns</span>
             </>
           ) : (
             <>
               <RefreshCw size={18} className="animate-spin" />
               <span>{onlineStatus.pendingCount} item{onlineStatus.pendingCount !== 1 ? 's' : ''} waiting to sync...</span>
             </>
           )}
         </div>
        )}
        */}

      {/* NEW RESPONSIVE TOP HEADER */}
      <header className={`min-h-[56px] sm:min-h-[58px] lg:min-h-[62px] xl:min-h-[66px] py-1 sm:py-1.5 flex items-center justify-between px-2 sm:px-3 lg:px-4 border-b shadow-xs shrink-0 gap-1 sm:gap-2 lg:gap-3 w-full z-40 relative overflow-visible ${view === 'kds' ? 'bg-slate-950 border-slate-800/80 text-slate-100' : 'bg-surface border-border/40 text-text-main'
        }`}>
        {/* Left: Hamburger & Logo */}
        <div className="flex items-center min-w-0 shrink-0 gap-1">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-1 rounded-lg transition-colors shrink-0 flex items-center justify-center ${view === 'kds' ? 'text-slate-300 hover:bg-slate-800' : 'text-text-main hover:bg-surface-hover'
              }`}>
            <Menu size={20} className="sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => handleViewChange('floor')}
            className="flex items-center cursor-pointer relative shrink-0 focus:outline-none py-0.5 px-0.5 min-w-[105px] sm:min-w-[135px] md:min-w-[160px] lg:min-w-[210px] xl:min-w-[250px] 2xl:min-w-[270px] hover:opacity-90 transition-opacity overflow-visible"
            title={t("Go to Table View / Floor Management")}>
            <img
              src={logoImg}
              alt="msbillings"
              className="h-9.5 sm:h-10.5 md:h-11 lg:h-12 xl:h-14 2xl:h-15 w-auto object-contain block transform scale-145 sm:scale-150 md:scale-155 lg:scale-175 xl:scale-190 origin-left"
              style={{ objectFit: 'contain' }}
            />
          </button>
          <span className={`relative z-[99] ml-1 sm:ml-2 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shadow-sm border whitespace-nowrap ${onlineStatus?.isOnline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
            {onlineStatus?.isOnline ? '● Online' : '● Offline'}
          </span>
        </div>

        {/* Desktop / Tablet Search & Actions */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-2.5 flex-1 max-w-lg min-w-0 mx-1 lg:mx-2">
          {!isChef && (
            <>
              <button
                onClick={() => handleViewChange('billing')}
                className="px-2.5 lg:px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-xs transition-colors whitespace-nowrap text-xs lg:text-sm shrink-0">
                {t('New Order')}
              </button>

              <div className="relative flex-1 min-w-[70px] max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder={t('Bill No')}
                  value={searchBillNo}
                  onChange={(e) => setSearchBillNo(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  className="w-full pl-8 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 text-xs lg:text-sm text-gray-800" />
              </div>
            </>
          )}

          {/* License Expiry Badge */}
          {daysRemaining !== null && (
            <button
              onClick={() => setShowExpiryPopup(true)}
              className={`hidden lg:flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap shrink-0 ${daysRemaining <= 0 ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' :
                daysRemaining <= 15 ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                  'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
              <CalendarClock size={12} />
              <span>
                {daysRemaining <= 0 ? t('Expired!') : daysRemaining > 365 ? t('Lifetime') : `${daysRemaining}${t('d left')}`}
              </span>
            </button>
          )}
        </div>

        {/* Right Section Header Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
            <PhoneCall size={16} className="text-red-500" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] text-gray-500 font-semibold uppercase">{t('Call For Support')}</span>
              <span className="text-xs font-bold text-gray-800">9701800140</span>
            </div>
          </div>

          {/* Snoozed Update Pill Badge */}
          {updateInfo && updateSnoozeInfo && Date.now() < updateSnoozeInfo.snoozeUntil && (
            <button
              onClick={() => setShowUpdateModal(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer animate-pulse"
              title={t("New update ready — Click to install now")}
            >
              <Clock size={13} className="text-amber-600 shrink-0" />
              <span className="hidden sm:inline">{t("Update Snoozed")} ({updateSnoozeInfo.label || 'Later'})</span>
              <span className="sm:hidden">{t("Update")}</span>
            </button>
          )}

          {/* Hold Bills Badge Button (Visible on mobile & desktop except KDS and Chef) */}
          {view !== 'kds' && !isChef && (
            <button
              onClick={() => handleViewChange('orders')}
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition-all shadow-xs relative shrink-0"
              title={t("View Hold Bills (Active Orders)")}>
              <ClipboardList size={15} className="shrink-0" />
              <span className="hidden xl:inline truncate">{t('Hold Bills')}</span>
              {activeOrdersCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-0.5 shrink-0 leading-none">
                  {activeOrdersCount > 99 ? '99+' : activeOrdersCount}
                </span>
              )}
            </button>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                // NOTE: Do NOT call markAllAsRead() here — that would persist all IDs
                // to localStorage and make NotificationCenter show everything as "Read"
                // without the user having actually read them.
                // Unread count is reset only via explicit mark-as-read in NotificationCenter.
              }}
              className={`p-1.5 rounded-lg transition-colors relative touch-target flex items-center justify-center ${view === 'kds' ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-600 hover:text-text-main hover:bg-surface-hover'
                }`}>
              <Bell size={18} />
              {totalUnreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] rounded-full h-3.5 min-w-[14px] px-1 flex items-center justify-center font-bold">
                  {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown — always fixed, never overflows any screen */}
            {showNotifications && (
              <>
                {/* Backdrop — closes panel on outside click */}
                <div className="fixed inset-0 z-[140]" onClick={() => setShowNotifications(false)} />

                {/* Panel — fixed to viewport, always visible, never overflows */}
                <div
                  className="fixed z-[150] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                  style={{
                    /* Position: just below the top navbar (~60px) */
                    top: '68px',
                    /* Right-align to screen edge with a small margin */
                    right: '8px',
                    /* Mobile: stretch to near-full-width; desktop: fixed 320px */
                    left: 'max(8px, calc(100vw - 336px))',
                    /* Height: never exceed 60% of the viewport */
                    maxHeight: 'min(60vh, calc(100vh - 88px))',
                    /* Minimum reasonable width */
                    minWidth: '260px',
                  }}
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0 rounded-t-2xl">
                    <span className="font-bold text-gray-800 text-sm">{t("Notifications")}</span>
                    <span
                      onClick={() => { setShowNotifications(false); handleViewChange('notification'); }}
                      className="text-xs bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full font-bold cursor-pointer hover:bg-red-200 active:scale-95 transition-transform select-none"
                    >
                      {t("View All")}
                    </span>
                  </div>

                  {/* Scrollable list — grows to fill space, scrolls internally */}
                  <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-50 min-h-0">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-10 text-center text-xs text-gray-400 font-medium">
                        {t("No new notifications")}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (n.isBroadcast) {
                              markAsRead(n.id);
                            }
                          }}
                          className={`px-3 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors flex gap-2.5 items-start ${n.isBroadcast ? 'bg-purple-50/30 hover:bg-purple-50/60' : ''
                            }`}
                        >
                          {/* Colour dot or Broadcast icon */}
                          {n.isBroadcast ? (
                            <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                              <Radio size={11} className="text-purple-600" />
                            </div>
                          ) : (
                            <div
                              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'warning' ? 'bg-amber-500' :
                                  n.type === 'success' ? 'bg-green-500' :
                                    n.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5 mb-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-xs font-bold text-gray-800 leading-snug truncate">{n.title}</p>
                                {n.isBroadcast && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 uppercase tracking-wider shrink-0">
                                    Broadcast
                                  </span>
                                )}
                              </div>
                              {/* Generation Timestamp */}
                              <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap shrink-0 ml-1">
                                {formatNotifTime(n)}
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed break-words">{n.message}</p>

                            {/* Broadcast Media/Image Preview */}
                            {n.isBroadcast && n.imageUrl && (
                              <div className="mt-2 w-full h-24 rounded-lg bg-gray-100 overflow-hidden relative border border-purple-100 shadow-2xs">
                                <img src={n.imageUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}

                            {/* Inline Broadcast Reply Box / Sent Reply Display */}
                            {n.isBroadcast && (() => {
                              const rawId = n.broadcastId || n.data?.broadcastId || n.id || '';
                              const bId = String(rawId).replace(/^broadcast_/, '');
                              const tenantDb = localStorage.getItem('resto_db_name') || 'default';
                              const savedReply = n.myReply || sentReplies[bId] ||
                                (bId ? localStorage.getItem(`broadcast_sent_reply_${bId}_${tenantDb}`) : null);
                              const isEditing = Boolean(editingReplyId[bId]);
                              const currentText = broadcastReplies[bId] !== undefined ? broadcastReplies[bId] : (savedReply || '');

                              if (savedReply && !isEditing) {
                                return (
                                  <div className="mt-2.5 pt-2 border-t border-purple-100/70 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider flex items-center gap-1">
                                        <CheckCircle size={11} className="text-emerald-500" />
                                        {t("Your Reply")}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setBroadcastReplies(prev => ({ ...prev, [bId]: savedReply }));
                                          setEditingReplyId(prev => ({ ...prev, [bId]: true }));
                                        }}
                                        className="text-[10px] font-bold text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 cursor-pointer bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200 transition-colors"
                                      >
                                        <Edit size={10} />
                                        {t("Edit")}
                                      </button>
                                    </div>
                                    <div className="bg-purple-50/70 border border-purple-100 rounded-xl px-3 py-1.5 text-xs text-gray-800 break-words font-medium">
                                      "{savedReply}"
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="mt-2 pt-1.5 border-t border-purple-100 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  {broadcastReplySuccess[bId] ? (
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
                                      <CheckCircle size={12} className="text-emerald-600" />
                                      <span>{t("Reply sent to Super-Admin!")}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={currentText}
                                        onChange={(e) => setBroadcastReplies(prev => ({ ...prev, [bId]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSendBroadcastReply(e, n);
                                          }
                                        }}
                                        placeholder={t("Reply to super admin...")}
                                        className="flex-1 min-w-0 bg-white border border-purple-200 focus:border-purple-500 rounded-xl px-2.5 py-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none shadow-2xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => handleSendBroadcastReply(e, n)}
                                        disabled={submittingBroadcastReply[bId] || !(currentText.trim())}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${submittingBroadcastReply[bId] || !(currentText.trim())
                                            ? 'bg-purple-200 text-purple-400 cursor-not-allowed'
                                            : 'bg-purple-600 hover:bg-purple-700 active:scale-95 text-white cursor-pointer shadow-xs'
                                          }`}
                                      >
                                        {submittingBroadcastReply[bId] ? (
                                          <Loader2 size={11} className="animate-spin" />
                                        ) : (
                                          <Send size={11} />
                                        )}
                                        <span>{savedReply ? t("Update") : t("Reply")}</span>
                                      </button>
                                      {isEditing && (
                                        <button
                                          type="button"
                                          onClick={() => setEditingReplyId(prev => ({ ...prev, [bId]: false }))}
                                          className="text-xs text-gray-400 hover:text-gray-600 p-1 cursor-pointer font-bold"
                                          title={t("Cancel")}
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Accept / Reject for cancel-item requests */}
                            {n.data?.type === 'cancel_item_request' && (
                              <div className="mt-2 flex flex-wrap gap-2 items-center">
                                {resolvingCancelIds[n.id] === 'accept' ? (
                                  <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-lg text-xs font-bold animate-pulse">
                                    <Loader2 size={12} className="animate-spin" />
                                    {t("Accepting...")}
                                  </span>
                                ) : resolvingCancelIds[n.id] === 'reject' ? (
                                  <span className="flex items-center gap-1.5 bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 rounded-lg text-xs font-bold animate-pulse">
                                    <Loader2 size={12} className="animate-spin" />
                                    {t("Rejecting...")}
                                  </span>
                                ) : resolvingCancelIds[n.id] === 'accept_done' ? (
                                  <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-lg text-xs font-bold">
                                    ✓ {t("Accepted")}
                                  </span>
                                ) : resolvingCancelIds[n.id] === 'reject_done' ? (
                                  <span className="flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 rounded-lg text-xs font-bold">
                                    ✕ {t("Rejected")}
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => handleResolveCancelItem(e, n, 'accept')}
                                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                    >
                                      ✓ {t("Accept")}
                                    </button>
                                    <button
                                      onClick={(e) => handleResolveCancelItem(e, n, 'reject')}
                                      className="bg-rose-500 hover:bg-rose-600 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                    >
                                      ✕ {t("Reject")}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer — always visible at bottom */}
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center shrink-0 rounded-b-2xl">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rtClearNotification('ALL');
                        if (isAdmin || isManager) {
                          clearAllBroadcasts();
                        }
                        setShowNotifications(false);
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-700 active:scale-95 transition-transform py-1 px-3 cursor-pointer"
                    >
                      {t("Clear All")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Chef-only KOT Page / History Icon in Top Navbar - visible on all chef views */}
          {isChef && (
            <button
              onClick={() => handleViewChange('kothistory')}
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer ${view === 'kothistory'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border border-amber-500/30'
                }`}
              title={t("KOT Page / History")}
            >
              <Printer size={18} />
              <span className="hidden sm:inline text-xs">{t("KOT History")}</span>
            </button>
          )}

          {/* Desktop/Tablet Quick Icons */}
          <button onClick={() => setShowCalculator(true)} className="p-1 sm:p-1.5 hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors hidden sm:flex items-center justify-center text-gray-600 shrink-0" title={t("Calculator")}>
            <Calculator size={18} />
          </button>

          <button onClick={() => setProfileOpen(!profileOpen)} className="p-1 sm:p-1.5 hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors hidden sm:flex items-center justify-center text-gray-600 shrink-0" title={t("User Profile")}>
            <User size={18} />
          </button>

          {/* Mobile Quick Action Dropdown Trigger (Ensures NO features/buttons are missing on mobile) */}
          <button
            onClick={() => setShowMobileQuickActions(!showMobileQuickActions)}
            className={`sm:hidden p-1.5 rounded-lg transition-colors touch-target flex items-center justify-center border shrink-0 ${view === 'kds' ? 'text-slate-300 border-slate-800 hover:bg-slate-800' : 'text-gray-700 hover:bg-surface-hover border-border/60'
              }`}
            title="More Actions">
            <MoreVertical size={18} />
          </button>
        </div>

        {/* Mobile Profile Dropdown (Desktop) */}
        {profileOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)}></div>
            <div className="absolute right-4 top-14 mt-1 w-48 bg-surface rounded-xl shadow-xl border border-border overflow-hidden z-50 py-1">
              <div className="px-4 py-2 border-b border-border/50 bg-gray-50/50">
                <span className="block text-sm font-bold text-text-main">{user.username}</span>
                <span className="block text-[10px] text-text-muted uppercase tracking-wider font-bold mt-0.5">{user.role}</span>
              </div>
              {isAdmin && (
                <button
                  onClick={() => { handleViewChange('settings'); setProfileOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-medium text-text-main hover:bg-surface-hover flex items-center gap-2">
                  <SettingsIcon size={16} className="text-text-muted" />{t("Settings")}
                </button>
              )}
              <button
                onClick={() => { setShowLogoutConfirm(true); setProfileOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-danger hover:bg-danger/5 flex items-center gap-2 border-t border-border">
                <LogOut size={16} /> {t('Logout')}
              </button>
            </div>
          </>
        )}

        {/* MOBILE QUICK ACTIONS MODAL / DROPDOWN (Ensures all desktop header buttons & search are cleanly usable on mobile) */}
        {showMobileQuickActions && (
          <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 md:hidden" onClick={() => setShowMobileQuickActions(false)} />
            <div className="fixed top-14 right-2 left-2 z-[60] bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 space-y-3 max-h-[85vh] overflow-y-auto animate-fade-in md:hidden">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="font-bold text-gray-800 text-sm">{t("Quick Actions")}</span>
                <button onClick={() => setShowMobileQuickActions(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              {isChef && (
                <button
                  onClick={() => {
                    handleViewChange('kothistory');
                    setShowMobileQuickActions(false);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Printer size={18} />
                  <span>{t('KOT Page / History')}</span>
                </button>
              )}

              {!isChef && (
                <>
                  <button
                    onClick={() => {
                      handleViewChange('billing');
                      setShowMobileQuickActions(false);
                    }}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm">
                    <UtensilsCrossed size={18} />
                    <span>{t('New Order')}</span>
                  </button>

                  <div className="relative w-full">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t('Search Bill No...')}
                      value={searchBillNo}
                      onChange={(e) => setSearchBillNo(e.target.value)}
                      onKeyDown={(e) => {
                        handleSearchKeyPress(e);
                        if (e.key === 'Enter') setShowMobileQuickActions(false);
                      }}
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-red-500" />
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => {
                    handleViewChange('reservation');
                    setShowMobileQuickActions(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700">
                  <CalendarClock size={16} className="text-emerald-500" />
                  <span>{t('Reservation')}</span>
                </button>

                <button
                  onClick={() => {
                    setShowCalculator(true);
                    setShowMobileQuickActions(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700">
                  <Calculator size={16} className="text-orange-500" />
                  <span>{t('Calculator')}</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      handleViewChange('settings');
                      setShowMobileQuickActions(false);
                    }}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700">
                    <SettingsIcon size={16} className="text-blue-500" />
                    <span>{t('Settings')}</span>
                  </button>
                )}
              </div>

              {daysRemaining !== null && (
                <button
                  onClick={() => {
                    setShowExpiryPopup(true);
                    setShowMobileQuickActions(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700">
                  <span className="flex items-center gap-2">
                    <CalendarClock size={16} />
                    <span>{t('License Status')}</span>
                  </span>
                  <span>{daysRemaining <= 0 ? t('Expired!') : daysRemaining > 365 ? t('Lifetime') : `${daysRemaining}d left`}</span>
                </button>
              )}

              <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                <span className="font-semibold text-gray-500">{t('Support')}</span>
                <span className="font-bold text-gray-800 flex items-center gap-1">
                  <PhoneCall size={14} className="text-red-500" /> 9701800140
                </span>
              </div>

              <button
                onClick={() => {
                  setShowLogoutConfirm(true);
                  setShowMobileQuickActions(false);
                }}
                className="w-full py-2.5 bg-red-50 border border-red-200 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 text-xs hover:bg-red-100">
                <Power size={16} />
                <span>{t('Logout')}</span>
              </button>
            </div>
          </>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden relative">

        {/* Drawer Backdrop Overlay (Mobile only) */}
        {mobileMenuOpen &&
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity lg:hidden"
            onClick={() => setMobileMenuOpen(false)} />

        }

        {/* Sidebar Drawer */}
        <aside className={`fixed lg:relative inset-y-0 left-0 z-[110] bg-surface flex flex-col shrink-0 shadow-2xl lg:shadow-none lg:border-border/40 transition-all duration-300 ease-in-out overflow-hidden ${mobileMenuOpen ? 'w-64 translate-x-0 lg:border-r opacity-100 visible' : 'w-0 -translate-x-full lg:-translate-x-full opacity-0 invisible border-none'}`}>

          <nav className="flex-1 px-3 pt-8 pb-4 space-y-6 overflow-y-auto custom-scrollbar">

            {/* CHEF SECTION */}
            {isChef && (
              <div>
                <div className="px-3 py-1 mb-1.5 flex items-center justify-between">
                  <h3 className="text-[13px] font-black text-amber-500 uppercase tracking-widest">{t('Chef Portal')}</h3>
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => handleViewChange('kds')}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'kds' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>
                    <UtensilsCrossed size={22} />
                    <span>{t('Kitchen Display (KDS)')}</span>
                  </button>

                  <button
                    onClick={() => handleViewChange('kothistory')}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'kothistory' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>
                    <Printer size={22} />
                    <span>{t('KOT Page / History')}</span>
                  </button>

                  <button
                    onClick={() => handleViewChange('notification')}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'notification' ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>
                    <div className="flex items-center gap-3">
                      <Bell size={22} />
                      <span>{t('Notifications')}</span>
                    </div>
                    {totalUnreadCount > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${view === 'notification' ? 'bg-white text-red-600' : 'bg-red-500 text-white'}`}>
                        {totalUnreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* MAIN SECTION */}
            {!isChef &&
              <div>
                <button
                  onClick={() => setSidebarSections((s) => ({ ...s, main: !s.main }))}
                  className="w-full flex items-center justify-between px-3 py-1 mb-1.5 group">

                  <h3 className="text-[13px] font-black text-red-500/90 group-hover:text-red-600 uppercase tracking-widest transition-colors">{t('Main')}</h3>
                  {sidebarSections.main ? <ChevronDown size={18} className="text-red-500/90 group-hover:text-red-600" /> : <ChevronRight size={18} className="text-red-500/90 group-hover:text-red-600" />}
                </button>
                {sidebarSections.main &&
                  <div className="space-y-0.5">
                    <button
                      onClick={() => handleViewChange('floor')}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'floor' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                      <LayoutGrid size={22} />
                      <span>{t('Floor Management')}</span>
                    </button>

                    <button
                      onClick={() => handleViewChange('billing')}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'billing' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                      <LayoutDashboard size={22} />
                      <span>{isCaptain ? t('Captain Order') : t('New Order')}</span>
                    </button>

                    <button
                      onClick={() => handleViewChange('orders')}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'orders' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                      <div className="flex items-center gap-3">
                        <ClipboardList size={22} />
                        <span>{t('Active Orders')}</span>
                      </div>
                      {activeOrdersCount > 0 &&
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${view === 'orders' ? 'bg-primary text-white' : 'bg-primary/20 text-primary'}`}>
                          {activeOrdersCount}
                        </span>
                      }
                    </button>

                    {!isCaptain &&
                      <>
                        <button
                          onClick={() => handleViewChange('history')}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'history' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                          <History size={22} />
                          <span>{t('Bill History')}</span>
                        </button>
                        <button
                          onClick={() => handleViewChange('edited-bills')}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'edited-bills' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                          <History size={22} />
                          <span>{t('Edited Bills')}</span>
                        </button>
                      </>
                    }

                    <button
                      onClick={() => handleViewChange('kothistory')}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'kothistory' ? 'bg-linear-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                      <Printer size={22} />
                      <span>{t('KOT History')}</span>
                    </button>
                  </div>
                }
              </div>
            }

            {/* OPERATIONS SECTION */}
            {!isCaptain && !isChef && (features.kds !== false || features.expenses !== false || features.delivery !== false) &&
              <div>
                <button
                  onClick={() => setSidebarSections((s) => ({ ...s, operations: !s.operations }))}
                  className="w-full flex items-center justify-between px-3 py-1 mb-1.5 group">

                  <h3 className="text-[13px] font-black text-red-500/90 group-hover:text-red-600 uppercase tracking-widest transition-colors">{t('Operations')}</h3>
                  {sidebarSections.operations ? <ChevronDown size={18} className="text-red-500/90 group-hover:text-red-600" /> : <ChevronRight size={18} className="text-red-500/90 group-hover:text-red-600" />}
                </button>
                {sidebarSections.operations &&
                  <div className="space-y-0.5">
                    {features.kds !== false &&
                      <button
                        onClick={() => handleViewChange('kds')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'kds' ? 'bg-linear-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <UtensilsCrossed size={22} />
                        <span>{t('Kitchen Display (KDS)')}</span>
                      </button>
                    }

                    {!isChef && features.delivery !== false &&
                      <button
                        onClick={() => handleViewChange('delivery')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'delivery' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <Truck size={22} />
                        <span>{t('Delivery Orders')}</span>
                      </button>
                    }

                    {!isChef && features.delivery !== false &&
                      <button
                        onClick={() => handleViewChange('pickup')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'pickup' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <ShoppingBag size={22} />
                        <span>{t('Pickup Orders')}</span>
                      </button>
                    }

                    {!isChef &&
                      <button
                        onClick={() => handleViewChange('reservation')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'reservation' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>
                        <CalendarClock size={22} />
                        <span>{t('Table Reservations')}</span>
                      </button>
                    }

                    {!isChef && features.expenses !== false &&
                      <button
                        onClick={() => handleViewChange('expenses')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'expenses' ? 'bg-linear-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <Wallet size={22} />
                        <span>{t('Petty Cash')}</span>
                      </button>
                    }

                    {!isChef &&
                      <button
                        onClick={() => handleViewChange('operations')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'operations' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <LayoutGrid size={22} />
                        <span>{t('Extra Operations')}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            }

            {/* MANAGEMENT SECTION */}
            {!isCaptain && !isChef &&
              <div>
                <button
                  onClick={() => setSidebarSections((s) => ({ ...s, management: !s.management }))}
                  className="w-full flex items-center justify-between px-3 py-1 mb-1.5 group">

                  <h3 className="text-[13px] font-black text-red-500/90 group-hover:text-red-600 uppercase tracking-widest transition-colors">{t('Management')}</h3>
                  {sidebarSections.management ? <ChevronDown size={18} className="text-red-500/90 group-hover:text-red-600" /> : <ChevronRight size={18} className="text-red-500/90 group-hover:text-red-600" />}
                </button>
                {sidebarSections.management &&
                  <div className="space-y-0.5">
                    <button
                      onClick={() => handleViewChange('dashboard')}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'dashboard' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                      <Home size={22} />
                      <span>{t('Dashboard')}</span>
                    </button>

                    {(isAdmin || isManager) && features.analytics !== false &&
                      <button
                        onClick={() => handleViewChange('analytics')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'analytics' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <BarChart3 size={22} />
                        <span>{t('Analytics')}</span>
                      </button>
                    }

                    {features.daybook !== false &&
                      <button
                        onClick={() => handleViewChange('daybook')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'daybook' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <BookOpen size={22} />
                        <span>{t('DayBook')}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            }

            {/* SYSTEM SECTION */}
            {!isCaptain && !isChef &&
              <div>
                <button
                  onClick={() => setSidebarSections((s) => ({ ...s, system: !s.system }))}
                  className="w-full flex items-center justify-between px-3 py-1 mb-1.5 group">

                  <h3 className="text-[13px] font-black text-red-500/90 group-hover:text-red-600 uppercase tracking-widest transition-colors">{t('System')}</h3>
                  {sidebarSections.system ? <ChevronDown size={18} className="text-red-500/90 group-hover:text-red-600" /> : <ChevronRight size={18} className="text-red-500/90 group-hover:text-red-600" />}
                </button>
                {sidebarSections.system &&
                  <div className="space-y-0.5">
                    {(isAdmin || isManager) && features.inventory !== false &&
                      <button
                        onClick={() => handleViewChange('inventory')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'inventory' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <Package size={22} />
                        <span>{t("Inventory")}</span>
                      </button>
                    }

                    {features.crm !== false &&
                      <button
                        onClick={() => handleViewChange('crm')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'crm' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <UsersIcon size={22} />
                        <span>{t("Customer CRM")}</span>
                      </button>
                    }

                    {(isAdmin || isManager) && features.staff !== false &&
                      <button
                        onClick={() => handleViewChange('staff')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'staff' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <UserCheck size={22} />
                        <span>{t("Staff HR")}</span>
                      </button>
                    }

                    {(isAdmin || isManager) && features.qrcode !== false &&
                      <button
                        onClick={() => handleViewChange('qrcode')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'qrcode' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <QrCode size={22} />
                        <span>{t("QR Menu Generator")}</span>
                      </button>
                    }

                    <button
                      onClick={() => handleViewChange('menu')}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'menu' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                      <UtensilsCrossed size={22} />
                      <span>{t("Menu")}</span>
                    </button>

                    {isAdmin &&
                      <button
                        onClick={() => handleViewChange('settings')}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-[1.05rem] ${view === 'settings' ? 'bg-linear-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/30 font-bold translate-x-1' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:translate-x-1'}`}>

                        <SettingsIcon size={22} />
                        <span>{t('Settings')}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </nav>

          <div className="p-6">
            <button
              onClick={() => {
                setShowLogoutConfirm(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 transition-all font-medium hover:shadow-md">

              <LogOut size={20} />
              <span>{t('Logout')}</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Service Request Alert Overlay */}
          <Suspense fallback={null}>
            <ServiceRequestAlert />
          </Suspense>

          {/* Global Modals */}
          <Suspense fallback={null}>
            <ContactSupportModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
            <UserManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} />
            <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} version={appVersion} />
          </Suspense>

          <main className={`flex-1 overflow-y-auto overflow-x-hidden p-0 ${view === 'kds' ? 'bg-slate-950' : ''}`}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-text-muted font-medium">{t("Loading...")}</p>
                </div>
              </div>
            }>
              {(() => {
                // Dependency to trigger re-render on socket update
                const ticker = settingsUpdateTicker;
                const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
                let isProtected = false;
                if (view === 'security') isProtected = s.requireMasterPin !== false;
                else if (s.customLocks && s.customLocks[view]) isProtected = s.customLocks[view].enabled;

                return isProtected && !unlockedFeatures[view];
              })() ?
                <div className="h-full flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                      <Lock size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-text-main">{t(view === 'security' ? 'Security Settings Locked' : 'Owner Access Protected')}</h2>
                      <p className="text-[1.05rem] text-text-muted mt-1.5 leading-relaxed">
                        {t(view === 'security' ? 'Please enter your Master PIN to access security settings.' : 'Please enter the security PIN to access sensitive features (')}
                        {view !== 'security' ? getTitle() + ').' : ''}
                      </p>
                    </div>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!pinInput || isVerifyingPin) return;
                      setIsVerifyingPin(true);
                      try {
                        const API_BASE_URL = getApiUrl();
                        const token = localStorage.getItem('accessToken');
                        const dbName = localStorage.getItem('resto_db_name');

                        const res = await fetch(`${API_BASE_URL}/config/verify-pin`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'X-Tenant-DB': dbName || '',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({ featureId: view, pin: pinInput })
                        });

                        const data = await res.json();
                        if (data.success) {
                          setUnlockedFeatures(prev => {
                            const updated = { ...prev, [view]: true };
                            sessionStorage.setItem('unlockedFeatures', JSON.stringify(updated));
                            return updated;
                          });
                          setPinError(false);
                          setPinInput('');
                        } else {
                          setPinError(true);
                        }
                      } catch (err) {
                        console.error('Error verifying PIN:', err);
                        setPinError(true);
                      } finally {
                        setIsVerifyingPin(false);
                      }
                    }} className="space-y-4">
                      <div className="relative">
                        <input
                          type={showPin ? "text" : "password"}
                          maxLength="10"
                          placeholder="• • • •"
                          value={pinInput}
                          onChange={(e) => {
                            setPinInput(e.target.value);
                            setPinError(false);
                          }}
                          className={`w-full text-center tracking-[0.5em] text-2xl font-bold py-4 bg-background border-2 rounded-2xl focus:outline-none transition-all ${pinError ? 'border-danger bg-danger/5 text-danger' : 'border-border focus:border-primary focus:ring-4 focus:ring-primary/10'}`
                          }
                          autoFocus />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPin ? <EyeOff size={24} /> : <Eye size={24} />}
                        </button>

                        {pinError && <p className="text-xs font-bold text-danger animate-bounce mt-2">{t("Incorrect PIN! Please try again.")}</p>}
                      </div>

                      <button
                        type="submit"
                        disabled={isVerifyingPin}
                        className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all text-base transform active:scale-[0.98] cursor-pointer disabled:opacity-50">{t(view === 'security' ? 'Unlock Settings' : 'Unlock Owner Reports')}


                      </button>
                    </form>
                  </div>
                </div> :

                <>
                  {view === 'dashboard' && <Dashboard onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'floor' && <FloorManagement onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'orders' &&
                    <ActiveOrders
                      onSelectOrder={(tableNo) => {
                        handleViewChange('billing', tableNo);
                      }}
                      onOrderUpdate={fetchActiveOrdersCount}
                      onNavigate={handleViewChange} onGoBack={handleGoBack} />

                  }
                  {view === 'billing' && <BillingPage initialTable={selectedTable} onOrderUpdate={fetchActiveOrdersCount} onNavigate={handleViewChange} onGoBack={handleGoBack} userRole={userRole} onToggleMenu={() => setMobileMenuOpen(true)} />}
                  {view === 'history' && <BillHistory onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'edited-bills' && <EditedBills onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'kothistory' && <KOTHistory onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'analytics' && <Analytics onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'daybook' && <DayBook onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'operations' && <Operations onNavigate={handleViewChange} onGoBack={handleGoBack} userRole={user?.role?.toLowerCase()} />}
                  {view === 'tax' && <TaxConfig onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'discount' && <DiscountConfig onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {(view === 'withdrawal' || view === 'cash-topup') && <CashOperations onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'due-payment' && <DuePayment onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'reservation' && <Reservation onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'feedback' && <Feedback onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'push-orders' && <PushOrders onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'bill-print' && <PrinterConfig onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'online-config' && <OnlineConfig onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'online-orders' && <OnlineOrders onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'sync' && <ManualSync onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'admin' && <AdminDashboard onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'security' && <SecuritySettings onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'menu' && <MenuManagement user={user} onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'delivery' && <DeliveryOrders onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'pickup' && <PickupOrders onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'expenses' && <Expenses onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'inventory' && <InventoryManagement onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'crm' && <CRM onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'staff' && <StaffManagement onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'qrcode' && <QRCodeGenerator onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'settings' && <Settings user={user} setUser={setUser} onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'kds' && <KDS onNavigate={handleViewChange} onGoBack={handleGoBack} />}

                  {/* Placeholder Routes */}
                  {view === 'notification' && <NotificationCenter onNavigate={handleViewChange} onGoBack={handleGoBack} userRole={userRole} />}
                  {view === 'help' && <HelpSupport onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'live-view' && <LiveView onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'language' && <LanguageProfile onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'currency' && <CurrencyConversion onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'billing-screen' && <BillingScreenSettings onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'menu-toggle' && <MenuToggle onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'renewal' && <ServiceRenewal onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'custom-status' && <CustomStatus onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'loyalty' && <LoyaltyProgram onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                  {view === 'forecasting' && <SalesForecasting onNavigate={handleViewChange} onGoBack={handleGoBack} />}
                </>
              }
            </Suspense>
          </main>

          {/* Native Android Bottom Navigation Bar (Disabled per user request) */}
        </div>
      </div>{/* end flex-1 wrapper */}

      {showPermissionsModal && (
        <Suspense fallback={null}>
          <SystemPermissionsModal onComplete={() => {
            localStorage.setItem('system_permissions_granted', 'true');
            setShowPermissionsModal(false);
          }} />
        </Suspense>
      )}

      {/* License Expiry Warning Popup */}
      {showExpiryPopup && daysRemaining !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-9999 animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl border border-border shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-5 flex items-center justify-between ${daysRemaining <= 0 ?
              'bg-linear-to-r from-red-500/20 to-red-400/10' :
              daysRemaining > 365 ?
                'bg-linear-to-r from-emerald-500/20 to-emerald-400/10' :
                'bg-linear-to-r from-amber-500/20 to-amber-400/10'}`
            }>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${daysRemaining <= 0 ?
                  'bg-red-500/20 text-red-500' :
                  daysRemaining > 365 ?
                    'bg-emerald-500/20 text-emerald-500' :
                    'bg-amber-500/20 text-amber-500'}`
                }>
                  {daysRemaining > 365 ? <CalendarClock size={28} /> : <ShieldAlert size={28} />}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-text-main">
                    {daysRemaining <= 0 ?
                      'License Expired!' :
                      daysRemaining > 365 ?
                        'License Active!' :
                        'License Expiring Soon!'}
                  </h2>
                  <p className="text-xs text-text-muted font-medium">
                    {daysRemaining <= 0 ?
                      'Your software license has expired.' :
                      daysRemaining > 365 ?
                        'Your lifetime license is active.' :
                        `Only ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining!`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExpiryPopup(false)}
                className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center hover:bg-border transition-colors">

                <X size={18} className="text-text-muted" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="bg-background rounded-2xl p-4 border border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[1.05rem] text-text-muted font-medium">{t("Expiry Date")}</span>
                  <span className="text-[1.05rem] font-bold text-text-main">
                    {daysRemaining > 365 ?
                      'Permanent (Lifetime)' :
                      licenseExpiry ?
                        licenseExpiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) :
                        '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[1.05rem] text-text-muted font-medium">{t("Days Remaining")}</span>
                  <span className={`text-[1.05rem] font-bold ${daysRemaining <= 0 ?
                    'text-red-500' :
                    daysRemaining > 365 ?
                      'text-emerald-500' :
                      daysRemaining <= 7 ?
                        'text-red-500' :
                        'text-amber-500'}`
                  }>
                    {daysRemaining <= 0 ?
                      'EXPIRED' :
                      daysRemaining > 365 ?
                        'Lifetime' :
                        `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {/* Progress bar */}
                {daysRemaining <= 365 &&
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${daysRemaining <= 0 ? 'bg-red-500' : daysRemaining <= 7 ? 'bg-red-400' : 'bg-amber-400'}`
                      }
                      style={{ width: `${Math.max(0, Math.min(100, (15 - Math.max(0, daysRemaining)) / 15 * 100))}%` }} />

                  </div>
                }
              </div>

              {daysRemaining <= 365 ?
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-4 border border-amber-200 dark:border-amber-500/20">
                  <p className="text-[1.05rem] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                    {daysRemaining <= 0 ?
                      'Your license has expired. Please renew immediately to continue using all features without interruption.' :
                      'Your license will expire soon. Please renew before the expiry date to avoid any service interruption.'}
                  </p>
                </div> :

                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-500/20">
                  <p className="text-[1.05rem] text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">{t("Thank you for choosing MS Tech Hive! Your software license is fully active and has no upcoming expiration.")}

                  </p>
                </div>
              }

              {/* Contact Info */}
              {daysRemaining <= 365 &&
                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/15">
                  <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2">{t("Contact Customer Care")}</p>
                  <a href="tel:+919701800140" className="flex items-center gap-3 text-primary font-bold text-lg hover:underline">
                    <Phone size={20} />
                    +91 9701800140
                  </a>
                </div>
              }
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              <button
                onClick={() => setShowExpiryPopup(false)}
                className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all transform active:scale-[0.98]">
                {t("Got it, I'll Renew")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tools & Dialog Modals */}
      <Suspense fallback={null}>
        <CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
        <ContactSupportModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
        <UserManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} />
        <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} version={appVersion} />
        <UpdateModal isOpen={showUpdateModal} isDownloading={isUpdateDownloading} downloadProgress={updateDownloadProgress} updateInfo={updateInfo} onInstall={() => window.electronAPI?.installUpdate()} onClose={() => setShowUpdateModal(false)} onSnooze={handleSnoozeUpdate} />
      </Suspense>

      {/* Logout Confirmation Toast Modal */}
      {showLogoutConfirm &&
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-10 sm:pt-14 px-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm transform transition-all">
            <div className="flex flex-col items-center text-center">
              <p className="text-text-main font-medium text-base mb-6">{t("Are you sure you want to logout")}{' '}
                <span className="font-bold">{user?.username}</span>?
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-surface-hover hover:bg-border text-text-main font-medium rounded-xl transition-colors">{t("Cancel")}

                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="flex-1 py-2.5 px-4 bg-danger hover:bg-red-600 text-white font-medium rounded-xl transition-colors">

                  {t('Logout')}
                </button>
              </div>
            </div>
          </div>
        </div>
      }

    </div>);

}

export default App;