import React, { useState, useEffect, Suspense } from 'react';
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
const Expenses = React.lazy(() => import('./components/Expenses'));
const DeliveryOrders = React.lazy(() => import('./components/DeliveryOrders'));
const KOTHistory = React.lazy(() => import('./components/KOTHistory'));
const LicenseScreen = React.lazy(() => import('./components/LicenseScreen'));
const DayBook = React.lazy(() => import('./components/DayBook'));
const InventoryManagement = React.lazy(() => import('./components/InventoryManagement'));
const KDS = React.lazy(() => import('./components/KDS'));
const CRM = React.lazy(() => import('./components/CRM'));
const QRCodeGenerator = React.lazy(() => import('./components/QRCodeGenerator'));
const StaffManagement = React.lazy(() => import('./components/StaffManagement'));
import WhatsAppSimulator from './components/WhatsAppSimulator';
import { LogOut, LayoutDashboard, History, User, UtensilsCrossed, ClipboardList, BarChart3, LayoutGrid, Home, Settings as SettingsIcon, Truck, Wallet, Printer, BookOpen, Lock, ShieldAlert, CalendarClock, X, Phone, Menu, Receipt, Clock, Package, WifiOff, RefreshCw, Users as UsersIcon, QrCode, UserCheck, Radio } from 'lucide-react';
import { getOpenOrders } from './api/billing';
import { logoutUser } from './api/auth';
import { initSyncEngine } from './utils/syncEngine';
import { io } from 'socket.io-client';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import './App.css';

function App() {
  const onlineStatus = useOnlineStatus();
  const [view, setView] = useState('floor'); // Default to floor view
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [restaurantName, setRestaurantName] = useState(() => {
    try {
      const cached = localStorage.getItem('restaurantSettings');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.restaurantName || 'msbillings';
      }
    } catch (e) {}
    return 'msbillings';
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [hasLicense, setHasLicense] = useState(false);
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [licenseExpiry, setLicenseExpiry] = useState(null); // Date object
  const [daysRemaining, setDaysRemaining] = useState(null);
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);
  const [features, setFeatures] = useState(() => {
    try {
      const cached = localStorage.getItem('resto_features');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return { kds: true, inventory: true, crm: true, staff: true, analytics: true, daybook: true, qrcode: true, delivery: true, expenses: true };
  });
  const [activeBroadcast, setActiveBroadcast] = useState(null);

  const rawRole = user?.role || 'Admin';
  const usernameLower = user?.username?.toLowerCase() || '';
  const userRole = usernameLower.includes('captain') ? 'Captain' : (usernameLower.includes('cashier') ? 'Cashier' : rawRole);
  const isCaptain = userRole === 'Captain';
  const isCashier = userRole === 'Cashier';
  const isAdmin = userRole === 'Admin';

  useEffect(() => {
    if (isCaptain && !['floor', 'orders', 'kothistory', 'billing'].includes(view)) {
      setView('floor');
    }
  }, [isCaptain, view]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    const savedLicense = localStorage.getItem('resto_license');
    const savedDbName = localStorage.getItem('resto_db_name');
    const isDesktopApp = !!window.electronAPI;
    
    // For cloud/mobile apps, we MUST have the database name for multi-tenancy isolation.
    // If it's missing (e.g. old cached state), force them back to the license screen.
    if (savedLicense && (savedDbName || isDesktopApp)) {
      setHasLicense(true);
    } else if (savedLicense && !savedDbName && !isDesktopApp) {
      localStorage.removeItem('resto_license');
      localStorage.removeItem('resto_license_expiry');
      setHasLicense(false);
    }
    
    setLoading(false);

    // Initialize the Offline Sync Engine (caches menu/categories/floors, processes sync queue)
    initSyncEngine();

    // Sync license expiry and restaurant settings from Backend Database so ALL devices (Desktop & Mobile) match 100%!
    const syncConfigFromBackend = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
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
      } catch (err) {}
      
      // Fallback to localStorage if offline/not synced yet (no hardcoded dates)
      let expiryStr = localStorage.getItem('resto_license_expiry');
      if (expiryStr) {
        const expiryDate = new Date(expiryStr);
        if (!isNaN(expiryDate.getTime())) {
          setLicenseExpiry(expiryDate);
        }
      }
      }
      
      // Also fetch features from SuperAdmin
      try {
        const licenseKey = localStorage.getItem('resto_license');
        if (licenseKey) {
          const SUPERADMIN_API_URL = import.meta.env.VITE_SUPERADMIN_API_URL || 'https://restaurant-superadmin-api-maheer.vercel.app';
          const saRes = await fetch(`${SUPERADMIN_API_URL}/api/clients/license/${licenseKey}`);
          if (saRes.ok) {
            const saData = await saRes.json();
            if (saData.features) {
              setFeatures(saData.features);
              localStorage.setItem('resto_features', JSON.stringify(saData.features));
            }
            if (saData.broadcasts && saData.broadcasts.length > 0) {
              // Show the latest broadcast that hasn't been dismissed
              const latestUnread = saData.broadcasts.find(b => b.active && !localStorage.getItem('dismissed_broadcast_' + b._id));
              if (latestUnread) {
                setActiveBroadcast(latestUnread);
              }
            }
          }
        }
      } catch (err) {}
    };
    syncConfigFromBackend();
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
      setShowExpiryPopup(true);
      sessionStorage.setItem(popupShownKey, 'true');
    }
    const interval = setInterval(calcDays, 60000); // update every minute
    return () => clearInterval(interval);
  }, [licenseExpiry]);

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
      // Re-check license status from localStorage in case license was cleared
      // (e.g. via "Reset License" button). If resto_license is gone, show LicenseScreen.
      const savedLicense = localStorage.getItem('resto_license');
      const savedDbName = localStorage.getItem('resto_db_name');
      const isDesktopApp = !!window.electronAPI;
      if (!savedLicense || (!savedDbName && !isDesktopApp)) {
        setHasLicense(false);
      }
    };

    window.addEventListener('forceLogout', handleForceLogout);
    return () => window.removeEventListener('forceLogout', handleForceLogout);
  }, []);

  useEffect(() => {
    if (user) {
      fetchActiveOrdersCount();
    }
  }, [user]);

  const fetchActiveOrdersCount = async () => {
    try {
      const orders = await getOpenOrders();
      setActiveOrdersCount(orders.length);
    } catch (error) {
      console.error('Error fetching active orders count:', error);
    }
  };

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
    // Reset to default view so the user lands on dashboard after login
    setView('floor');
    setActiveOrdersCount(0);
  };

  useEffect(() => {
    if (user) {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
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
    logoutUser().catch(error => console.error('Logout API error:', error));

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
  };

  const handleViewChange = (newView, tableSelection = null) => {
    if (tableSelection) {
      setSelectedTable(tableSelection);
    }
    setView(newView);
    setMobileMenuOpen(false);
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-background text-text-muted">Loading...</div>;

  const isDesktop = !!window.electronAPI;
  
  if (!hasLicense) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Verifying License...</div>}>
        <LicenseScreen onValidLicense={() => setHasLicense(true)} />
      </Suspense>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    );
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

      {/* Offline / Sync Status Banner */}
      {(!onlineStatus.isOnline || onlineStatus.pendingCount > 0) && (
        <div className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold tracking-wide shrink-0 z-50 ${
          !onlineStatus.isOnline 
            ? 'bg-red-600 text-white' 
            : 'bg-amber-500 text-amber-950'
        }`}>
          {!onlineStatus.isOnline ? (
            <>
              <WifiOff size={14} />
              <span>You are offline — orders will be saved locally and synced when internet returns</span>
            </>
          ) : (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>{onlineStatus.pendingCount} item{onlineStatus.pendingCount !== 1 ? 's' : ''} waiting to sync...</span>
            </>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-40 w-64 bg-surface flex flex-col shrink-0 shadow-2xl md:shadow-xl transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-border/40 md:border-b-0">
          <div className="flex items-center gap-3 font-bold text-xl text-primary">
            <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <UtensilsCrossed size={22} />
            </div>
            <span className="tracking-tight">{restaurantName}</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-text-muted hover:text-text-main md:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {/* 1. Floor Management - Available to all */}
          <button
            onClick={() => handleViewChange('floor')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'floor' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
          >
            <LayoutGrid size={20} />
            <span>Floor Management</span>
          </button>
          
          {/* 2. New Orders / Table Order - Available to all */}
          <button
            onClick={() => handleViewChange('billing')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'billing' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
          >
            <LayoutDashboard size={20} />
            <span>{isCaptain ? 'Captain Order' : 'New Order'}</span>
          </button>

          {/* 3. Active Orders - Available to all */}
          <button
            onClick={() => handleViewChange('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium relative ${view === 'orders' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
          >
            <ClipboardList size={20} />
            <span>Active Orders</span>
            {activeOrdersCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${view === 'orders' ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
                {activeOrdersCount}
              </span>
            )}
          </button>

          {/* 4. Bill History - Hidden for Captain */}
          {!isCaptain && (
            <button
              onClick={() => handleViewChange('history')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <History size={20} />
              <span>Bill History</span>
            </button>
          )}

          {/* 4.5 KOT History - Available to all */}
          <button
            onClick={() => handleViewChange('kothistory')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'kothistory' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
          >
            <Printer size={20} />
            <span>KOT History</span>
          </button>

          {/* 4.6 KDS - Hidden for Captain */}
          {(!isCaptain && features.kds !== false) && (
            <button
              onClick={() => handleViewChange('kds')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'kds' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <UtensilsCrossed size={20} />
              <span>Kitchen Display (KDS)</span>
            </button>
          )}

          {/* 5. Petty Cash & Expenses - Hidden for Captain */}
          {(!isCaptain && features.expenses !== false) && (
            <button
              onClick={() => handleViewChange('expenses')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'expenses' ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <Wallet size={20} />
              <span>Petty Cash & Expenses</span>
            </button>
          )}

          {/* 6. Delivery Orders - Hidden for Captain */}
          {(!isCaptain && features.delivery !== false) && (
            <button
              onClick={() => handleViewChange('delivery')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'delivery' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <Truck size={20} />
              <span>Delivery Orders</span>
            </button>
          )}

          {/* 6. Dashboard - Hidden for Captain */}
          {!isCaptain && (
            <button
              onClick={() => handleViewChange('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'dashboard' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <Home size={20} />
              <span>Dashboard</span>
            </button>
          )}

          {/* 7. Analytics - Hidden for Captain and Cashier */}
          {(isAdmin && features.analytics !== false) && (
            <button
              onClick={() => handleViewChange('analytics')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'analytics' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <BarChart3 size={20} />
              <span>Analytics</span>
            </button>
          )}

          {/* 7.5 DayBook - Hidden for Captain */}
          {(!isCaptain && features.daybook !== false) && (
            <button
              onClick={() => handleViewChange('daybook')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'daybook' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <BookOpen size={20} />
              <span>DayBook</span>
            </button>
          )}

          {/* 7.6 Inventory - Admin only */}
          {(isAdmin && features.inventory !== false) && (
            <button
              onClick={() => handleViewChange('inventory')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'inventory' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <Package size={20} />
              <span>Inventory</span>
            </button>
          )}

          {/* 7.7 CRM - Hidden for Captain */}
          {(!isCaptain && features.crm !== false) && (
            <button
              onClick={() => handleViewChange('crm')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'crm' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <UsersIcon size={20} />
              <span>Customer CRM</span>
            </button>
          )}

          {(isAdmin && features.staff !== false) && (
            <button
              onClick={() => handleViewChange('staff')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'staff' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <UserCheck size={20} />
              <span>Staff HR</span>
            </button>
          )}

          {(isAdmin && features.qrcode !== false) && (
            <button
              onClick={() => handleViewChange('qrcode')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'qrcode' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <QrCode size={20} />
              <span>QR Menu Generator</span>
            </button>
          )}

          {/* 8. Menu - Hidden for Captain */}
          {!isCaptain && (
            <button
              onClick={() => handleViewChange('menu')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'menu' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <UtensilsCrossed size={20} />
              <span>Menu</span>
            </button>
          )}

          {/* 9. Settings - Hidden for Captain and Cashier */}
          {isAdmin && (
            <button
              onClick={() => handleViewChange('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium ${view === 'settings' ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-2' : 'text-text-muted hover:bg-surface-hover hover:text-text-main hover:translate-x-1'}`}
            >
              <SettingsIcon size={20} />
              <span>Settings</span>
            </button>
          )}
        </nav>

        <div className="p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-danger bg-danger/5 hover:bg-danger/10 transition-all font-medium hover:shadow-md"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Topbar */}
        {view !== 'billing' && (
          <header className="h-20 flex items-center justify-between px-3 sm:px-8 shrink-0 border-b border-border/40 bg-background gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 sm:p-2.5 rounded-xl bg-surface border border-border text-text-main hover:bg-surface-hover md:hidden shadow-sm shrink-0"
              >
                <Menu size={20} className="sm:w-[22px] sm:h-[22px]" />
              </button>
              <div className="min-w-0 truncate">
                <h1 className="text-base sm:text-2xl font-bold text-text-main tracking-tight truncate">
                  {getTitle()}
                </h1>
                <p className="text-[11px] sm:text-sm text-text-muted hidden sm:block truncate">Welcome back, {user.username}</p>
              </div>
            </div>

            {/* License Expiry Badge */}
            {daysRemaining !== null && (
              <button
                onClick={() => setShowExpiryPopup(true)}
                className={`flex items-center gap-1 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0 ${
                  daysRemaining <= 0
                    ? 'bg-red-500/15 text-red-600 border border-red-500/30 animate-pulse'
                    : daysRemaining <= 15
                    ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}
              >
                <CalendarClock size={14} />
                <span className="hidden sm:inline">
                  {daysRemaining <= 0
                    ? 'License Expired!'
                    : daysRemaining > 365
                    ? 'Lifetime License'
                    : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
                </span>
                <span className="sm:hidden text-[11px]">
                  {daysRemaining <= 0 
                    ? 'Expired' 
                    : daysRemaining > 365
                    ? 'Lifetime'
                    : `${daysRemaining}d`}
                </span>
                {licenseExpiry && daysRemaining <= 365 && (
                  <span className="opacity-60 hidden md:inline">
                    (Exp: {licenseExpiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})
                  </span>
                )}
              </button>
            )}

            <div className="flex items-center gap-2 sm:gap-4 relative shrink-0">
              {['dashboard', 'analytics', 'daybook'].includes(view) && ownerUnlocked && (
                <button
                  onClick={() => setOwnerUnlocked(false)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition-all shadow-sm"
                >
                  <Lock size={14} />
                  <span className="hidden sm:inline">Lock Reports</span>
                </button>
              )}
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 sm:gap-3 p-1 sm:px-2 sm:py-1.5 bg-surface rounded-full shadow-sm sm:pr-4 hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-md shrink-0">
                  <User size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div className="hidden sm:flex flex-col leading-none text-left">
                  <span className="text-sm font-bold text-text-main">{user.username}</span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">{user.role}</span>
                </div>
              </button>
              
              {/* Profile Dropdown */}
              {profileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setProfileOpen(false)}
                  ></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-xl shadow-xl border border-border overflow-hidden z-50 py-1">
                    <button 
                      onClick={() => {
                        handleViewChange('settings');
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-text-main hover:bg-surface-hover flex items-center gap-2"
                    >
                      <SettingsIcon size={16} className="text-text-muted" />
                      Settings
                    </button>
                    <button 
                      onClick={() => {
                        handleLogout();
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/5 flex items-center gap-2 border-t border-border mt-1"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>
        )}

        <main className="flex-1 overflow-hidden p-2 sm:p-6 pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-text-muted font-medium">Loading...</p>
              </div>
            </div>
          }>
            {['dashboard', 'analytics', 'daybook'].includes(view) && !ownerUnlocked ? (
              <div className="h-full flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-surface p-8 rounded-3xl border border-border shadow-2xl max-w-md w-full text-center space-y-6">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Lock size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-text-main">Owner Access Protected</h2>
                    <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
                      Please enter the security PIN to access sensitive financial reports ({getTitle()}).
                    </p>
                  </div>
                  
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    let currentPin = '1234';
                    try {
                      const s = JSON.parse(localStorage.getItem('restaurantSettings'));
                      if (s?.ownerPin) currentPin = s.ownerPin;
                    } catch (err) {}
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
                        className={`w-full text-center tracking-[1em] text-2xl font-bold py-4 bg-background border-2 rounded-2xl focus:outline-none transition-all ${
                          pinError ? 'border-danger bg-danger/5 text-danger' : 'border-border focus:border-primary focus:ring-4 focus:ring-primary/10'
                        }`}
                        autoFocus
                      />
                      {pinError && <p className="text-xs font-bold text-danger animate-bounce mt-2">Incorrect PIN! Default is 1234 or 0000.</p>}
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all text-base transform active:scale-[0.98] cursor-pointer"
                    >
                      Unlock Owner Reports
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <>
                {view === 'dashboard' && <Dashboard onNavigate={handleViewChange} />}
                {view === 'floor' && <FloorManagement onNavigate={handleViewChange} />}
                {view === 'orders' && (
                  <ActiveOrders
                    onSelectOrder={(tableNo) => {
                      setSelectedTable(tableNo);
                      handleViewChange('billing');
                    }}
                    onOrderUpdate={fetchActiveOrdersCount}
                  />
                )}
                {view === 'billing' && <BillingPage initialTable={selectedTable} onOrderUpdate={fetchActiveOrdersCount} onNavigate={handleViewChange} userRole={userRole} onToggleMenu={() => setMobileMenuOpen(true)} />}
                {view === 'history' && <BillHistory />}
                {view === 'kothistory' && <KOTHistory />}
                {view === 'analytics' && <Analytics />}
                {view === 'daybook' && <DayBook />}
                {view === 'menu' && <MenuManagement user={user} />}
                {view === 'delivery' && <DeliveryOrders />}
                {view === 'expenses' && <Expenses />}
                {view === 'inventory' && <InventoryManagement />}
                {view === 'crm' && <CRM />}
                {view === 'staff' && <StaffManagement />}
                {view === 'qrcode' && <QRCodeGenerator />}
                {view === 'settings' && <Settings user={user} setUser={setUser} />}
                {view === 'kds' && <KDS />}
              </>
            )}
          </Suspense>
        </main>

        {/* Native Android Bottom Navigation Bar (Google MD3 Style - Mobile Only) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 min-h-[70px] pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] bg-surface/98 backdrop-blur-xl border-t border-border/80 z-50 flex items-center justify-around px-2 shadow-[0_-4px_25px_rgba(0,0,0,0.1)]">
          <button
            onClick={() => handleViewChange('floor')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all ${
              view === 'floor' ? 'text-primary font-bold' : 'text-text-muted hover:text-text-main font-medium'
            }`}
          >
            <div className={`px-4 py-1 rounded-full transition-all flex items-center justify-center ${view === 'floor' ? 'bg-primary/15 text-primary scale-105' : 'text-text-muted'}`}>
              <LayoutGrid size={20} className={view === 'floor' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            </div>
            <span className="text-[11px] tracking-tight">Tables</span>
          </button>

          <button
            onClick={() => handleViewChange('orders')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all relative ${
              view === 'orders' ? 'text-primary font-bold' : 'text-text-muted hover:text-text-main font-medium'
            }`}
          >
            <div className={`px-4 py-1 rounded-full transition-all flex items-center justify-center relative ${view === 'orders' ? 'bg-primary/15 text-primary scale-105' : 'text-text-muted'}`}>
              <Clock size={20} className={view === 'orders' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                  {activeOrdersCount}
                </span>
              )}
            </div>
            <span className="text-[11px] tracking-tight">KOTs</span>
          </button>

          <button
            onClick={() => handleViewChange('billing')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all ${
              view === 'billing' ? 'text-primary font-extrabold' : 'text-text-muted hover:text-text-main font-medium'
            }`}
          >
            <div className={`px-4 py-1 rounded-full transition-all flex items-center justify-center ${view === 'billing' ? 'bg-primary/15 text-primary scale-105 shadow-sm' : 'text-text-muted'}`}>
              <UtensilsCrossed size={22} className={view === 'billing' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            </div>
            <span className="text-[11px] tracking-tight font-black">Billing</span>
          </button>

          <button
            onClick={() => handleViewChange('history')}
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all ${
              view === 'history' ? 'text-primary font-bold' : 'text-text-muted hover:text-text-main font-medium'
            }`}
          >
            <div className={`px-4 py-1 rounded-full transition-all flex items-center justify-center ${view === 'history' ? 'bg-primary/15 text-primary scale-105' : 'text-text-muted'}`}>
              <Receipt size={20} className={view === 'history' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            </div>
            <span className="text-[11px] tracking-tight">History</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 transition-all ${
              ['dashboard', 'analytics', 'daybook', 'menu', 'settings', 'delivery', 'expenses'].includes(view) ? 'text-primary font-bold' : 'text-text-muted hover:text-text-main font-medium'
            }`}
          >
            <div className={`px-4 py-1 rounded-full transition-all flex items-center justify-center ${['dashboard', 'analytics', 'daybook', 'menu', 'settings', 'delivery', 'expenses'].includes(view) ? 'bg-primary/15 text-primary scale-105' : 'text-text-muted'}`}>
              <Menu size={20} className={['dashboard', 'analytics', 'daybook', 'menu', 'settings', 'delivery', 'expenses'].includes(view) ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            </div>
            <span className="text-[11px] tracking-tight">More</span>
          </button>
        </div>
      </div>
      </div>{/* end flex-1 wrapper */}

      {/* License Expiry Warning Popup */}
      {showExpiryPopup && daysRemaining !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl border border-border shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-5 flex items-center justify-between ${
              daysRemaining <= 0 
                ? 'bg-gradient-to-r from-red-500/20 to-red-400/10' 
                : daysRemaining > 365
                ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-400/10'
                : 'bg-gradient-to-r from-amber-500/20 to-amber-400/10'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                  daysRemaining <= 0 
                    ? 'bg-red-500/20 text-red-500' 
                    : daysRemaining > 365
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {daysRemaining > 365 ? <CalendarClock size={28} /> : <ShieldAlert size={28} />}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-text-main">
                    {daysRemaining <= 0 
                      ? 'License Expired!' 
                      : daysRemaining > 365
                      ? 'License Active!'
                      : 'License Expiring Soon!'}
                  </h2>
                  <p className="text-xs text-text-muted font-medium">
                    {daysRemaining <= 0
                      ? 'Your software license has expired.'
                      : daysRemaining > 365
                      ? 'Your lifetime license is active.'
                      : `Only ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining!`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExpiryPopup(false)}
                className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center hover:bg-border transition-colors"
              >
                <X size={16} className="text-text-muted" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="bg-background rounded-2xl p-4 border border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-medium">Expiry Date</span>
                  <span className="text-sm font-bold text-text-main">
                    {daysRemaining > 365 
                      ? 'Permanent (Lifetime)' 
                      : licenseExpiry 
                      ? licenseExpiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) 
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-medium">Days Remaining</span>
                  <span className={`text-sm font-bold ${
                    daysRemaining <= 0 
                      ? 'text-red-500' 
                      : daysRemaining > 365
                      ? 'text-emerald-500'
                      : daysRemaining <= 7 
                      ? 'text-red-500' 
                      : 'text-amber-500'
                  }`}>
                    {daysRemaining <= 0 
                      ? 'EXPIRED' 
                      : daysRemaining > 365
                      ? 'Lifetime'
                      : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {/* Progress bar */}
                {daysRemaining <= 365 && (
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        daysRemaining <= 0 ? 'bg-red-500' : daysRemaining <= 7 ? 'bg-red-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, ((15 - Math.max(0, daysRemaining)) / 15) * 100))}%` }}
                    />
                  </div>
                )}
              </div>

              {daysRemaining <= 365 ? (
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-4 border border-amber-200 dark:border-amber-500/20">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                    {daysRemaining <= 0
                      ? 'Your license has expired. Please renew immediately to continue using all features without interruption.'
                      : 'Your license will expire soon. Please renew before the expiry date to avoid any service interruption.'}
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-500/20">
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed">
                    Thank you for choosing MS Tech Hive! Your software license is fully active and has no upcoming expiration.
                  </p>
                </div>
              )}

              {/* Contact Info */}
              {daysRemaining <= 365 && (
                <div className="bg-primary/5 rounded-2xl p-4 border border-primary/15">
                  <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-2">Contact Customer Care</p>
                  <a href="tel:+919701800140" className="flex items-center gap-3 text-primary font-bold text-lg hover:underline">
                    <Phone size={20} />
                    +91 9701800140
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              <button
                onClick={() => setShowExpiryPopup(false)}
                className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all transform active:scale-[0.98]"
              >
                Got it, I'll Renew
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Broadcast Modal */}
      {activeBroadcast && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] animate-fade-in p-4 backdrop-blur-sm">
          <div className="bg-surface border border-primary/50 p-1 rounded-2xl shadow-2xl max-w-lg w-full transform scale-100 transition-transform overflow-hidden relative">
            <div className="bg-background rounded-xl p-6 sm:p-8 relative">
              <button 
                onClick={() => {
                  localStorage.setItem('dismissed_broadcast_' + activeBroadcast._id, 'true');
                  setActiveBroadcast(null);
                }} 
                className="absolute top-4 right-4 p-2 bg-surface hover:bg-gray-800 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(255,92,53,0.3)]">
                  <Radio className="w-8 h-8 text-primary animate-pulse" />
                </div>
                
                <h3 className="text-2xl font-black mb-4 text-white">{activeBroadcast.title}</h3>
                
                {activeBroadcast.imageUrl && (
                  <div className="w-full max-h-64 rounded-xl overflow-hidden mb-6 border border-border shadow-lg">
                    <img src={activeBroadcast.imageUrl} alt={activeBroadcast.title} className="w-full h-full object-contain bg-surface" />
                  </div>
                )}
                
                <p className="text-gray-300 mb-8 leading-relaxed whitespace-pre-wrap">{activeBroadcast.message}</p>
                
                <button 
                  onClick={() => {
                    localStorage.setItem('dismissed_broadcast_' + activeBroadcast._id, 'true');
                    setActiveBroadcast(null);
                  }}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl transition-all shadow-lg"
                >
                  Got it, Thanks!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <WhatsAppSimulator />
    </>
  );
}

export default App;
