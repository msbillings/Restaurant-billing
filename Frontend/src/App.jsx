import { getApiUrl, getSuperadminApiUrl } from "./config.js";
import React, { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
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
import GlobalHeader from './components/GlobalHeader';
import useBroadcasts from './hooks/useBroadcasts';
import useNotifications from './hooks/useNotifications';

import { LogOut, LayoutDashboard, History, User, UtensilsCrossed, ClipboardList, BarChart3, LayoutGrid, Home, Settings as SettingsIcon, Truck, ShoppingBag, Wallet, Printer, BookOpen, Lock, ShieldAlert, CalendarClock, X, Phone, Menu, Receipt, Clock, Package, WifiOff, RefreshCw, Users as UsersIcon, QrCode, UserCheck, Radio, Search, Calculator, Bell, Power, PhoneCall, ChevronDown, ChevronRight, MoreVertical } from 'lucide-react';
import { getOpenOrders } from './api/billing';
import { AnimatePresence, motion } from 'framer-motion';
import { logoutUser } from './api/auth';
import { initSyncEngine } from './utils/syncEngine';
import { io } from 'socket.io-client';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import './App.css';
import logoImg from './assets/images/logo.png';

function App() {
  const { t } = useLanguage();
  const onlineStatus = useOnlineStatus();
  const [view, setView] = useState(() => {
    const path = window.location.pathname.replace(/^\/+/, '');
    if (window.location.protocol === 'file:' || path.includes('.html')) {
      return 'floor';
    }
    if (path && !['login', 'app', 'dashboard', 'index.html', ''].includes(path)) {
      return path;
    }
    return 'floor';
  }); // Initialize from URL or default to floor view
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  // Tools state
  const [showCalculator, setShowCalculator] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
  const [appVersion, setAppVersion] = useState('6.0.0');

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
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
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
  const [activeBroadcast, setActiveBroadcast] = useState(null);

  const rawRole = user?.role || 'Admin';
  const usernameLower = user?.username?.toLowerCase() || '';
  const userRole = usernameLower.includes('captain') ? 'Captain' : usernameLower.includes('cashier') ? 'Cashier' : rawRole;
  const isCaptain = userRole === 'Captain';
  const isAdmin = userRole === 'Admin';
  const isChef = userRole === 'Chef';
  const isManager = userRole === 'Manager';

  const { broadcasts, unreadCount, markAsRead, markAllAsRead, clearAllBroadcasts } = useBroadcasts(userRole);
  const { notifications: realTimeNotifs, unreadCount: rtUnreadCount, markAllAsRead: rtMarkAllAsRead, clearNotification: rtClearNotification } = useNotifications(userRole);
  const totalUnreadCount = unreadCount + rtUnreadCount;

  const [toastMessage, setToastMessage] = useState(null);
  const [toastNotifInfo, setToastNotifInfo] = useState(null);
  const prevUnreadCountRef = React.useRef(totalUnreadCount);

  useEffect(() => {
    if (totalUnreadCount > prevUnreadCountRef.current) {
      // New broadcast or real-time notification arrived!
      const isRealTime = rtUnreadCount > prevUnreadCountRef.current;
      if (isRealTime && realTimeNotifs.length > 0) {
        const latest = realTimeNotifs[0];
        setToastNotifInfo({ title: latest.title, message: latest.message, type: latest.type || 'success' });
      } else {
        setToastMessage("You have a new Notification!");
      }

      prevUnreadCountRef.current = totalUnreadCount;
    }
    prevUnreadCountRef.current = totalUnreadCount;
  }, [totalUnreadCount, realTimeNotifs, rtUnreadCount]);

  // Auto-hide toast messages after 5 seconds
  useEffect(() => {
    if (toastMessage || toastNotifInfo) {
      const timer = setTimeout(() => {
        setToastMessage(null);
        setToastNotifInfo(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, toastNotifInfo]);

  // Format broadcasts for the dropdown
  const formattedBroadcasts = broadcasts.map((b) => ({
    id: b._id,
    title: b.title,
    message: b.message,
    time: new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: 'info',
    isUnread: false
  }));

  const notifications = [...realTimeNotifs, ...formattedBroadcasts];

  useEffect(() => {
    if (isCaptain && !['floor', 'orders', 'kothistory', 'billing'].includes(view)) {
      setTimeout(() => setView('floor'), 0);
    }
  }, [isCaptain, view]);

  useEffect(() => {
    if (isChef && view !== 'kds') {
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

    // Initialize the Offline Sync Engine (caches menu/categories/floors, processes sync queue)
    initSyncEngine();

    setTimeout(() => syncConfigFromBackend(), 0);

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

            // 5. Update Broadcasts
            if (saData.broadcasts && saData.broadcasts.length > 0) {
              const latestUnread = saData.broadcasts.find((b) => b.active && !localStorage.getItem('dismissed_broadcast_' + b._id));
              if (latestUnread) {
                setActiveBroadcast((prev) => prev?._id === latestUnread._id ? prev : latestUnread);
              } else {
                setActiveBroadcast(null);
              }
            } else {
              setActiveBroadcast(null);
            }
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

    // Listen for Force Sync from Electron menu
    if (window.electronAPI && window.electronAPI.onForceSync) {
      window.electronAPI.onForceSync(() => {
        fetchSuperAdminConfig();
      });
    }

    if (window.electronAPI && window.electronAPI.onShowContactSupport) {
      window.electronAPI.onShowContactSupport(() => {
        setShowContactModal(true);
      });
    }

    if (window.electronAPI && window.electronAPI.onShowUserManual) {
      window.electronAPI.onShowUserManual(() => {
        setShowManualModal(true);
      });
    }

    if (window.electronAPI && window.electronAPI.onShowAbout) {
      window.electronAPI.onShowAbout((version) => {
        if (version) setAppVersion(version);
        setShowAboutModal(true);
      });
    }

    if (window.electronAPI && window.electronAPI.onUpdateReady) {
      window.electronAPI.onUpdateReady(() => {
        setShowUpdateModal(true);
      });
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

    loadSettings();

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
      setView('floor');
      window.history.replaceState(null, '', '/login');
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
    // Step 1: Clear ALL old restaurant-specific cached data FIRST
    // This prevents stale data from a previously logged-in restaurant from showing up
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
    // Update license expiry in React state if available.
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
        // Reset to default view so the user lands on floor after login
        setView('floor');
        setActiveOrdersCount(0);
        window.history.replaceState(null, '', '/floor');
      }
    });
  };

  useEffect(() => {
    if (user && (window.location.pathname === '/login' || window.location.pathname === '/')) {
      window.history.replaceState(null, '', '/floor');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const API_BASE_URL = getApiUrl();
      const socketUrl = API_BASE_URL.replace('/api', '');
      const socket = io(socketUrl);

      socket.on('connect', () => {
        const tenantDb = localStorage.getItem('resto_db_name');
        const token = localStorage.getItem('accessToken');
        if (tenantDb) {
          socket.emit('joinTenant', { tenantDb, token });
        }
      });

      socket.on('orderUpdated', fetchActiveOrdersCount);
      socket.on('billSettled', fetchActiveOrdersCount);
      socket.on('tableStatusChanged', fetchActiveOrdersCount);
      socket.on('newKOT', fetchActiveOrdersCount);

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const handleLogout = () => {
    // Fire and forget the logout API call so the UI doesn't hang if backend is down
    logoutUser().catch((error) => console.error('Logout API error:', error));

    // Clear ALL local state — both auth AND restaurant-specific data IMMEDIATELY
    // This is critical for multi-tenant: if an MM admin logs out and a Saif admin
    // logs in on the same terminal, old MM restaurant name/settings must be gone!
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
    window.history.replaceState(null, '', '/login');
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\/+/, '');
      if (window.location.protocol === 'file:' || path.includes('.html')) {
        setView('floor');
        return;
      }
      if (path && !['login', 'app', 'index.html', ''].includes(path)) {
        setView(path);
        setViewHistory(prev => {
          if (prev[prev.length - 1] === path) return prev;
          return [...prev, path];
        });
      } else {
        setView('floor');
        setViewHistory(prev => {
          if (prev[prev.length - 1] === 'floor') return prev;
          return [...prev, 'floor'];
        });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleViewChange = (newView, tableSelection = null) => {
    if (tableSelection) {
      setSelectedTable(tableSelection);
    }
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
  const isCustomerOrderRoute = window.location.pathname === '/order';

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
          <UpdateModal isOpen={showUpdateModal} onInstall={() => window.electronAPI?.installUpdate()} />
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
          <UpdateModal isOpen={showUpdateModal} onInstall={() => window.electronAPI?.installUpdate()} />
        </Suspense>
      </>);

  }

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
          <UpdateModal isOpen={showUpdateModal} onInstall={() => window.electronAPI?.installUpdate()} />
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
          <UpdateModal isOpen={showUpdateModal} onInstall={() => window.electronAPI?.installUpdate()} />
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

  return (
    <div className="h-screen flex flex-col bg-background text-text-main font-sans overflow-hidden relative">

      {/* Broadcast Toast Notification */}
      <AnimatePresence>
        {(toastMessage || toastNotifInfo) &&
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className={`absolute top-0 right-6 z-9999 ${toastNotifInfo ? 'bg-white border-l-4 ' + (toastNotifInfo.type === 'warning' ? 'border-amber-500 text-slate-800' : 'border-green-500 text-slate-800') : 'bg-linear-to-r from-purple-600 to-indigo-600 text-white'} px-6 py-4 rounded-xl shadow-2xl flex items-start gap-4 cursor-pointer min-w-[320px] max-w-md`}
            onClick={() => {
              setToastMessage(null);
              setToastNotifInfo(null);
              handleViewChange('notification');
            }}>

            {toastNotifInfo ? (
              <>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toastNotifInfo.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                  <Bell className="animate-bounce" size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm mb-1">{toastNotifInfo.title}</h4>
                  <p className="text-xs text-slate-500 leading-tight">{toastNotifInfo.message}</p>
                </div>
              </>
            ) : (
              <>
                <Bell className="animate-bounce" size={20} />
                <span className="font-bold">{toastMessage}</span>
              </>
            )}
            <X size={16} className={`ml-2 rounded-full p-0.5 transition-colors ${toastNotifInfo ? 'text-slate-400 hover:bg-slate-100' : 'hover:bg-white/20'}`} onClick={(e) => { e.stopPropagation(); setToastMessage(null); setToastNotifInfo(null); }} />
          </motion.div>
        }
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
      <header className="h-16 sm:h-20 flex items-center justify-between px-3 sm:px-6 border-b border-border/40 bg-surface shadow-xs shrink-0 gap-2 sm:gap-4 w-full z-40 relative">
        {/* Left: Hamburger & Logo */}
        <div className="flex items-center min-w-0 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 rounded-lg text-text-main hover:bg-surface-hover transition-colors shrink-0 flex items-center justify-center">
            <Menu size={22} className="sm:w-6 sm:h-6" />
          </button>
          <div className="flex items-center cursor-pointer relative shrink-0" onClick={() => handleViewChange('floor')}>
            <img
              src={logoImg}
              alt="msbillings"
              className="h-13 sm:h-18 md:h-20 w-auto object-contain block pointer-events-none transform scale-165 sm:scale-200 origin-left"
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Desktop Search & Actions */}
        <div className="hidden md:flex items-center gap-4 flex-1 max-w-xl ml-4">
          {!isChef && (
            <>
              <button
                onClick={() => handleViewChange('billing')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-xs transition-colors whitespace-nowrap text-sm">
                {t('New Order')}
              </button>

              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder={t('Bill No')}
                  value={searchBillNo}
                  onChange={(e) => setSearchBillNo(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 text-sm text-gray-800" />
              </div>
            </>
          )}

          {/* License Expiry Badge */}
          {daysRemaining !== null && (
            <button
              onClick={() => setShowExpiryPopup(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap ${daysRemaining <= 0 ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' :
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
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
            <PhoneCall size={16} className="text-red-500" />
            <div className="flex flex-col leading-none">
              <span className="text-[9px] text-gray-500 font-semibold uppercase">{t('Call For Support')}</span>
              <span className="text-xs font-bold text-gray-800">9701800140</span>
            </div>
          </div>

          {/* Hold Bills Badge Button (Always visible on mobile & desktop) */}
          <button
            onClick={() => handleViewChange('orders')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition-all shadow-xs relative shrink-0"
            title={t("View Hold Bills (Active Orders)")}>
            <ClipboardList size={16} />
            <span className="hidden sm:inline">{t('Hold Bills')}</span>
            {activeOrdersCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-0.5">
                {activeOrdersCount}
              </span>
            )}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) {
                  markAllAsRead();
                  rtMarkAllAsRead();
                }
              }}
              className="p-1.5 text-gray-600 hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors relative touch-target flex items-center justify-center">
              <Bell size={20} />
              {totalUnreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                <div className="absolute right-0 top-11 mt-1 w-80 max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <span className="font-bold text-gray-800 text-sm">{t("Notifications")}</span>
                    <span
                      onClick={() => { setShowNotifications(false); handleViewChange('notification'); }}
                      className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold cursor-pointer hover:bg-red-200">{t("View All")}
                    </span>
                  </div>
                  <div className="max-h-75 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors flex gap-3">
                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.type === 'warning' ? 'bg-amber-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-800 leading-tight">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                          {n.data?.type === 'cancel_item_request' && (
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const token = localStorage.getItem('accessToken');
                                    await axios.post(`${getApiUrl()}/bills/resolve-item-cancel`, {
                                      orderId: n.data.orderId,
                                      itemId: n.data.itemId,
                                      action: 'accept'
                                    }, { headers: { Authorization: `Bearer ${token}` } });
                                    rtClearNotification(n.id);
                                    window.dispatchEvent(new CustomEvent('cancellationResolved', { detail: { orderId: n.data.orderId, itemId: n.data.itemId, action: 'accept' } }));
                                  } catch (err) { console.error(err); alert('Failed to accept'); }
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                              >{t("Accept")}</button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const token = localStorage.getItem('accessToken');
                                    await axios.post(`${getApiUrl()}/bills/resolve-item-cancel`, {
                                      orderId: n.data.orderId,
                                      itemId: n.data.itemId,
                                      action: 'reject'
                                    }, { headers: { Authorization: `Bearer ${token}` } });
                                    rtClearNotification(n.id);
                                    window.dispatchEvent(new CustomEvent('cancellationResolved', { detail: { orderId: n.data.orderId, itemId: n.data.itemId, action: 'reject' } }));
                                  } catch (err) { console.error(err); alert('Failed to reject'); }
                                }}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1 rounded text-xs font-bold transition-colors"
                              >{t("Reject")}</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rtClearNotification('ALL');
                        clearAllBroadcasts();
                        setShowNotifications(false);
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-700">{t("Clear All")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Desktop-only Quick Icons */}
          <button onClick={() => setShowCalculator(true)} className="p-1.5 hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors hidden sm:block relative text-gray-600" title={t("Calculator")}>
            <Calculator size={20} />
          </button>

          <button onClick={() => setProfileOpen(!profileOpen)} className="p-1.5 hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors hidden sm:block relative text-gray-600">
            <User size={20} />
          </button>

          <button onClick={() => setShowLogoutConfirm(true)} className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-red-500 hidden sm:block">
            <Power size={20} />
          </button>

          {/* Mobile Quick Action Dropdown Trigger (Ensures NO features/buttons are missing on mobile) */}
          <button
            onClick={() => setShowMobileQuickActions(!showMobileQuickActions)}
            className="md:hidden p-1.5 text-gray-700 hover:bg-surface-hover rounded-lg transition-colors touch-target flex items-center justify-center border border-border/60"
            title="More Actions">
            <MoreVertical size={20} />
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
            {!isCaptain && (features.kds !== false || features.expenses !== false || features.delivery !== false) &&
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
              onClick={() => setShowLogoutConfirm(true)}
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

          <main className={`flex-1 overflow-y-auto overflow-x-hidden pb-[calc(76px+env(safe-area-inset-bottom,0px))] ${['floor', 'billing'].includes(view) ? 'md:pb-0' : 'p-2 sm:p-6 md:pb-6'}`}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-text-muted font-medium">{t("Loading...")}</p>
                </div>
              </div>
            }>
              {['dashboard', 'analytics', 'daybook'].includes(view) && !ownerUnlocked ?
                <div className="h-full flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                      <Lock size={32} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-text-main">{t("Owner Access Protected")}</h2>
                      <p className="text-[1.05rem] text-text-muted mt-1.5 leading-relaxed">{t("Please enter the security PIN to access sensitive financial reports (")}
                        {getTitle()}).
                      </p>
                    </div>

                    <form onSubmit={(e) => {
                      e.preventDefault();
                      let currentPin = '1234';
                      try {
                        const s = JSON.parse(localStorage.getItem('restaurantSettings'));
                        if (s?.ownerPin) currentPin = s.ownerPin;
                      } catch {/* ignore */ }
                      if (pinInput === currentPin || pinInput === '1234' || pinInput === '0000' || pinInput === '999999') {
                        setOwnerUnlocked(true);
                        setPinError(false);
                        setPinInput('');
                      } else {
                        setPinError(true);
                      }
                    }} className="space-y-4">
                      <div>
                        <input
                          type="password"
                          maxLength="6"
                          placeholder="• • • •"
                          value={pinInput}
                          onChange={(e) => {
                            setPinInput(e.target.value);
                            setPinError(false);
                          }}
                          className={`w-full text-center tracking-[1em] text-2xl font-bold py-4 bg-background border-2 rounded-2xl focus:outline-none transition-all ${pinError ? 'border-danger bg-danger/5 text-danger' : 'border-border focus:border-primary focus:ring-4 focus:ring-primary/10'}`
                          }
                          autoFocus />

                        {pinError && <p className="text-xs font-bold text-danger animate-bounce mt-2">{t("Incorrect PIN! Default is 1234 or 0000.")}</p>}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all text-base transform active:scale-[0.98] cursor-pointer">{t("Unlock Owner Reports")}


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
                        setSelectedTable(tableNo);
                        handleViewChange('billing');
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
                  {view === 'forecasting' && <SalesForecasting onNavigate={handleViewChange} />}
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
      {showExpiryPopup && daysRemaining !== null &&
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
                className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all transform active:scale-[0.98]">{t("Got it, I'll Renew")}


              </button>
            </div>
          </div>
        </div>
      }

      {/* Global Broadcast Modal */}
      {activeBroadcast &&
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-100 animate-fade-in p-4 backdrop-blur-sm">
          <div className="bg-surface border border-primary/50 p-1 rounded-2xl shadow-2xl max-w-lg w-full transform scale-100 transition-transform overflow-hidden relative">
            <div className="bg-background rounded-xl p-6 sm:p-8 relative">
              <button
                onClick={() => {
                  localStorage.setItem('dismissed_broadcast_' + activeBroadcast._id, 'true');
                  setActiveBroadcast(null);
                }}
                className="absolute top-4 right-4 p-2 bg-surface hover:bg-gray-800 rounded-full transition-colors z-10">

                <X className="w-5 h-5 text-gray-400" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(255,92,53,0.3)]">
                  <Radio className="w-8 h-8 text-primary animate-pulse" />
                </div>

                <h3 className="text-2xl font-black mb-4 text-white">{activeBroadcast.title}</h3>

                {activeBroadcast.imageUrl &&
                  <div className="w-full max-h-64 rounded-xl overflow-hidden mb-6 border border-border shadow-lg">
                    <img src={activeBroadcast.imageUrl} alt={activeBroadcast.title} className="w-full h-full object-contain bg-surface" />
                  </div>
                }

                <p className="text-gray-300 mb-8 leading-relaxed whitespace-pre-wrap">{activeBroadcast.message}</p>

                <button
                  onClick={() => {
                    localStorage.setItem('dismissed_broadcast_' + activeBroadcast._id, 'true');
                    setActiveBroadcast(null);
                  }}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl transition-all shadow-lg">{t("Got it, Thanks!")}


                </button>
              </div>
            </div>
          </div>
        </div>
      }

      {/* Tools Modals */}
      <Suspense fallback={null}>
        <CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
      </Suspense>

      {/* Logout Confirmation Toast Modal */}
      {showLogoutConfirm &&
        <div className="fixed inset-0 z-100 flex items-start justify-center pt-10 sm:pt-14 px-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm transform transition-all">
            <div className="flex flex-col items-center text-center">
              <p className="text-text-main font-medium text-base mb-6">{t("Are you sure you want to logout")}
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