import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { ShoppingCart, Plus, Minus, X, Info, UtensilsCrossed, ChevronRight, ChevronUp, CheckCircle2, Navigation, Bell, Droplets, CreditCard, Search, Star, ChefHat, Check, MapPin, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

const getPublicApiUrl = () => {
  return getApiUrl();
};

const API_BASE_URL = getPublicApiUrl();
const apiClient = axios.create({
  timeout: 35000
});

const CustomerMenu = () => {
  const { language, setLanguage, t } = useLanguage();
  const [googleReviewLink, setGoogleReviewLink] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState('menu'); // menu, placing, success

  // Language Dropdown State
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const languages = [
    { code: 'en', native: 'English' },
    { code: 'hi', native: 'हिंदी' },
    { code: 'te', native: 'తెలుగు' },
    { code: 'ta', native: 'தமிழ்' },
    { code: 'kn', native: 'ಕನ್ನಡ' },
    { code: 'ml', native: 'മലയാളം' },
    { code: 'mr', native: 'मराठी' }
  ];

  // Live Order Tracking State
  const [activeOrderData, setActiveOrderData] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getPrepCountdown = (item) => {
    if (!item || !item.prepTimeMinutes) return null;
    const startMs = item.prepStartTime ? new Date(item.prepStartTime).getTime() : now;
    const totalMs = item.prepTimeMinutes * 60 * 1000;
    const elapsedMs = now - startMs;
    const remainingMs = totalMs - elapsedMs;

    if (remainingMs <= 0) {
      return { remainingMins: 0, remainingSecs: 0, isOverdue: true, percent: 100 };
    }

    const remainingMins = Math.floor(remainingMs / 60000);
    const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
    const percent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
    return { remainingMins, remainingSecs, isOverdue: false, percent };
  };

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState('all'); // 'all', 'veg', 'non-veg'

  // Service Request & Variants/Notes State
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [serviceMessage, setServiceMessage] = useState(null);
  const [selectedItemForAdd, setSelectedItemForAdd] = useState(null);
  const [specialNote, setSpecialNote] = useState('');

  // Draggable bell button
  const [bellPos, setBellPos] = useState({ x: window.innerWidth - 60, y: window.innerHeight - 80 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Order tracking modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const handleBellPointerDown = useCallback((e) => {
    isDragging.current = true;
    didDrag.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: e.clientX - bellPos.x, y: e.clientY - bellPos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [bellPos]);

  const handleBellPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      didDrag.current = true;
    }

    const newX = Math.max(0, Math.min(window.innerWidth - 48, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 48, e.clientY - dragOffset.current.y));
    setBellPos({ x: newX, y: newY });
  }, []);

  const handleBellPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const tenant = urlParams.get('tenant');
  const table = urlParams.get('table');

  const handleRequestItemCancel = async (item) => {
    const itemId = item._id || item.id;
    let cancelQty = item.quantity;
    
    if (item.quantity > 1) {
      const qtyStr = window.prompt(`Enter quantity to cancel (Max: ${item.quantity - (item.cancelledQuantity || 0)}):`, '1');
      if (qtyStr === null) return; // User cancelled prompt
      cancelQty = parseInt(qtyStr, 10);
      
      const maxCancellable = item.quantity - (item.cancelledQuantity || 0);
      if (isNaN(cancelQty) || cancelQty <= 0 || cancelQty > maxCancellable) {
        alert(`Invalid quantity. Please enter a number between 1 and ${maxCancellable}`);
        return;
      }
    }

    try {
      const tenant = urlParams.get('tenant') || 'default';
      const tableNo = urlParams.get('table');
      await apiClient.post(`${API_BASE_URL}/public/request-item-cancel`, {
        orderId: activeOrderData._id,
        itemId,
        tableNo,
        cancelQty
      }, {
        headers: { 'X-Tenant-DB': tenant }
      });
      
      // Update local state to show pending
      setActiveOrderData(prev => {
        if (!prev) return prev;
        const newItems = (prev.items || []).map(i => 
          ((i._id && i._id === itemId) || (i.id && i.id === itemId) || i.name === item.name) 
            ? { ...i, cancellationRequested: true, cancellationRequestedQty: cancelQty } 
            : i
        );
        return { ...prev, items: newItems };
      });
      
      setServiceMessage(`Cancellation requested for ${cancelQty} item(s)`);
      setTimeout(() => setServiceMessage(''), 3000);
    } catch (error) {
      console.error('Error requesting cancellation:', error);
      const errMsg = error.response?.data?.message || 'Failed to request cancellation';
      alert(errMsg);
    }
  };

  const handleWithdrawItemCancel = async (item) => {
    const itemId = item._id || item.id;
    try {
      const tenant = urlParams.get('tenant') || 'default';
      const tableNo = urlParams.get('table');
      await apiClient.post(`${API_BASE_URL}/public/withdraw-item-cancel`, {
        orderId: activeOrderData._id,
        itemId,
        tableNo
      }, {
        headers: { 'X-Tenant-DB': tenant }
      });
      
      // Update local state immediately
      setActiveOrderData(prev => {
        if (!prev) return prev;
        const newItems = (prev.items || []).map(i => 
          ((i._id && i._id === itemId) || (i.id && i.id === itemId) || i.name === item.name) 
            ? { ...i, cancellationRequested: false, cancellationRequestedQty: 0 } 
            : i
        );
        return { ...prev, items: newItems };
      });
      
      setServiceMessage(`Cancellation request withdrawn for ${item.name}`);
      setTimeout(() => setServiceMessage(''), 3000);
    } catch (error) {
      console.error('Error withdrawing cancellation:', error);
      const errMsg = error.response?.data?.message || 'Failed to withdraw cancellation';
      alert(errMsg);
    }
  };

  // 1. Instant cache load from sessionStorage / localStorage for 0ms render
  useEffect(() => {
    if (!tenant) return;
    try {
      const cached = sessionStorage.getItem(`customer_menu_${tenant}`) || localStorage.getItem(`customer_menu_${tenant}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (data && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          setItems(data.items || []);
          if (data.googleReviewLink) setGoogleReviewLink(data.googleReviewLink);
          setLoading(false); // Instant render without waiting for network!
        }
      }
    } catch (e) {
      console.warn("Cache read error:", e);
    }
  }, [tenant]);

  // Geolocation verification with mobile/iOS indoor tolerance (min 500m buffer)
  const verifyLocation = useCallback((settings) => {
    if (!settings || !settings.enableGeoFencing) {
      setGeoError(null);
      setVerifyingLocation(false);
      return;
    }

    const { latitude, longitude, geoFencingRadius = 100 } = settings;
    if (!latitude || !longitude) {
      setGeoError(null);
      setVerifyingLocation(false);
      return;
    }

    if (!navigator.geolocation) {
      console.warn("Geolocation not supported by browser");
      setVerifyingLocation(false);
      return;
    }

    setVerifyingLocation(true);

    const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3;
      const rad = (deg) => deg * Math.PI / 180;
      const dLat = rad(lat2 - lat1);
      const dLon = rad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(rad(lat1)) * Math.cos(rad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Ensure at least 500m buffer for indoor mobile/iOS GPS drift
    const allowedRadius = Math.max(Number(geoFencingRadius) || 100, 500);

    const checkPosition = (position) => {
      try {
        const rawDist = getDistanceInMeters(
          position.coords.latitude,
          position.coords.longitude,
          Number(latitude),
          Number(longitude)
        );
        const accuracy = position.coords.accuracy || 0;
        const effectiveDistance = Math.max(0, rawDist - Math.min(accuracy, 250));

        if (effectiveDistance > allowedRadius) {
          setGeoError(t("You appear to be away from the restaurant. Please verify your location to place an order."));
        } else {
          setGeoError(null); // Location verified!
        }
      } catch (err) {
        console.warn("Distance check error:", err);
      } finally {
        setVerifyingLocation(false);
      }
    };

    const handleGeoError = (err) => {
      console.warn("Geolocation notice:", err);
      setVerifyingLocation(false);
      // Only set error if user explicitly denied permission
      if (err.code === 1) { // PERMISSION_DENIED
        setGeoError(t("Please allow location access to verify you are at Table ") + table);
      }
      // If code 2 (POSITION_UNAVAILABLE) or 3 (TIMEOUT), do not block indoor customers
    };

    // Fast low-accuracy first (instant <300ms on mobile)
    navigator.geolocation.getCurrentPosition(
      checkPosition,
      () => {
        navigator.geolocation.getCurrentPosition(
          checkPosition,
          handleGeoError,
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 600000 }
    );
  }, [table, t]);

  useEffect(() => {
    if (!tenant || !table) {
      setError("Invalid QR Code. Please scan the QR code on your table again.");
      setLoading(false);
      return;
    }

    const fetchMenu = async (retryAttempt = 0) => {
      try {
        const menuRes = await apiClient.get(`${API_BASE_URL}/public/menu?tenant=${encodeURIComponent(tenant)}`, {
          headers: {
            'X-Tenant-DB': tenant
          }
        });
        if (menuRes.data) {
          setCategories(menuRes.data.categories || []);
          setItems(menuRes.data.items || []);
          if (menuRes.data.googleReviewLink) setGoogleReviewLink(menuRes.data.googleReviewLink);

          // Update cache for instantaneous subsequent visits
          try {
            sessionStorage.setItem(`customer_menu_${tenant}`, JSON.stringify(menuRes.data));
            localStorage.setItem(`customer_menu_${tenant}`, JSON.stringify(menuRes.data));
          } catch (e) {}

          // Never block menu viewing; verify location in parallel
          setLoading(false);
          verifyLocation(menuRes.data.restaurantSettings);
          return;
        }
      } catch (err) {
        console.warn(`[PublicMenu] Attempt ${retryAttempt + 1} failed:`, err);
        if (retryAttempt < 2) {
          await new Promise(r => setTimeout(r, 1200));
          return fetchMenu(retryAttempt + 1);
        }
        
        // If we already have items from cache, don't show full error
        setItems(prev => {
          if (prev.length === 0) {
            setError("Could not load the menu. Please ask a staff member for assistance.");
          }
          return prev;
        });
      } finally {
        setLoading(false);
      }
    };

    const checkOrderStatus = async () => {
      if (!table || !tenant) return;

      const candidateTableNames = [table];
      if (!table.includes(' - ')) {
        const floorPrefixes = ['Ground Floor', 'First Floor', 'Second Floor', 'Floor 1', 'Floor 2', 'Floor 3', 'Main Hall', 'AC Hall', 'Outdoor', 'Rooftop', 'Garden', 'Terrace', 'VIP Lounge', 'Dining'];
        floorPrefixes.forEach(floor => {
          candidateTableNames.push(`${floor} - ${table}`);
        });
      }

      for (const candidate of candidateTableNames) {
        try {
          const res = await apiClient.get(`${API_BASE_URL}/public/order-status?tableNo=${encodeURIComponent(candidate)}&tenant=${encodeURIComponent(tenant)}`, {
            headers: { 'X-Tenant-DB': tenant }
          });
          if (res.data && res.data.items && Array.isArray(res.data.items) && res.data.items.filter(i => !i.isCancelled).length > 0) {
            setActiveOrderData(res.data);
            return;
          }
        } catch (err) {
          if (err.response && err.response.status === 404) {
            continue;
          }
        }
      }
      setActiveOrderData(null);
    };

    fetchMenu();
    checkOrderStatus();

    // WebSocket real-time updates for instant KDS sync
    let socket = null;
    try {
      const socketUrl = API_BASE_URL.replace('/api', '');
      socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnectionAttempts: 3
      });

      socket.on('connect', () => {
        if (tenant) {
          socket.emit('joinTenant', { tenantDb: tenant });
        }
      });

      socket.on('kotUpdated', checkOrderStatus);
      socket.on('orderUpdated', checkOrderStatus);
      socket.on('newKOT', checkOrderStatus);
      socket.on('billSettled', checkOrderStatus);
      socket.on('foodReady', checkOrderStatus);
      socket.on('prepTimeUpdated', (data) => {
        setServiceMessage(`👨‍🍳 Chef set prep time: ${data.prepTimeMinutes} mins for ${data.itemName || 'your dish'}`);
        setTimeout(() => setServiceMessage(''), 5000);
        checkOrderStatus();
      });
      socket.on('cancellationResolved', (data) => {
        setServiceMessage(`Item cancellation ${data.action}ed: ${data.itemName}`);
        setTimeout(() => setServiceMessage(''), 3000);
        checkOrderStatus();
      });
    } catch (sockErr) {
      console.warn("Socket connection warning:", sockErr);
    }
    
    // Fast poll fallback every 3 seconds for instant response
    const interval = setInterval(checkOrderStatus, 3000);
    return () => {
      if (socket) socket.disconnect();
      clearInterval(interval);
    };
  }, [tenant, table]);

  const addToCart = (item, variant = null, note = '') => {
    const variantName = variant ? variant.name : null;
    const itemPrice = variant ? variant.price : item.price;
    const itemName = variant ? `${item.name} - ${variant.name}` : item.name;

    const existingIndex = cart.findIndex((cartItem) => 
      cartItem.menuItem === item._id && 
      cartItem.variant === variantName &&
      cartItem.specialNote === note
    );

    if (existingIndex !== -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, {
        menuItem: item._id,
        name: itemName,
        price: itemPrice,
        quantity: 1,
        variant: variantName,
        specialNote: note
      }]);
    }
  };

  const handleAddClick = (item) => {
    setSelectedItemForAdd(item);
    setSpecialNote('');
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setOrderStatus('placing');
    try {
      const total = calculateTotal();
      const sanitizedCart = cart.map(item => ({
        _id: item.menuItem || item._id,
        menuItem: item.menuItem || item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        variant: item.variant,
        specialNote: item.specialNote || ''
      }));

      const effectiveTableNo = activeOrderData?.tableNo || table;

      await apiClient.post(`${API_BASE_URL}/public/order`, {
        tableNo: effectiveTableNo,
        items: sanitizedCart,
        subTotal: total,
        taxes: 0,
        total: total,
        tenant: tenant
      }, {
        headers: {
          'X-Tenant-DB': tenant
        }
      });
      setCart([]);
      setIsCartOpen(false);
      setOrderStatus('success');
      setTimeout(() => setOrderStatus('menu'), 5000);
      
      // Instantly trigger an order status check to show the tracking banner
      checkOrderStatus();
    } catch (err) {
      console.error("Order failed", err);
      const errorMsg = err.response?.data?.message || err.message || "Please try again or call a waiter.";
      alert(`Failed to place order: ${errorMsg}`);
      setOrderStatus('menu');
    }
  };

  const requestService = async (type) => {
    setIsServiceOpen(false);
    try {
      await apiClient.post(`${API_BASE_URL}/public/request-service`, {
        tableNumber: table,
        requestType: type,
        tenant: tenant
      }, {
        headers: { 'X-Tenant-DB': tenant }
      });
      setServiceMessage(`Your request for "${type}" was sent!`);
      setTimeout(() => setServiceMessage(null), 4000);
    } catch (err) {
      console.error("Service request failed", err);
      alert("Failed to send request. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <UtensilsCrossed className="w-12 h-12 text-orange-500 animate-bounce mb-4" />
        <h2 className="text-xl font-bold text-slate-700">{t("Loading your menu...")}</h2>
      </div>);

  }

  if (geoError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
          <MapPin size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">{t("Location Verification")}</h2>
        <p className="text-slate-600 font-medium max-w-sm mb-6 leading-relaxed">{geoError}</p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              setGeoError(null);
              const cached = sessionStorage.getItem(`customer_menu_${tenant}`);
              if (cached) {
                try {
                  const data = JSON.parse(cached);
                  verifyLocation(data.restaurantSettings);
                } catch (e) {}
              }
            }}
            className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} />
            <span>{t("Retry Location")}</span>
          </button>

          <button
            onClick={() => setGeoError(null)}
            className="w-full py-3 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <UtensilsCrossed size={18} className="text-orange-500" />
            <span>{t("Continue to Menu")}</span>
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <Info className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{t("Oops!")}</h2>
        <p className="text-slate-600 max-w-sm mb-6">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            window.location.reload();
          }}
          className="py-3 px-6 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw size={18} />
          <span>{t("Retry Loading Menu")}</span>
        </button>
      </div>);
  }

  // Pre-calculate category visibility and items to fix quick-jump buttons
  const visibleCategoriesData = categories.map(category => {
    let categoryItems = items.filter((item) =>
      (item.category?._id || item.category) === category._id ||
      (item.category?.name || item.category) === category.name
    );

    if (dietaryFilter === 'veg') {
      categoryItems = categoryItems.filter(item => item.type === 'veg');
    } else if (dietaryFilter === 'non-veg') {
      categoryItems = categoryItems.filter(item => item.type !== 'veg');
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      categoryItems = categoryItems.filter(item => 
        item.name.toLowerCase().includes(query) || 
        (item.description && item.description.toLowerCase().includes(query))
      );
    }
    
    return { ...category, filteredItems: categoryItems };
  }).filter(c => c.filteredItems.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-orange-500 text-white p-6 rounded-b-[2rem] shadow-lg relative z-30 flex flex-col items-center">
        <div className="absolute top-4 right-4 z-50">
          <button 
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm transition-colors flex items-center gap-1"
          >
            {languages.find(l => l.code === language)?.native || 'English'}
          </button>
          
          <AnimatePresence>
            {isLangDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden min-w-[120px] flex flex-col"
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors border-b last:border-0 border-slate-100 ${language === lang.code ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {lang.native}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <h1 className="text-3xl font-black text-center tracking-tight mb-2 mt-2">{t("Digital Menu")}</h1>
        <div className="flex items-center justify-center gap-2 bg-white/20 w-max mx-auto px-4 py-1.5 rounded-full backdrop-blur-sm">
          <Navigation size={16} />
          <span className="font-bold text-sm">{t("You are at")} {table}</span>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md px-4 py-3 shadow-sm border-b border-slate-200">
        <div className="flex flex-col gap-3 max-w-2xl mx-auto">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t("Search dishes...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Quick Dietary Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setDietaryFilter('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${dietaryFilter === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              {t("All")}
            </button>
            <button
              onClick={() => setDietaryFilter('veg')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${dietaryFilter === 'veg' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              <div className={`w-2 h-2 rounded-full ${dietaryFilter === 'veg' ? 'bg-white' : 'bg-green-500'}`}></div> {t("Veg")}
            </button>
            <button
              onClick={() => setDietaryFilter('non-veg')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${dietaryFilter === 'non-veg' ? 'bg-red-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              <div className={`w-2 h-2 rounded-full ${dietaryFilter === 'non-veg' ? 'bg-white' : 'bg-red-500'}`}></div> {t("Non-Veg")}
            </button>
          </div>
          
          {/* Category Quick-Jump */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-slate-100 pt-2 mt-1">
            {visibleCategoriesData.map((category) => (
              <button
                key={`nav-${category._id}`}
                onClick={() => {
                  const el = document.getElementById(`category-${category._id}`);
                  if (el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 180;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold whitespace-nowrap border border-orange-100 transition-colors hover:bg-orange-100 active:bg-orange-200"
              >
                {(language !== 'en' && category.nameTranslations?.[language]) || t(category.name)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── YOUR CURRENT ORDER SECTION ── shown when table has an active bill */}
      {activeOrderData && activeOrderData.items && activeOrderData.items.filter(i => !i.isCancelled).length > 0 && (
        <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-md border border-orange-100 overflow-hidden">
            {/* Section header */}
            <div className="bg-orange-500 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <ChefHat size={18} />
                <span className="font-black text-sm">{t("Your Current Order")}</span>
                <span className="bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {activeOrderData.items.filter(i => !i.isCancelled).length} {t("items")}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black ${
                activeOrderData.kitchenStatus === 'Ready'
                  ? 'bg-emerald-100 text-emerald-700'
                  : activeOrderData.kitchenStatus === 'Preparing'
                  ? 'bg-amber-100 text-amber-700'
                  : activeOrderData.kitchenStatus === 'Completed'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-pulse inline-block ${
                  activeOrderData.kitchenStatus === 'Ready' ? 'bg-emerald-500' :
                  activeOrderData.kitchenStatus === 'Preparing' ? 'bg-amber-500' :
                  activeOrderData.kitchenStatus === 'Completed' ? 'bg-purple-500' : 'bg-blue-500'
                }`}></span>
                {activeOrderData.kitchenStatus === 'Ready' ? t('Prepared & Ready') :
                 activeOrderData.kitchenStatus === 'Preparing' ? t('Preparing') :
                 activeOrderData.kitchenStatus === 'Completed' ? t('Bill Generated') : t('Received')}
              </div>
            </div>

            {/* Items list */}
            <div className="divide-y divide-slate-100">
              {activeOrderData.items.filter(i => !i.isCancelled).map((item, idx) => {
                const effectiveQty = item.quantity - (item.cancelledQuantity || 0);
                const itemTotal = item.price * effectiveQty;
                const isPrepared = item.kdsStatus === 'Ready' || item.status === 'Ready';
                const isPreparing = item.kdsStatus === 'Preparing' || item.status === 'Preparing';

                return (
                  <div key={item._id || idx} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-600 text-xs font-black flex items-center justify-center shrink-0">
                        {effectiveQty}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                        {item.specialNote && (
                          <p className="text-[10px] text-slate-400 truncate">📝 {item.specialNote}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.cancellationRequested ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded-full font-bold">Cancel Pending</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleWithdrawItemCancel(item); }}
                            className="text-[9px] bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 transition-all shadow-xs cursor-pointer"
                            title={t("Withdraw Cancel Request")}
                          >
                            ↩️ {t("Withdraw")}
                          </button>
                        </div>
                      ) : isPrepared ? (
                        <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                          <Check size={10} strokeWidth={3} /> {t("Prepared")}
                        </span>
                      ) : isPreparing ? (
                        <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          👨‍🍳 {t("Preparing")}
                        </span>
                      ) : (
                        <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                          ⏳ {t("Received")}
                        </span>
                      )}
                      <span className="text-xs font-black text-orange-600">₹{itemTotal}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline Expanded Bill Breakdown */}
            {isDetailsExpanded && (
              <div className="bg-orange-50/50 p-4 border-t border-slate-100 space-y-2 animate-in fade-in duration-200">
                <div className="text-xs font-bold text-slate-700 border-b border-orange-100 pb-1 mb-2">
                  {t("Order Breakdown")}
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{t("Subtotal")}</span>
                  <span>₹{activeOrderData.subTotal || activeOrderData.total}</span>
                </div>
                {activeOrderData.tax > 0 && (
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{t("Taxes (GST)")}</span>
                    <span>₹{activeOrderData.tax}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black text-slate-800 pt-1 border-t border-orange-100">
                  <span>{t("Grand Total")}</span>
                  <span>₹{activeOrderData.total}</span>
                </div>
              </div>
            )}

            {/* Order total footer */}
            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-t border-slate-100">
              <div className="text-xs text-slate-500 font-bold">{t("Table")} {table}</div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{t("Total")}</div>
                  <div className="text-sm font-black text-slate-800">₹{activeOrderData.total}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDetailsExpanded(!isDetailsExpanded);
                    setShowOrderModal(true);
                  }}
                  className="bg-orange-500 text-white text-[11px] font-black px-3 py-1.5 rounded-xl hover:bg-orange-600 active:scale-95 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  {t("Details")} {isDetailsExpanded ? '▲' : '→'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Categories & Items */}
      <main className="p-4 space-y-8 mt-2 max-w-2xl mx-auto">
        {visibleCategoriesData.map((category) => {
          const categoryItems = category.filteredItems;

          return (
            <div key={category._id} id={`category-${category._id}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500 scroll-mt-32">
              <h2 className="text-xl font-black text-slate-800 mb-4 px-2 flex items-center gap-2">
                {(language !== 'en' && category.nameTranslations?.[language]) || t(category.name)}
                <div className="h-px bg-slate-200 flex-1 ml-4 mt-1"></div>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryItems.map((item) =>
                <div key={item._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4">
                    {item.image ?
                  <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-xl shadow-sm" /> :

                  <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                        <UtensilsCrossed size={32} />
                      </div>
                  }
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <h3 className="font-bold text-slate-800 leading-tight pr-2">{(language !== 'en' && item.nameTranslations?.[language]) || t(item.name)}</h3>
                          <span className={`w-3 h-3 rounded-full shrink-0 mt-1 ${item.type === 'veg' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </div>
                        {item.isFavorite && (
                          <span className="inline-block bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-0.5 rounded mt-1 uppercase tracking-wider">
                            🔥 {t("Bestseller")}
                          </span>
                        )}
                        {item.description && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{(language !== 'en' && item.descriptionTranslations?.[language]) || t(item.description)}</p>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-black text-orange-600">
                          {item.variants?.length > 0 ? `₹${Math.min(...item.variants.map((v) => v.price))} - ₹${Math.max(...item.variants.map((v) => v.price))}` : `₹${item.price}`}
                        </span>
                        <button
                        onClick={() => handleAddClick(item)}
                        className="bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white px-4 py-1.5 rounded-full font-bold text-sm transition-colors shadow-sm">{t("ADD")}


                      </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>);

        })}
      </main>

      {/* Live Order Tracking — Mini tappable bar + Full Modal */}
      {activeOrderData && (
        <>
          {/* Mini bar at bottom — tap to open modal */}
          {orderStatus === 'menu' && (
            <motion.div
              initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className={`fixed ${cart.length > 0 ? 'bottom-20' : 'bottom-6'} left-0 right-0 px-4 z-30 transition-all duration-300`}
            >
              <button
                onClick={() => setShowOrderModal(prev => !prev)}
                className={`w-full text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 transition-all active:scale-[0.98] ${
                  activeOrderData.kitchenStatus === 'Ready'
                    ? 'bg-emerald-600 border-2 border-emerald-400'
                    : activeOrderData.kitchenStatus === 'Preparing'
                    ? 'bg-amber-600'
                    : activeOrderData.kitchenStatus === 'Completed'
                    ? 'bg-purple-600'
                    : 'bg-blue-600'
                }`}
              >
                <span className="font-bold flex items-center gap-2 text-sm">
                  {activeOrderData.kitchenStatus === 'Ready' ? '🎉' :
                   activeOrderData.kitchenStatus === 'Preparing' ? '👨‍🍳' :
                   activeOrderData.kitchenStatus === 'Completed' ? '🧾' : '📋'}
                  {activeOrderData.kitchenStatus === 'Ready'
                    ? t("Food Prepared & Ready!")
                    : activeOrderData.kitchenStatus === 'Preparing'
                    ? t("Order in Kitchen (Preparing)")
                    : activeOrderData.kitchenStatus === 'Completed'
                    ? t("Bill Generated (Ready to Pay)")
                    : t("Order Received")}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-black text-base">₹{activeOrderData.total}</span>
                  {/* Toggle arrow — points UP when modal open, DOWN when closed */}
                  <ChevronUp
                    size={22}
                    color="#ffffff"
                    strokeWidth={2.5}
                    style={{ transform: showOrderModal ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s ease' }}
                  />
                </div>
              </button>
            </motion.div>
          )}

          {/* Full tracking modal */}
          <AnimatePresence>
            {showOrderModal && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-end"
                onClick={() => setShowOrderModal(false)}
              >
                <motion.div
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                  onClick={(e) => e.stopPropagation()}
                  className={`rounded-t-3xl text-white p-6 shadow-2xl flex flex-col gap-4 ${
                    activeOrderData.kitchenStatus === 'Ready'
                      ? 'bg-emerald-600'
                      : activeOrderData.kitchenStatus === 'Preparing'
                      ? 'bg-amber-600'
                      : activeOrderData.kitchenStatus === 'Completed'
                      ? 'bg-purple-600'
                      : 'bg-blue-600'
                  }`}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black flex items-center gap-2">
                      {activeOrderData.kitchenStatus === 'Ready' ? '🎉' :
                       activeOrderData.kitchenStatus === 'Preparing' ? '👨‍🍳' :
                       activeOrderData.kitchenStatus === 'Completed' ? '🧾' : '📋'}
                      {activeOrderData.kitchenStatus === 'Ready'
                        ? t("Food Prepared & Ready!")
                        : activeOrderData.kitchenStatus === 'Preparing'
                        ? t("Order in Kitchen")
                        : activeOrderData.kitchenStatus === 'Completed'
                        ? t("Bill Generated")
                        : t("Order Received")}
                    </h2>
                    <span className="font-black text-2xl">₹{activeOrderData.total}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <div className="h-3 flex-1 bg-black/20 rounded-full overflow-hidden">
                      <div className={`h-full bg-white rounded-full transition-all duration-500 ${
                        activeOrderData.kitchenStatus === 'Ready' || activeOrderData.kitchenStatus === 'Completed' ? 'w-full'
                          : activeOrderData.kitchenStatus === 'Preparing' ? 'w-2/3'
                          : 'w-1/3'
                      }`} />
                    </div>
                    <span className="font-bold text-sm shrink-0">{activeOrderData.itemsCount} {t("items")}</span>
                  </div>

                  {/* Status Text */}
                  <p className="text-sm text-white/90 font-medium">
                    {t("Status")}:{' '}
                    <span className="font-black">
                      {activeOrderData.kitchenStatus === 'Ready'
                        ? t("Food is Prepared! Hot & Fresh 🍲")
                        : activeOrderData.kitchenStatus === 'Preparing'
                        ? t("Chef is preparing your food...")
                        : activeOrderData.kitchenStatus === 'Completed'
                        ? t("Bill generated. Ready for payment 💳")
                        : t("Sent to Kitchen ⏳")}
                    </span>
                  </p>

                  {/* Steps indicator */}
                  <div className="flex items-center gap-2 mt-1">
                    {['Order Received', 'Preparing', 'Prepared'].map((step, i) => {
                      const currentIdx = (activeOrderData.kitchenStatus === 'Ready' || activeOrderData.kitchenStatus === 'Completed') ? 2 : activeOrderData.kitchenStatus === 'Preparing' ? 1 : 0;
                      return (
                        <React.Fragment key={step}>
                          <div className={`flex flex-col items-center gap-1`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                              i <= currentIdx ? 'bg-white text-emerald-700' : 'bg-white/30 text-white'
                            }`}>{i + 1}</div>
                            <span className={`text-[10px] font-bold ${ i <= currentIdx ? 'text-white' : 'text-white/50'}`}>{t(step)}</span>
                          </div>
                          {i < 2 && <div className={`flex-1 h-0.5 mb-4 ${ i < currentIdx ? 'bg-white' : 'bg-white/30'}`} />}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Items List */}
                  {activeOrderData.items && activeOrderData.items.length > 0 && (
                    <div className="mt-4 bg-white/10 rounded-2xl p-4 max-h-[30vh] overflow-y-auto custom-scrollbar flex flex-col gap-3">
                      <h3 className="font-bold text-sm border-b border-white/20 pb-2 mb-1">{t("Order Details")}</h3>
                      {activeOrderData.items.map(item => (
                        <div key={item._id} className={`flex items-center justify-between gap-2 ${item.isCancelled ? 'opacity-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm truncate ${item.isCancelled ? 'line-through' : ''}`}>
                              {item.quantity - (item.cancelledQuantity || 0)}x {item.name}
                              {item.cancelledQuantity > 0 && !item.isCancelled && <span className="text-[10px] ml-1 bg-red-500/20 px-1.5 py-0.5 rounded text-red-100">({item.cancelledQuantity} Cancelled)</span>}
                            </p>
                            {(() => {
                              const cd = getPrepCountdown(item);
                              if (!cd || item.isCancelled) return null;
                              return (
                                <div className="mt-1 bg-amber-500/20 border border-amber-500/40 rounded-xl p-2 text-amber-200 text-[11px] flex flex-col gap-1 w-full">
                                  <div className="flex justify-between items-center font-bold">
                                    <span>⏱️ Est. Prep: {item.prepTimeMinutes}m</span>
                                    <span className={cd.isOverdue ? 'text-amber-300 font-extrabold animate-pulse' : 'text-amber-300 font-extrabold'}>
                                      {cd.isOverdue ? '⚡ Ready Soon!' : `⏳ ${cd.remainingMins}m ${cd.remainingSecs}s left`}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-900/80 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-amber-400 to-orange-500 h-full transition-all duration-1000" 
                                      style={{ width: `${cd.percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                            {item.specialNote && <p className="text-[10px] text-white/70 truncate">Note: {item.specialNote}</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`font-black text-sm ${item.isCancelled ? 'line-through' : ''}`}>
                              ₹{item.price * (item.quantity - (item.cancelledQuantity || 0))}
                            </span>
                            {item.isCancelled ? (
                              <span className="text-[10px] font-bold bg-red-500/50 px-2 py-1 rounded-full text-white/90">{t("Cancelled")}</span>
                            ) : item.cancellationRejected ? (
                              <span className="text-[10px] font-bold bg-slate-500/50 px-2 py-1 rounded-full text-white/90">{t("Rejected")}</span>
                            ) : item.cancellationRequested ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-full text-center">
                                  {item.cancellationRequestedQty > 1 ? `${item.cancellationRequestedQty} Pending...` : t("Pending...")}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleWithdrawItemCancel(item); }}
                                  className="text-[10px] font-black bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-900 px-2.5 py-1 rounded-full flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                                  title={t("Withdraw Cancel Request")}
                                >
                                  ↩️ {t("Withdraw")}
                                </button>
                              </div>
                            ) : (item.kdsStatus === 'Ready' || item.status === 'Ready') ? (
                              <span className="text-[10px] font-bold bg-emerald-500/60 text-white border border-emerald-400/40 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                                <Check size={11} strokeWidth={3} /> {t("Prepared")}
                              </span>
                            ) : (item.kdsStatus === 'Preparing' || item.status === 'Preparing') ? (
                              <span className="text-[10px] font-bold bg-amber-500/50 text-white border border-amber-400/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                                👨‍🍳 {t("Preparing...")}
                              </span>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRequestItemCancel(item); }}
                                className="text-[10px] font-bold bg-red-500/80 hover:bg-red-500 px-2 py-1 rounded-full transition-colors"
                              >
                                {t("Cancel")}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      <div className="border-t border-white/20 pt-2 mt-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{t("Subtotal")}</span>
                          <span>₹{activeOrderData.subTotal || activeOrderData.total}</span>
                        </div>
                        {activeOrderData.tax > 0 && (
                          <div className="flex justify-between text-xs text-white/80">
                            <span>{t("Taxes (CGST/SGST)")}</span>
                            <span>₹{activeOrderData.tax}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-sm pt-1">
                          <span>{t("Total")}</span>
                          <span>₹{activeOrderData.total}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Close button — only closes the modal, does NOT cancel the order */}
                  <button
                    onClick={() => setShowOrderModal(false)}
                    className="mt-2 w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-2xl transition-colors"
                  >
                    {t("Close")}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <style>{`
            @keyframes progress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
          `}</style>
        </>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && orderStatus === 'menu' &&
      <motion.div
        initial={{ y: 100 }} animate={{ y: 0 }}
        className="fixed bottom-6 left-0 right-0 px-4 z-30">
        
          <button
          onClick={() => setIsCartOpen(true)}
          className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between">
          
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 text-white font-black w-8 h-8 rounded-full flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </div>
              <span className="font-bold">{t("View Order")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg">₹{calculateTotal()}</span>
              <ChevronRight size={20} />
            </div>
          </button>
        </motion.div>
      }

      {/* Bell ring animation */}
      <style>{`
        @keyframes bell-ring {
          0%,100%{transform:rotate(0deg)}
          10%{transform:rotate(15deg)}
          20%{transform:rotate(-13deg)}
          30%{transform:rotate(11deg)}
          40%{transform:rotate(-9deg)}
          50%{transform:rotate(7deg)}
          60%{transform:rotate(-5deg)}
          70%{transform:rotate(3deg)}
          80%{transform:rotate(-2deg)}
          90%{transform:rotate(1deg)}
        }
        .bell-ring { animation: bell-ring 1.4s ease-in-out infinite; transform-origin: top center; display:inline-block; }
      `}</style>

      {/* Floating Draggable Call Waiter Button */}
      {orderStatus === 'menu' && (
        <>
          {/* Service options popup anchored near bell */}
          <AnimatePresence>
            {isServiceOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{ position:'fixed', left: Math.min(bellPos.x, window.innerWidth - 200), top: Math.max(8, bellPos.y - 164), zIndex: 50 }}
                className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col w-48"
              >
                <button onClick={() => requestService('Call Waiter')} className="p-3 flex items-center gap-3 hover:bg-orange-50 text-slate-700 font-bold border-b">
                  <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Bell size={14} /></div>{t("Call Waiter")}
                </button>
                <button onClick={() => requestService('Need Water')} className="p-3 flex items-center gap-3 hover:bg-blue-50 text-slate-700 font-bold border-b">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Droplets size={14} /></div>{t("Need Water")}
                </button>
                <button onClick={() => requestService('Pay the Bill')} className="p-3 flex items-center gap-3 hover:bg-green-50 text-slate-700 font-bold">
                  <div className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><CreditCard size={14} /></div>{t("Pay the Bill")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Full-screen transparent backdrop — tapping anywhere outside closes the panel */}
          {isServiceOpen && (
            <div
              style={{ position:'fixed', inset:0, zIndex: 39 }}
              onPointerUp={() => setIsServiceOpen(false)}
            />
          )}

          {/* Draggable bell */}
          <div
            onPointerDown={handleBellPointerDown}
            onPointerMove={handleBellPointerMove}
            onPointerUp={(e) => {
              handleBellPointerUp(e);
              // Toggle panel only on tap (not drag). Use pointerUp for instant response on all screen types.
              if (!didDrag.current) setIsServiceOpen(o => !o);
            }}
            style={{ position:'fixed', left: bellPos.x, top: bellPos.y, zIndex: 60, touchAction:'none', cursor:'grab' }}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl select-none transition-colors ${isServiceOpen ? 'bg-slate-800 text-white' : 'bg-white text-orange-600 border-2 border-orange-500'}`}
          >
            {isServiceOpen ? <X size={18} /> : <span className="bell-ring"><Bell size={18} /></span>}
          </div>
        </>
      )}


      {/* Service Request Toast */}
      <AnimatePresence>
        {serviceMessage &&
        <motion.div
          initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
          className="fixed top-6 left-4 right-4 bg-slate-800 text-white p-4 rounded-xl shadow-xl flex items-center gap-3 z-50">
          
            <CheckCircle2 className="text-green-400" />
            <span className="font-bold flex-1">{serviceMessage}</span>
          </motion.div>
        }
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {selectedItemForAdd &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
            <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            
              <div className="p-6 border-b flex justify-between items-center shrink-0">
                <h3 className="font-black text-xl text-slate-800">{(language !== 'en' && selectedItemForAdd.nameTranslations?.[language]) || t(selectedItemForAdd.name)}</h3>
                <button onClick={() => setSelectedItemForAdd(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-4">
                {selectedItemForAdd.variants && selectedItemForAdd.variants.length > 0 ? (
                  <div>
                    <p className="font-bold text-slate-600 mb-2">{t("Select Variant")}</p>
                    <div className="space-y-2">
                      {selectedItemForAdd.variants.map((v, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            addToCart(selectedItemForAdd, v, specialNote);
                            setSelectedItemForAdd(null);
                          }}
                          className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 hover:border-orange-500 hover:bg-orange-50 transition-all text-left">
                          <span className="font-bold text-slate-700">{v.name}</span>
                          <span className="font-black text-orange-600">₹{v.price}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700">{t("Price")}</span>
                      <span className="font-black text-orange-600 text-lg">₹{selectedItemForAdd.price}</span>
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="font-bold text-slate-600 mb-2 flex items-center gap-2">
                    <Info size={16} className="text-orange-500"/>
                    {t("Special Instructions")}
                  </p>
                  <textarea
                    value={specialNote}
                    onChange={(e) => setSpecialNote(e.target.value)}
                    placeholder={t("e.g. Less spicy, no onions...")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20"
                  />
                </div>

                {/* Smart Upselling */}
                {selectedItemForAdd && 
                 !['beverage', 'drink', 'juice'].some(k => selectedItemForAdd.category?.name?.toLowerCase().includes(k)) && (
                  (() => {
                    let upsells = items.filter(i => 
                      ['beverage', 'drink', 'juice', 'dessert'].some(k => i.category?.name?.toLowerCase().includes(k))
                    ).sort(() => 0.5 - Math.random()).slice(0, 2);
                    
                    if (upsells.length === 0) {
                      upsells = items.filter(i => i._id !== selectedItemForAdd._id && i.price <= 150).slice(0, 2);
                    }
                    
                    if (upsells.length === 0) return null;

                    return (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="font-bold text-slate-600 mb-3">{t("Pairs well with...")}</p>
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                          {upsells.map(upsell => (
                            <div key={`upsell-${upsell._id}`} className="min-w-[140px] bg-white border border-slate-200 rounded-xl p-2 shrink-0 flex flex-col justify-between">
                              <div>
                                <h5 className="font-bold text-sm text-slate-800 line-clamp-1">{(language !== 'en' && upsell.nameTranslations?.[language]) || t(upsell.name)}</h5>
                                <p className="text-orange-600 font-bold text-xs mt-1">₹{upsell.price}</p>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(upsell);
                                  // Show a tiny success toast or just let it add seamlessly
                                  const btn = e.currentTarget;
                                  const originalText = btn.innerText;
                                  btn.innerText = t("Added!");
                                  btn.classList.add("bg-green-500", "text-white");
                                  btn.classList.remove("bg-orange-50", "text-orange-600");
                                  setTimeout(() => {
                                    if(btn) {
                                      btn.innerText = originalText;
                                      btn.classList.remove("bg-green-500", "text-white");
                                      btn.classList.add("bg-orange-50", "text-orange-600");
                                    }
                                  }, 1000);
                                }}
                                className="mt-2 w-full bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white py-1.5 rounded-lg text-xs font-bold transition-colors"
                              >
                                + {t("ADD")}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {(!selectedItemForAdd.variants || selectedItemForAdd.variants.length === 0) && (
                <div className="p-4 border-t bg-slate-50 shrink-0">
                  <button
                    onClick={() => {
                      addToCart(selectedItemForAdd, null, specialNote);
                      setSelectedItemForAdd(null);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-bold shadow-md transition-colors"
                  >
                    {t("Add to Order")}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {isCartOpen &&
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-end">
          
            <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden">
            
              <div className="p-6 pb-4 border-b flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="text-orange-500" />{t("Your Order")}
              </h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {cart.map((item, index) =>
              <div key={index} className="flex items-center justify-between py-4 border-b last:border-0">
                    <div className="flex-1 pr-2">
                      <h4 className="font-bold text-slate-800">{(language !== 'en' && item.nameTranslations?.[language]) || t(item.name)}</h4>
                      <p className="text-orange-600 font-bold text-sm">₹{item.price}</p>
                      {item.specialNote && (
                        <p className="text-xs text-slate-500 mt-1 italic flex gap-1">
                          <span className="font-bold text-slate-400">Note:</span> {item.specialNote}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 border rounded-xl p-1">
                      <button onClick={() => updateQuantity(index, -1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded-lg shadow-sm">
                        <Minus size={16} />
                      </button>
                      <span className="font-black w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded-lg shadow-sm">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
              )}
              </div>

              <div className="p-6 bg-slate-50 border-t shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-600 font-bold">{t("Total Amount")}</span>
                  <span className="text-2xl font-black text-slate-800">₹{calculateTotal()}</span>
                </div>
                <button
                onClick={placeOrder}
                disabled={orderStatus === 'placing'}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-4 font-black text-lg shadow-xl shadow-orange-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                
                  {orderStatus === 'placing' ? 'Sending to Kitchen...' : 'Place Order Now'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Success Screen */}
      <AnimatePresence>
        {orderStatus === 'success' &&
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center p-6 text-center">
          
            <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
            className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
            
              <CheckCircle2 size={48} />
            </motion.div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">{t("Order Placed!")}</h2>
            <p className="text-slate-600 text-lg mb-8">{t("Your order has been sent to the kitchen. It will be served to you shortly.")}</p>
            
            {googleReviewLink && (
              <a 
                href={googleReviewLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white border-2 border-slate-200 text-slate-700 hover:border-yellow-400 hover:bg-yellow-50 font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Star className="text-yellow-400" fill="currentColor" size={20} />
                {t("Rate us on Google")}
              </a>
            )}
          </motion.div>
        }
      </AnimatePresence>

    </div>);

};

export default CustomerMenu;