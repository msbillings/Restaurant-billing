import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { ShoppingCart, Plus, Minus, X, Info, UtensilsCrossed, ChevronRight, ChevronUp, ChevronDown, CheckCircle2, Navigation, Bell, Droplets, CreditCard, Search, Star, ChefHat, Check, MapPin, RefreshCw, Loader2, SlidersHorizontal, Clipboard, Wallet, Receipt, BadgeCheck, ShieldAlert, ShieldCheck, LocateFixed, Radio, Compass, ExternalLink, AlertTriangle, Lock, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

const getPublicApiUrl = () => {
  return getApiUrl();
};

const API_BASE_URL = getPublicApiUrl();
const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
});

// Authoritative Location Verification Status Machine
const LOCATION_STATUS = {
  INITIALIZING: 'INITIALIZING',
  REQUESTING: 'REQUESTING',
  VERIFIED: 'VERIFIED',
  OUTSIDE: 'OUTSIDE',
  LOW_ACCURACY: 'LOW_ACCURACY',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TIMEOUT: 'TIMEOUT',
  ERROR: 'ERROR'
};

// Mathematically authoritative Haversine distance calculation in meters
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  // Validate coordinates before calculation
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;
  if (nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90) return null;
  if (nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180) return null;

  const R = 6371000; // Earth radius in meters
  const toRadians = (deg) => (deg * Math.PI) / 180;

  const dLat = toRadians(nLat2 - nLat1);
  const dLon = toRadians(nLon2 - nLon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(nLat1)) *
    Math.cos(toRadians(nLat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const calculatedDistanceMeters = R * c;

  // Physical distance is strictly non-negative
  return Math.max(0, calculatedDistanceMeters);
};

const getCustomerParams = () => {
  if (typeof window === 'undefined') return new URLSearchParams();
  let search = window.location.search;
  if (!search && window.location.hash && window.location.hash.includes('?')) {
    search = window.location.hash.substring(window.location.hash.indexOf('?'));
  }
  return new URLSearchParams(search);
};

const getCachedCustomerMenu = (tenant) => {
  if (!tenant || typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(`customer_menu_${tenant}`) || localStorage.getItem(`customer_menu_${tenant}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
};

const getCachedActiveOrder = (tenant, table) => {
  if (!tenant || !table || typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(`active_order_${tenant}_${table}`) || localStorage.getItem(`active_order_${tenant}_${table}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.items) && parsed.items.filter(i => !i.isCancelled).length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
};

const CustomerMenu = () => {
  const { language, setLanguage, t } = useLanguage();
  
  const urlParams = useMemo(() => getCustomerParams(), []);
  const tenant = urlParams.get('tenant');
  const table = urlParams.get('table');

  const cachedMenu = useMemo(() => getCachedCustomerMenu(tenant), [tenant]);
  const cachedActiveOrder = useMemo(() => getCachedActiveOrder(tenant, table), [tenant, table]);

  const [restaurantSettings, setRestaurantSettings] = useState(() => cachedMenu?.restaurantSettings || null);
  const [googleReviewLink, setGoogleReviewLink] = useState(() => cachedMenu?.googleReviewLink || null);
  const [categories, setCategories] = useState(() => cachedMenu?.categories || []);
  const [items, setItems] = useState(() => cachedMenu?.items || []);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(() => !cachedMenu);
  const [activeOrderData, setActiveOrderData] = useState(() => cachedActiveOrder);
  const [isCheckingOrder, setIsCheckingOrder] = useState(() => !cachedActiveOrder);
  const [hasConfirmedTableStatus, setHasConfirmedTableStatus] = useState(() => !!cachedActiveOrder);
  const [error, setError] = useState(null);

  // Authoritative Location Verification State Machine
  const [locationState, setLocationState] = useState(() => {
    const isGeoEnabled = cachedMenu?.restaurantSettings?.enableGeoFencing;
    return {
      status: isGeoEnabled ? LOCATION_STATUS.INITIALIZING : LOCATION_STATUS.VERIFIED,
      latitude: null,
      longitude: null,
      accuracy: null,
      distanceMeters: null,
      allowedRadius: parseInt(cachedMenu?.restaurantSettings?.geoFencingRadius, 10) || 50,
      restaurantCoords: null,
      errorMessage: null,
      timestamp: null
    };
  });

  // Dedicated refs to guarantee single watchers, prevent race conditions, and decouple from re-renders
  const isMountedRef = useRef(true);
  const watchIdRef = useRef(null);
  const requestIdRef = useRef(0);
  const restaurantSettingsRef = useRef(restaurantSettings);

  useEffect(() => {
    restaurantSettingsRef.current = restaurantSettings;
  }, [restaurantSettings]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
        console.log("[LOCATION] Component unmounted - Watch cleared");
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time in 12-hour AM/PM format (e.g. 02:48 AM, 03:10 PM)
  const format12HourTime = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getPrepCountdown = (item) => {
    if (!item || !item.prepTimeMinutes) return null;
    // When KDS / Kitchen marks dish Prepared / Ready, stop and hide the countdown timer
    const isReadyOrPrepared = item.kdsStatus === 'Ready' || item.kdsStatus === 'Prepared' || item.status === 'Ready' || item.status === 'Prepared';
    if (isReadyOrPrepared) return null;

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
  const [dietaryFilter, setDietaryFilter] = useState('all'); // 'all', 'veg', 'non-veg', 'bestseller'
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Item Detail Modal State (Full info, big image, typography, variants & description)
  const [viewingItemDetail, setViewingItemDetail] = useState(null);
  const [detailSelectedVariant, setDetailSelectedVariant] = useState(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [detailSpecialNote, setDetailSpecialNote] = useState('');

  // Interactive Pinch / Double-Tap Zoom state for Item Detail Modal
  const [modalZoom, setModalZoom] = useState(1);
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 });
  const touchStartRef = useRef({ dist: 0, zoom: 1, x: 0, y: 0, panX: 0, panY: 0 });
  const lastTapRef = useRef(0);

  const resetModalZoom = useCallback(() => {
    setModalZoom(1);
    setModalPan({ x: 0, y: 0 });
  }, []);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = {
        dist,
        zoom: modalZoom,
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        panX: modalPan.x,
        panY: modalPan.y
      };
    } else if (e.touches.length === 1) {
      touchStartRef.current = {
        dist: 0,
        zoom: modalZoom,
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: modalPan.x,
        panY: modalPan.y
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStartRef.current.dist > 0) {
      e.preventDefault();
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = newDist / touchStartRef.current.dist;
      const nextZoom = Math.min(4.0, Math.max(1.0, touchStartRef.current.zoom * scaleFactor));
      setModalZoom(nextZoom);
    } else if (e.touches.length === 1 && modalZoom > 1.05) {
      e.preventDefault();
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      const maxPan = (modalZoom - 1) * 120;
      setModalPan({
        x: Math.max(-maxPan, Math.min(maxPan, touchStartRef.current.panX + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, touchStartRef.current.panY + dy))
      });
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      if (modalZoom <= 1.08) {
        resetModalZoom();
      }
      
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (modalZoom > 1.2) {
          resetModalZoom();
        } else {
          setModalZoom(2.2);
        }
      }
      lastTapRef.current = now;
    }
  };

  const handleOpenItemDetail = (item) => {
    setViewingItemDetail(item);
    setDetailSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
    setDetailQuantity(1);
    setDetailSpecialNote('');
    resetModalZoom();
  };

  // Service Request & Variants/Notes State
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [serviceMessage, setServiceMessage] = useState(null);
  const [selectedItemForAdd, setSelectedItemForAdd] = useState(null);
  const [specialNote, setSpecialNote] = useState('');

  // Dynamic rotating loading tip state
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const loadingTips = [
    { icon: "👨‍🍳", title: t("Crafting Chef's Specials"), subtitle: t("Preparing your table's digital experience...") },
    { icon: "🥗", title: t("Fresh Dishes & Ingredients"), subtitle: t("Loading updated prices & specialties...") },
    { icon: "🔥", title: t("Today's Bestsellers"), subtitle: t("Finding the most loved food choices...") },
    { icon: "🍹", title: t("Beverages & Desserts"), subtitle: t("Organizing your personalized digital menu...") }
  ];

  useEffect(() => {
    if (!loading && items.length > 0) return;
    const interval = setInterval(() => {
      setLoadingTipIndex(prev => (prev + 1) % 4);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading, items.length]);

  // Order tracking modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // In-App Cancellation Modal State (replaces blocking window.prompt)
  const [cancelModalData, setCancelModalData] = useState(null); // { item, maxQty, selectedQty }
  const isCheckingRef = useRef(false);



  const handleRequestItemCancel = (item) => {
    const maxCancellable = Math.max(1, (item.quantity || 1) - (item.cancelledQuantity || 0));
    if (maxCancellable <= 1) {
      executeItemCancel(item, 1);
    } else {
      setCancelModalData({
        item,
        maxQty: maxCancellable,
        selectedQty: 1
      });
    }
  };

  const executeItemCancel = async (item, cancelQty) => {
    const itemId = item._id || item.id;
    setCancelModalData(null);

    // ⚡ 0ms INSTANT OPTIMISTIC UI UPDATE - NO WAITING, NO FREEZING!
    setActiveOrderData(prev => {
      if (!prev) return prev;
      const newItems = (prev.items || []).map(i => 
        ((i._id && i._id === itemId) || (i.id && i.id === itemId) || i.name === item.name) 
          ? { ...i, cancellationRequested: true, cancellationRequestedQty: cancelQty } 
          : i
      );
      return { ...prev, items: newItems };
    });

    setServiceMessage(`⏳ Requesting cancellation for ${cancelQty}x ${item.name}...`);

    try {
      const tenant = urlParams.get('tenant') || 'default';
      const tableNo = urlParams.get('table');
      await apiClient.post(`${API_BASE_URL}/public/request-item-cancel`, {
        orderId: activeOrderData?._id,
        itemId,
        tableNo,
        cancelQty
      }, {
        headers: { 'X-Tenant-DB': tenant },
        timeout: 8000
      });
      
      setServiceMessage(`✅ Cancellation requested for ${cancelQty} item(s)`);
      setTimeout(() => setServiceMessage(''), 3500);
    } catch (error) {
      console.error('Error requesting cancellation:', error);
      // Revert optimistic update on failure
      setActiveOrderData(prev => {
        if (!prev) return prev;
        const newItems = (prev.items || []).map(i => 
          ((i._id && i._id === itemId) || (i.id && i.id === itemId) || i.name === item.name) 
            ? { ...i, cancellationRequested: false, cancellationRequestedQty: 0 } 
            : i
        );
        return { ...prev, items: newItems };
      });
      const errMsg = error.response?.data?.message || 'Failed to request cancellation. Please try again.';
      setServiceMessage(`⚠️ ${errMsg}`);
      setTimeout(() => setServiceMessage(''), 4000);
    }
  };

  const handleWithdrawItemCancel = async (item) => {
    const itemId = item._id || item.id;

    // ⚡ 0ms INSTANT OPTIMISTIC UI UPDATE
    setActiveOrderData(prev => {
      if (!prev) return prev;
      const newItems = (prev.items || []).map(i => 
        ((i._id && i._id === itemId) || (i.id && i.id === itemId) || i.name === item.name) 
          ? { ...i, cancellationRequested: false, cancellationRequestedQty: 0 } 
          : i
      );
      return { ...prev, items: newItems };
    });
    
    setServiceMessage(`⏳ Withdrawing cancel request for ${item.name}...`);

    try {
      const tenant = urlParams.get('tenant') || 'default';
      const tableNo = urlParams.get('table');
      await apiClient.post(`${API_BASE_URL}/public/withdraw-item-cancel`, {
        orderId: activeOrderData?._id,
        itemId,
        tableNo
      }, {
        headers: { 'X-Tenant-DB': tenant },
        timeout: 8000
      });
      
      setServiceMessage(`✅ Cancellation request withdrawn for ${item.name}`);
      setTimeout(() => setServiceMessage(''), 3000);
    } catch (error) {
      console.error('Error withdrawing cancellation:', error);
      // Revert if error
      setActiveOrderData(prev => {
        if (!prev) return prev;
        const newItems = (prev.items || []).map(i => 
          ((i._id && i._id === itemId) || (i.id && i.id === itemId) || i.name === item.name) 
            ? { ...i, cancellationRequested: true, cancellationRequestedQty: item.cancellationRequestedQty || 1 } 
            : i
        );
        return { ...prev, items: newItems };
      });
      const errMsg = error.response?.data?.message || 'Failed to withdraw cancellation';
      setServiceMessage(`⚠️ ${errMsg}`);
      setTimeout(() => setServiceMessage(''), 4000);
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

  // Primary Location Verification Request (Initial or User Retry)
  const requestLocationVerification = useCallback((overrideSettings = null) => {
    const s = overrideSettings || restaurantSettingsRef.current;
    if (overrideSettings) {
      setRestaurantSettings(overrideSettings);
      restaurantSettingsRef.current = overrideSettings;
    }

    if (!s || !s.enableGeoFencing) {
      console.log("[LOCATION] Geofencing disabled - VERIFIED");
      setLocationState({
        status: LOCATION_STATUS.VERIFIED,
        latitude: null,
        longitude: null,
        accuracy: null,
        distanceMeters: 0,
        allowedRadius: 0,
        restaurantCoords: null,
        errorMessage: null,
        timestamp: Date.now()
      });
      return;
    }

    const restLat = parseFloat(s.latitude);
    const restLng = parseFloat(s.longitude);
    const allowedRadius = parseInt(s.geoFencingRadius, 10) || 50;

    // Validate admin coordinates
    if (isNaN(restLat) || isNaN(restLng) || (restLat === 0 && restLng === 0) || restLat < -90 || restLat > 90 || restLng < -180 || restLng > 180) {
      console.warn("[LOCATION] Invalid Admin coordinates in settings:", { restLat, restLng });
      setLocationState({
        status: LOCATION_STATUS.ERROR,
        latitude: null,
        longitude: null,
        accuracy: null,
        distanceMeters: null,
        allowedRadius,
        restaurantCoords: null,
        errorMessage: t('Restaurant GPS coordinates are not configured properly in Admin Settings. Please ask staff for assistance.'),
        timestamp: Date.now()
      });
      return;
    }

    if (!navigator.geolocation) {
      setLocationState({
        status: LOCATION_STATUS.ERROR,
        latitude: null,
        longitude: null,
        accuracy: null,
        distanceMeters: null,
        allowedRadius,
        restaurantCoords: { latitude: restLat, longitude: restLng },
        errorMessage: t('Geolocation is not supported by your browser. Please use Chrome or Safari.'),
        timestamp: Date.now()
      });
      return;
    }

    const currentReqId = ++requestIdRef.current;
    console.log(`[LOCATION] Request started (Session ID ${currentReqId})`);

    setLocationState(prev => ({
      ...prev,
      status: LOCATION_STATUS.REQUESTING,
      allowedRadius,
      restaurantCoords: { latitude: restLat, longitude: restLng },
      errorMessage: null
    }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current || requestIdRef.current !== currentReqId) return;

        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        const accuracy = position.coords.accuracy != null ? Math.round(position.coords.accuracy) : null;
        const timestamp = position.timestamp || Date.now();
        const rawDistance = calculateDistanceMeters(uLat, uLng, restLat, restLng);

        console.log("[LOCATION] Initial GPS Fix received:", {
          latitude: uLat,
          longitude: uLng,
          accuracy,
          distanceMeters: rawDistance,
          allowedRadius
        });

        if (rawDistance == null) {
          setLocationState({
            status: LOCATION_STATUS.ERROR,
            latitude: uLat,
            longitude: uLng,
            accuracy,
            distanceMeters: null,
            allowedRadius,
            restaurantCoords: { latitude: restLat, longitude: restLng },
            errorMessage: t('Invalid GPS coordinates calculated. Please retry.'),
            timestamp
          });
          return;
        }

        const roundedDist = Math.max(0, Math.round(rawDistance));

        // Accuracy policy: if accuracy > 80m and calculated distance is outside radius, mark as LOW_ACCURACY
        if (accuracy != null && accuracy > 80 && roundedDist > allowedRadius) {
          console.log("[LOCATION] Accuracy is low (>80m):", accuracy);
          setLocationState({
            status: LOCATION_STATUS.LOW_ACCURACY,
            latitude: uLat,
            longitude: uLng,
            accuracy,
            distanceMeters: roundedDist,
            allowedRadius,
            restaurantCoords: { latitude: restLat, longitude: restLng },
            errorMessage: t('GPS accuracy is low. Trying to acquire a more accurate location...'),
            timestamp
          });
          return;
        }

        const isInside = roundedDist <= allowedRadius;

        if (isInside) {
          console.log(`[LOCATION] Status transition: VERIFIED (~${roundedDist}m)`);
          setLocationState({
            status: LOCATION_STATUS.VERIFIED,
            latitude: uLat,
            longitude: uLng,
            accuracy,
            distanceMeters: roundedDist,
            allowedRadius,
            restaurantCoords: { latitude: restLat, longitude: restLng },
            errorMessage: null,
            timestamp
          });
        } else {
          console.log(`[LOCATION] Status transition: OUTSIDE (${roundedDist}m > ${allowedRadius}m)`);
          setLocationState({
            status: LOCATION_STATUS.OUTSIDE,
            latitude: uLat,
            longitude: uLng,
            accuracy,
            distanceMeters: roundedDist,
            allowedRadius,
            restaurantCoords: { latitude: restLat, longitude: restLng },
            errorMessage: t(`You appear to be ${roundedDist}m away from the restaurant. Ordering is restricted to within ${allowedRadius}m.`),
            timestamp
          });
        }
      },
      (err) => {
        if (!isMountedRef.current || requestIdRef.current !== currentReqId) return;
        console.warn("[LOCATION] Geolocation error:", err);

        if (err.code === 1) { // PERMISSION_DENIED
          setLocationState({
            status: LOCATION_STATUS.PERMISSION_DENIED,
            latitude: null,
            longitude: null,
            accuracy: null,
            distanceMeters: null,
            allowedRadius,
            restaurantCoords: { latitude: restLat, longitude: restLng },
            errorMessage: t('Location permission is required to verify you are seated at Table ') + (table || '') + t('. Please allow location access to order.'),
            timestamp: Date.now()
          });
        } else if (err.code === 3) { // TIMEOUT
          setLocationState({
            status: LOCATION_STATUS.TIMEOUT,
            latitude: null,
            longitude: null,
            accuracy: null,
            distanceMeters: null,
            allowedRadius,
            restaurantCoords: { latitude: restLat, longitude: restLng },
            errorMessage: t('Location request timed out. Please tap retry to verify table location.'),
            timestamp: Date.now()
          });
        } else {
          setLocationState({
            status: LOCATION_STATUS.ERROR,
            latitude: null,
            longitude: null,
            accuracy: null,
            distanceMeters: null,
            allowedRadius,
            restaurantCoords: { latitude: restLat, longitude: restLng },
            errorMessage: err.message || t('GPS location unavailable. Please make sure Location / GPS is turned ON in phone settings and try again.'),
            timestamp: Date.now()
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, [table, t]);

  // Exactly ONE Background Location Watcher: Updates coordinates & distance smoothly without unmounting UI
  useEffect(() => {
    const settings = restaurantSettings;
    if (!settings?.enableGeoFencing || !navigator.geolocation) {
      if (watchIdRef.current != null) {
        console.log("[LOCATION] Watch stopped (Geofencing disabled)");
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const restLat = parseFloat(settings.latitude);
    const restLng = parseFloat(settings.longitude);
    const allowedRadius = parseInt(settings.geoFencingRadius, 10) || 50;
    if (isNaN(restLat) || isNaN(restLng) || (restLat === 0 && restLng === 0)) return;

    // Only monitor when in VERIFIED or OUTSIDE states
    if (locationState.status !== LOCATION_STATUS.VERIFIED && locationState.status !== LOCATION_STATUS.OUTSIDE) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // Prevent duplicate watchers
    if (watchIdRef.current != null) return;

    console.log("[LOCATION] Background Watcher started");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null;
        const rawDist = calculateDistanceMeters(uLat, uLng, restLat, restLng);
        if (rawDist == null) return;

        const roundedDist = Math.max(0, Math.round(rawDist));

        // If customer has walked outside restaurant radius
        if (roundedDist > allowedRadius) {
          setLocationState(prev => {
            if (prev.status === LOCATION_STATUS.OUTSIDE && prev.distanceMeters === roundedDist) return prev;
            console.log(`[LOCATION] Background watcher moved OUTSIDE: ${roundedDist}m > ${allowedRadius}m`);
            return {
              ...prev,
              status: LOCATION_STATUS.OUTSIDE,
              latitude: uLat,
              longitude: uLng,
              accuracy,
              distanceMeters: roundedDist,
              allowedRadius,
              restaurantCoords: { latitude: restLat, longitude: restLng },
              errorMessage: t(`You appear to be ${roundedDist}m away from the restaurant. Ordering is restricted to within ${allowedRadius}m.`),
              timestamp: pos.timestamp || Date.now()
            };
          });
        } else {
          // Inside restaurant: update live distance smoothly WITHOUT unmounting or resetting UI
          setLocationState(prev => {
            return {
              ...prev,
              status: LOCATION_STATUS.VERIFIED,
              latitude: uLat,
              longitude: uLng,
              accuracy,
              distanceMeters: roundedDist,
              allowedRadius,
              restaurantCoords: { latitude: restLat, longitude: restLng },
              errorMessage: null,
              timestamp: pos.timestamp || Date.now()
            };
          });
        }
      },
      (watchErr) => {
        console.warn("[LOCATION] Background watcher notice:", watchErr);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000
      }
    );

    return () => {
      if (watchIdRef.current != null) {
        console.log("[LOCATION] Background Watcher cleared");
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [restaurantSettings, locationState.status, t]);

  const hasLoadedInitialOrderRef = useRef(false);

  const checkOrderStatus = useCallback(async (isInitial = false) => {
    if (!table || !tenant) {
      setIsCheckingOrder(false);
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    if (isInitial && !hasLoadedInitialOrderRef.current) {
      setIsCheckingOrder(true);
    }

    try {
      const response = await apiClient.get(
        `${API_BASE_URL}/public/order-status?tableNo=${encodeURIComponent(table)}&tenant=${encodeURIComponent(tenant)}&_t=${Date.now()}`,
        {
          headers: { 
            'X-Tenant-DB': tenant
          },
          timeout: 8000
        }
      );

      if (response.data && response.data.items && Array.isArray(response.data.items)) {
        const validItems = response.data.items.filter(i => !i.isCancelled);
        if (validItems.length > 0) {
          hasLoadedInitialOrderRef.current = true;
          setActiveOrderData(response.data);
          try {
            sessionStorage.setItem(`active_order_${tenant}_${table}`, JSON.stringify(response.data));
            localStorage.setItem(`active_order_${tenant}_${table}`, JSON.stringify(response.data));
          } catch (e) {}
        } else {
          hasLoadedInitialOrderRef.current = true;
          setActiveOrderData(null);
          try {
            sessionStorage.removeItem(`active_order_${tenant}_${table}`);
            localStorage.removeItem(`active_order_${tenant}_${table}`);
          } catch (e) {}
        }
      } else {
        hasLoadedInitialOrderRef.current = true;
        setActiveOrderData(null);
        try {
          sessionStorage.removeItem(`active_order_${tenant}_${table}`);
          localStorage.removeItem(`active_order_${tenant}_${table}`);
        } catch (e) {}
      }
    } catch (err) {
      // If 404, the table is legitimately empty (no open bill)
      if (err.response?.status === 404) {
        hasLoadedInitialOrderRef.current = true;
        setActiveOrderData(null);
        try {
          sessionStorage.removeItem(`active_order_${tenant}_${table}`);
          localStorage.removeItem(`active_order_${tenant}_${table}`);
        } catch (e) {}
      } else {
        console.warn("Table order status notice:", err?.message);
      }
    } finally {
      isCheckingRef.current = false;
      setIsCheckingOrder(false);
      setHasConfirmedTableStatus(true);
    }
  }, [table, tenant]);

  const fetchMenu = useCallback(async (retryAttempt = 0) => {
    if (!tenant || !table) {
      setError("Invalid QR Code. Please scan the QR code on your table again.");
      setLoading(false);
      return;
    }

    try {
      const menuRes = await apiClient.get(`${API_BASE_URL}/public/menu?tenant=${encodeURIComponent(tenant)}`, {
        headers: {
          'X-Tenant-DB': tenant
        },
        timeout: 10000
      });
      if (menuRes.data) {
        setCategories(menuRes.data.categories || []);
        setItems(menuRes.data.items || []);
        if (menuRes.data.googleReviewLink) setGoogleReviewLink(menuRes.data.googleReviewLink);

        // Update cache for subsequent visits
        try {
          sessionStorage.setItem(`customer_menu_${tenant}`, JSON.stringify(menuRes.data));
          localStorage.setItem(`customer_menu_${tenant}`, JSON.stringify(menuRes.data));
        } catch (e) {}

        setLoading(false);

        if (menuRes.data.restaurantSettings) {
          setRestaurantSettings(menuRes.data.restaurantSettings);
          restaurantSettingsRef.current = menuRes.data.restaurantSettings;
          if (menuRes.data.restaurantSettings.enableGeoFencing) {
            requestLocationVerification(menuRes.data.restaurantSettings);
          } else {
            setLocationState({
              status: LOCATION_STATUS.VERIFIED,
              latitude: null,
              longitude: null,
              accuracy: null,
              distanceMeters: 0,
              allowedRadius: 0,
              restaurantCoords: null,
              errorMessage: null,
              timestamp: Date.now()
            });
          }
        }
        return;
      }
    } catch (err) {
      console.warn(`[PublicMenu] Attempt ${retryAttempt + 1} failed:`, err);
      if (retryAttempt < 2) {
        await new Promise(r => setTimeout(r, 1200));
        return fetchMenu(retryAttempt + 1);
      }
      
      setItems(prev => {
        if (prev.length === 0) {
          setError("Could not load the menu. Please ask a staff member for assistance.");
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [tenant, table, requestLocationVerification]);

  useEffect(() => {
    fetchMenu();
    checkOrderStatus(true);

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

      socket.on('kotUpdated', () => checkOrderStatus());
      socket.on('orderUpdated', () => checkOrderStatus());
      socket.on('newKOT', () => checkOrderStatus());
      socket.on('billSettled', (data) => {
        const payMode = data?.order?.paymentMode || data?.bill?.paymentMode || 'Cash';
        const billNum = data?.billNumber || data?.order?.billNumber || '';
        const totalAmt = data?.order?.total || data?.bill?.total || '';
        setServiceMessage(`✅ Payment Completed! Bill ${billNum ? '#' + billNum : ''} of ₹${totalAmt} settled via ${payMode}. Thank you for dining with us! 🎉`);
        setTimeout(() => setServiceMessage(null), 8000);
        checkOrderStatus();
      });
      socket.on('foodReady', () => checkOrderStatus());
      socket.on('prepTimeUpdated', (data) => {
        setServiceMessage(`👨‍🍳 Chef set prep time: ${data.prepTimeMinutes} mins for ${data.itemName || 'your dish'}`);
        setTimeout(() => setServiceMessage(''), 5000);
        checkOrderStatus();
      });
      socket.on('cancellationResolved', (data) => {
        if (data?.action === 'accept') {
          setServiceMessage(`✅ Cancellation Accepted: "${data.itemName || 'Your dish'}" has been cancelled.`);
        } else {
          setServiceMessage(`❌ Cancellation Rejected: "${data.itemName || 'Your dish'}" is already being prepared.`);
        }
        setTimeout(() => setServiceMessage(null), 5000);
        checkOrderStatus();
      });
      socket.on('itemCancellationWithdrawn', () => {
        checkOrderStatus();
      });
    } catch (sockErr) {
      console.warn("Socket connection warning:", sockErr);
    }
    
    // Safety fallback poll every 10 seconds (Sockets handle real-time 0ms updates)
    const interval = setInterval(() => checkOrderStatus(), 10000);
    return () => {
      if (socket) socket.disconnect();
      clearInterval(interval);
    };
  }, [tenant, table, checkOrderStatus, fetchMenu]);

  const addToCart = (item, variant = null, note = '', quantityToAdd = 1) => {
    const qty = Math.max(1, parseInt(quantityToAdd, 10) || 1);
    const variantName = variant ? variant.name : null;
    const itemPrice = variant ? variant.price : item.price;
    const itemName = variant ? `${item.name} - ${variant.name}` : item.name;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (cartItem) =>
          cartItem.menuItem === item._id &&
          cartItem.variant === variantName &&
          (cartItem.specialNote || '') === (note || '')
      );

      if (existingIndex !== -1) {
        const newCart = [...prevCart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + qty
        };
        return newCart;
      } else {
        return [
          ...prevCart,
          {
            menuItem: item._id,
            name: itemName,
            price: itemPrice,
            quantity: qty,
            variant: variantName,
            specialNote: note || ''
          }
        ];
      }
    });
  };

  const handleAddClick = (item) => {
    setSelectedItemForAdd(item);
    setSpecialNote('');
  };

  const updateQuantity = (index, delta) => {
    setCart((prevCart) => {
      const newCart = [...prevCart];
      if (!newCart[index]) return prevCart;
      newCart[index] = {
        ...newCart[index],
        quantity: newCart[index].quantity + delta
      };
      if (newCart[index].quantity <= 0) {
        newCart.splice(index, 1);
      }
      return newCart;
    });
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const smoothScrollToY = (targetY, duration = 400) => {
    const startY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const difference = targetY - startY;
    if (Math.abs(difference) < 4) return;

    const startTime = performance.now();
    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutQuad(progress);
      const newY = startY + difference * ease;

      window.scrollTo(0, newY);
      if (document.documentElement) document.documentElement.scrollTop = newY;
      if (document.body) document.body.scrollTop = newY;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  const scrollToMenuItems = (categoryId = null) => {
    const doScroll = () => {
      let target = null;
      if (categoryId) {
        target = document.getElementById(`category-${categoryId}`);
      }
      if (!target) {
        target = document.getElementById('menu-items-container') || document.querySelector('main > div[id^="category-"]') || document.querySelector('main');
      }
      if (target) {
        const stickyHeader = document.querySelector('.sticky');
        const stickyHeight = stickyHeader ? stickyHeader.offsetHeight : 110;
        const rect = target.getBoundingClientRect();
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        const targetY = Math.max(0, rect.top + currentScroll - stickyHeight - 12);

        smoothScrollToY(targetY, 450);
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {}
      }
    };

    setTimeout(doScroll, 100);
  };

  // Re-verify location whenever customer returns to the browser tab (silent check in background)
  useEffect(() => {
    if (!restaurantSettings?.enableGeoFencing) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const settings = restaurantSettingsRef.current;
        if (settings?.enableGeoFencing && navigator.geolocation) {
          const restLat = parseFloat(settings.latitude);
          const restLng = parseFloat(settings.longitude);
          const allowedRadius = parseInt(settings.geoFencingRadius, 10) || 50;
          if (!isNaN(restLat) && !isNaN(restLng) && restLat !== 0 && restLng !== 0) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (!isMountedRef.current) return;
                const uLat = pos.coords.latitude;
                const uLng = pos.coords.longitude;
                const accuracy = pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null;
                const dist = calculateDistanceMeters(uLat, uLng, restLat, restLng);
                if (dist == null) return;
                const roundedDist = Math.max(0, Math.round(dist));

                if (roundedDist > allowedRadius) {
                  setLocationState(prev => ({
                    ...prev,
                    status: LOCATION_STATUS.OUTSIDE,
                    latitude: uLat,
                    longitude: uLng,
                    accuracy,
                    distanceMeters: roundedDist,
                    allowedRadius,
                    restaurantCoords: { latitude: restLat, longitude: restLng },
                    errorMessage: t(`You appear to be ${roundedDist}m away from the restaurant. Ordering is restricted to within ${allowedRadius}m.`),
                    timestamp: pos.timestamp || Date.now()
                  }));
                } else {
                  setLocationState(prev => ({
                    ...prev,
                    status: LOCATION_STATUS.VERIFIED,
                    latitude: uLat,
                    longitude: uLng,
                    accuracy,
                    distanceMeters: roundedDist,
                    allowedRadius,
                    restaurantCoords: { latitude: restLat, longitude: restLng },
                    errorMessage: null,
                    timestamp: pos.timestamp || Date.now()
                  }));
                }
              },
              () => {},
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
            );
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [restaurantSettings, t]);

  const placeOrder = async () => {
    if (cart.length === 0 || orderStatus === 'placing') return;

    if (restaurantSettings?.enableGeoFencing && locationState.status !== LOCATION_STATUS.VERIFIED) {
      requestLocationVerification();
      setServiceMessage(t('⚠️ Location verification is required to place an order.'));
      setTimeout(() => setServiceMessage(null), 4000);
      return;
    }

    let liveCoords = null;

    // Strict live GPS verification at the exact second of placing order
    if (restaurantSettings?.enableGeoFencing) {
      const restLat = parseFloat(restaurantSettings.latitude);
      const restLng = parseFloat(restaurantSettings.longitude);
      const allowedRadius = parseInt(restaurantSettings.geoFencingRadius, 10) || 50;

      if (!isNaN(restLat) && !isNaN(restLng) && restLat !== 0 && restLng !== 0) {
        setOrderStatus('placing');
        try {
          const freshPos = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 7000,
              maximumAge: 0 // 0ms: Forces 100% fresh live GPS fix (cannot use old location from when scanned)
            });
          });

          const uLat = freshPos.coords.latitude;
          const uLng = freshPos.coords.longitude;
          const accuracy = freshPos.coords.accuracy != null ? Math.round(freshPos.coords.accuracy) : null;
          const rawDistance = calculateDistanceMeters(uLat, uLng, restLat, restLng);

          if (rawDistance != null && rawDistance > allowedRadius) {
            const roundedDist = Math.max(0, Math.round(rawDistance));
            setOrderStatus('menu');
            setLocationState({
              status: LOCATION_STATUS.OUTSIDE,
              latitude: uLat,
              longitude: uLng,
              accuracy,
              distanceMeters: roundedDist,
              allowedRadius,
              restaurantCoords: { latitude: restLat, longitude: restLng },
              errorMessage: t(`You appear to be ${roundedDist}m away from the restaurant. Ordering is strictly blocked outside the restaurant.`),
              timestamp: freshPos.timestamp || Date.now()
            });
            setServiceMessage(`🚫 ${t("Order blocked: You are outside the restaurant area")} (~${roundedDist}m ${t("away")}).`);
            setTimeout(() => setServiceMessage(null), 5000);
            return;
          }

          const roundedDist = rawDistance != null ? Math.max(0, Math.round(rawDistance)) : 0;
          liveCoords = {
            latitude: uLat,
            longitude: uLng,
            accuracy,
            distance: roundedDist
          };

          setLocationState({
            status: LOCATION_STATUS.VERIFIED,
            latitude: uLat,
            longitude: uLng,
            accuracy,
            distanceMeters: roundedDist,
            allowedRadius,
            restaurantCoords: { latitude: restLat, longitude: restLng },
            errorMessage: null,
            timestamp: freshPos.timestamp || Date.now()
          });
        } catch (gpsErr) {
          console.warn("[LOCATION] Live order GPS check fallback:", gpsErr);
          // If fresh position timed out but state is already verified within reasonable time, use last verified coords
          if (locationState.latitude && locationState.longitude) {
            liveCoords = {
              latitude: locationState.latitude,
              longitude: locationState.longitude,
              accuracy: locationState.accuracy,
              distance: locationState.distanceMeters
            };
          } else {
            setOrderStatus('menu');
            requestLocationVerification();
            setServiceMessage(t('⚠️ Live location verification required to place order.'));
            setTimeout(() => setServiceMessage(null), 4000);
            return;
          }
        }
      }
    }

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

      const response = await apiClient.post(`${API_BASE_URL}/public/order`, {
        tableNo: effectiveTableNo,
        items: sanitizedCart,
        subTotal: total,
        taxes: 0,
        total: total,
        tenant: tenant,
        customerLocation: liveCoords ? {
          latitude: liveCoords.latitude,
          longitude: liveCoords.longitude,
          accuracy: liveCoords.accuracy,
          distance: liveCoords.distance
        } : null
      }, {
        headers: {
          'X-Tenant-DB': tenant
        }
      });
      setCart([]);
      setIsCartOpen(false);
      if (response.data && response.data.items) {
        hasLoadedInitialOrderRef.current = true;
        setActiveOrderData(response.data);
      }
      setOrderStatus('success');
      setTimeout(() => setOrderStatus('menu'), 2500);
    } catch (err) {
      console.error("Order placement notice:", err);
      const errorMsg = err.response?.data?.message || (err.message && !err.message.includes('timeout') ? err.message : null) || t("Order could not be placed right now. Please check your connection or ask a staff member.");
      setServiceMessage(`⚠️ ${errorMsg}`);
      setTimeout(() => setServiceMessage(null), 5000);
      setOrderStatus('menu');
    }
  };

  const handleOrderMore = () => {
    // Return to menu mode with active order session retained
    setOrderStatus('menu');
  };

  const handleRequestBill = async () => {
    if (!table) return;
    try {
      await apiClient.post(`${API_BASE_URL}/public/service-request`, {
        tableNumber: table,
        requestType: 'Bill',
        tenant: tenant
      }, {
        headers: { 'X-Tenant-DB': tenant }
      });
      setServiceMessage(`🧾 ${t("Bill requested! Waiter is bringing your bill to Table")} ${table}.`);
      setTimeout(() => setServiceMessage(null), 4000);
    } catch (err) {
      console.error("Bill request failed", err);
      setServiceMessage(`⚠️ ${t("Could not request bill. Please call waiter.")}`);
      setTimeout(() => setServiceMessage(null), 4000);
    }
  };

  const requestService = async (type) => {
    setIsServiceOpen(false);
    try {
      await apiClient.post(`${API_BASE_URL}/public/service-request`, {
        tableNumber: table,
        requestType: type,
        tenant: tenant
      }, {
        headers: { 'X-Tenant-DB': tenant }
      });
      setServiceMessage(`🔔 ${t("Your request for")} "${t(type)}" ${t("was sent to staff!")}`);
      setTimeout(() => setServiceMessage(null), 4000);
    } catch (err) {
      console.error("Service request failed", err);
      setServiceMessage(`⚠️ ${t("Failed to send request. Please try again.")}`);
      setTimeout(() => setServiceMessage(null), 4000);
    }
  };

  // Pre-calculate category visibility, items, and search relevance sorting (Hook must be called before any early return)
  const visibleCategoriesData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    // Helper to score item match relevance
    const getRelevanceScore = (item) => {
      if (!query) return 0;
      const name = (item.name || '').toLowerCase().trim();
      const desc = (item.description || '').toLowerCase();
      
      if (name === query) return 100; // Exact full match
      if (name.startsWith(query)) return 85; // Starts with query
      
      // Word boundary match in item name (e.g. "Chicken Biryani" matching "Biryani")
      const words = name.split(/\s+/);
      if (words.some(w => w === query)) return 75;
      if (words.some(w => w.startsWith(query))) return 65;
      
      if (name.includes(query)) return 50; // Substring in name
      if (desc.includes(query)) return 25; // Substring in description
      
      if (item.variants && item.variants.some(v => (v.name || '').toLowerCase().includes(query))) {
        return 20;
      }
      return 0;
    };

    return categories.map(category => {
      let categoryItems = items.filter((item) =>
        (item.category?._id || item.category) === category._id ||
        (item.category?.name || item.category) === category.name
      );

      if (dietaryFilter === 'veg') {
        categoryItems = categoryItems.filter(item => item.type === 'veg');
      } else if (dietaryFilter === 'non-veg') {
        categoryItems = categoryItems.filter(item => item.type !== 'veg');
      } else if (dietaryFilter === 'bestseller') {
        categoryItems = categoryItems.filter(item => item.isFavorite);
      }

      if (query !== '') {
        categoryItems = categoryItems
          .map(item => ({ item, score: getRelevanceScore(item) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ item }) => item);
      }
      
      return { 
        ...category, 
        filteredItems: categoryItems,
        maxScore: categoryItems.length > 0 && query !== '' ? Math.max(...categoryItems.map(i => getRelevanceScore(i))) : 0
      };
    })
    .filter(c => c.filteredItems.length > 0)
    .sort((a, b) => {
      if (query !== '') {
        // Categories containing higher scoring matches appear at the top!
        return (b.maxScore || 0) - (a.maxScore || 0);
      }
      return 0;
    });
  }, [categories, items, dietaryFilter, searchQuery]);

  // Strict Location Access Screens (Clean Light Digital Menu Theme)
  // IMPORTANT: When locationState.status is VERIFIED, the digital menu remains mounted with ZERO flashing!
  if (restaurantSettings?.enableGeoFencing && locationState.status !== LOCATION_STATUS.VERIFIED) {
    if (locationState.status === LOCATION_STATUS.INITIALIZING || locationState.status === LOCATION_STATUS.REQUESTING || locationState.status === LOCATION_STATUS.LOW_ACCURACY) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 font-sans relative overflow-hidden">
          {/* Subtle warm decorative background blurs */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-orange-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-sm w-full bg-white border border-slate-200/80 p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col items-center text-center">
            {/* Orange Radar Icon */}
            <div className="w-18 h-18 rounded-2xl bg-orange-50 text-orange-600 border border-orange-200/80 flex items-center justify-center mb-4 shadow-xs">
              <Radio size={36} className="animate-spin text-orange-600" style={{ animationDuration: '4s' }} />
            </div>

            <span className="text-[11px] uppercase tracking-widest text-orange-600 font-extrabold bg-orange-50 px-3 py-1 rounded-full mb-2 border border-orange-200">
              {restaurantSettings?.restaurantName || t("Restaurant Security")}
            </span>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{t("Verify Table Location")}</h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              {t("Please tap below to allow GPS location access and verify you are seated at")}{" "}
              <strong className="text-orange-600 font-bold">{table}</strong>.
            </p>

            {/* Target Table & Security Info Card */}
            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-5 flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 font-bold">
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">{t("Target Table")}</div>
                  <div className="text-xs sm:text-sm font-black text-slate-800">{table}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">{t("Allowed Radius")}</div>
                <div className="text-xs font-bold text-orange-600">{locationState.allowedRadius || 50}m {t("(Strict)")}</div>
              </div>
            </div>

            {/* Low Accuracy Notice */}
            {locationState.status === LOCATION_STATUS.LOW_ACCURACY && (
              <div className="w-full mb-4 px-3.5 py-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs font-semibold text-amber-800">
                {locationState.errorMessage || t("GPS accuracy is low. Trying to acquire a more accurate location...")}
                {locationState.accuracy && <span className="block text-[10px] text-amber-600 mt-0.5">±{Math.round(locationState.accuracy)}m {t("accuracy")}</span>}
              </div>
            )}

            {/* Live Distance Detected Display */}
            {locationState.distanceMeters != null && (
              <div className="w-full mb-4 px-3.5 py-2.5 bg-orange-50/80 rounded-xl border border-orange-200 text-xs font-bold text-orange-700 flex items-center justify-center gap-1.5">
                <LocateFixed size={14} className="text-orange-600" />
                <span>{t("Detected Distance:")} {Math.max(0, Math.round(locationState.distanceMeters))}m {t("from restaurant")}</span>
              </div>
            )}

            {/* Direct Allow Button */}
            <button
              type="button"
              onClick={() => requestLocationVerification(restaurantSettings)}
              className="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer mb-3"
            >
              {locationState.status === LOCATION_STATUS.REQUESTING ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{t("Checking GPS Location...")}</span>
                </>
              ) : (
                <>
                  <LocateFixed size={18} />
                  <span>{t("Allow & Verify Location Access")}</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>{t("Encrypted GPS Table Verification")}</span>
            </div>
          </div>
        </div>
      );
    }

    if (locationState.status === LOCATION_STATUS.PERMISSION_DENIED) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 font-sans">
          <div className="max-w-md w-full bg-white border border-red-200 p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col items-center text-center">
            <div className="w-18 h-18 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mb-4">
              <ShieldAlert size={36} />
            </div>

            <span className="text-[11px] uppercase tracking-widest text-red-600 font-extrabold bg-red-50 px-3 py-1 rounded-full mb-2 border border-red-200">
              {t("Permission Required")}
            </span>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{t("Location Access Denied")}</h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              {restaurantSettings?.restaurantName || t("This restaurant")} {t("requires GPS location permission to verify you are physically seated at")}{" "}
              <strong className="text-orange-600 font-bold">{table}</strong> {t("before ordering.")}
            </p>

            {/* Step-by-step guide in clean light theme */}
            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left mb-6 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Lock size={12} className="text-orange-600" />
                <span>{t("How to enable location in browser:")}</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <span>{t("Tap the lock 🔒 or site settings icon in your browser's address bar.")}</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <span>{t("Change")} <strong className="text-slate-800">"{t("Location")}"</strong> {t("permission from Blocked to")} <strong className="text-green-600">"{t("Allow")}"</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                <span>{t("Tap the button below to re-check location.")}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => requestLocationVerification(restaurantSettings)}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LocateFixed size={18} />
              <span>{t("Allow Location & Retry")}</span>
            </button>
          </div>
        </div>
      );
    }

    if (locationState.status === LOCATION_STATUS.OUTSIDE) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 font-sans">
          <div className="max-w-md w-full bg-white border border-amber-200 p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col items-center text-center">
            <div className="w-18 h-18 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-4">
              <Compass size={36} />
            </div>

            <span className="text-[11px] uppercase tracking-widest text-amber-700 font-extrabold bg-amber-50 px-3 py-1 rounded-full mb-2 border border-amber-200">
              {t("Geo-Fence Restricted")}
            </span>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{t("Outside Restaurant Area")}</h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              {t("You appear to be away from")}{" "}
              <strong className="text-slate-800 font-bold">{restaurantSettings?.restaurantName || t("the restaurant")}</strong>.{" "}
              {t("Ordering is strictly restricted to customers physically seated at")}{" "}
              <strong className="text-orange-600 font-bold">{table}</strong>.
            </p>

            {/* Dynamic Distance Comparison Card in clean light theme */}
            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-6 grid grid-cols-2 gap-3 text-left">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">{t("Your Distance")}</div>
                <div className="text-base sm:text-lg font-black text-red-600 mt-0.5">
                  {locationState.distanceMeters != null ? `${Math.max(0, Math.round(locationState.distanceMeters))}m` : t("Far")}
                </div>
                {locationState.accuracy != null && (
                  <div className="text-[9px] text-slate-400 font-mono">
                    ±{Math.round(locationState.accuracy)}m {t("accuracy")}
                  </div>
                )}
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">{t("Allowed Radius")}</div>
                <div className="text-base sm:text-lg font-black text-green-600 mt-0.5">
                  {locationState.allowedRadius}m
                </div>
                <div className="text-[9px] text-slate-400">
                  {t("Strict Security")}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={() => requestLocationVerification(restaurantSettings)}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={18} />
                <span>{t("Re-check My Location")}</span>
              </button>

              {locationState.restaurantCoords?.latitude && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${locationState.restaurantCoords.latitude},${locationState.restaurantCoords.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={14} />
                  <span>{t("View Restaurant on Google Maps")}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (locationState.status === LOCATION_STATUS.ERROR || locationState.status === LOCATION_STATUS.TIMEOUT) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 font-sans">
          <div className="max-w-md w-full bg-white border border-amber-200 p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col items-center text-center">
            <div className="w-18 h-18 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-4">
              <AlertTriangle size={36} />
            </div>

            <span className="text-[11px] uppercase tracking-widest text-amber-700 font-extrabold bg-amber-50 px-3 py-1 rounded-full mb-2 border border-amber-200">
              {locationState.status === LOCATION_STATUS.TIMEOUT ? t("Location Timeout") : t("Location Error")}
            </span>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{t("Could Not Verify Location")}</h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
              {locationState.errorMessage || t("Please ensure your device GPS / Location is turned ON in phone settings and try again.")}
            </p>

            <button
              type="button"
              onClick={() => requestLocationVerification(restaurantSettings)}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={18} />
              <span>{t("Retry GPS Check")}</span>
            </button>
          </div>
        </div>
      );
    }
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

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-orange-500 text-white p-6 rounded-b-[2rem] shadow-lg relative z-30 flex flex-col items-center">
        {/* Top-Left Bell Service Call Button in Header */}
        <div className="absolute top-4 left-4 z-50">
          <button 
            type="button"
            onClick={() => setIsServiceOpen(!isServiceOpen)}
            className="w-10 h-10 rounded-full bg-white text-orange-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer relative"
            title={t("Call Waiter / Service")}
          >
            <Bell size={20} className="animate-bounce" style={{ animationDuration: '2s' }} />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          </button>
          
          <AnimatePresence>
            {isServiceOpen && (
              <>
                {/* Full-screen backdrop to close */}
                <div
                  className="fixed inset-0 z-40 bg-black/20"
                  onClick={() => setIsServiceOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden min-w-[190px] flex flex-col z-50 text-slate-800"
                >
                  <button 
                    type="button"
                    onClick={() => requestService('Call Waiter')} 
                    className="p-3.5 flex items-center gap-3 hover:bg-orange-50 text-slate-700 font-bold border-b border-slate-100 transition-colors text-left text-xs cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><Bell size={14} /></div>
                    <span>{t("Call Waiter")}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => requestService('Need Water')} 
                    className="p-3.5 flex items-center gap-3 hover:bg-blue-50 text-slate-700 font-bold border-b border-slate-100 transition-colors text-left text-xs cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><Droplets size={14} /></div>
                    <span>{t("Need Water")}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => requestService('Pay the Bill')} 
                    className="p-3.5 flex items-center gap-3 hover:bg-green-50 text-slate-700 font-bold transition-colors text-left text-xs cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0"><CreditCard size={14} /></div>
                    <span>{t("Pay the Bill")}</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Top-Right Language Switcher */}
        <div className="absolute top-4 right-4 z-50">
          <button 
            type="button"
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm transition-colors flex items-center gap-1 cursor-pointer"
          >
            {languages.find(l => l.code === language)?.native || 'English'}
          </button>
          
          <AnimatePresence>
            {isLangDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-w-[140px] flex flex-col z-50 text-slate-800"
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors border-b last:border-0 border-slate-100 cursor-pointer ${language === lang.code ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'}`}
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
          <span className="font-bold text-sm">
            {t("You are at")} {table ? (table.includes(' - ') ? table.split(' - ').slice(1).join(' - ') : table) : ''}
            {table && table.includes(' - ') ? ` (${table.split(' - ')[0]})` : ''}
          </span>
        </div>

        {/* Dynamic Location Verified Badge */}
        {restaurantSettings?.enableGeoFencing && locationState.status === LOCATION_STATUS.VERIFIED && (
          <div className="flex items-center gap-1.5 bg-emerald-600/30 border border-emerald-400/40 text-emerald-100 text-[11px] font-bold px-3 py-1 rounded-full mt-2 backdrop-blur-sm shadow-xs animate-fade-in">
            <ShieldCheck size={13} className="text-emerald-300" />
            <span>
              {t("Location Verified • Seated at Table")} {locationState.distanceMeters != null ? `(~${Math.max(0, Math.round(locationState.distanceMeters))}m)` : ''}
            </span>
            {locationState.accuracy != null && locationState.accuracy > 0 && (
              <span className="text-[9px] opacity-80 border-l border-emerald-400/40 pl-1.5 ml-0.5 font-mono">
                ±{Math.round(locationState.accuracy)}m
              </span>
            )}
          </div>
        )}
      </header>

      {/* Search and Filters */}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md px-3 sm:px-4 py-3 shadow-sm border-b border-slate-200">
        <div className="flex flex-col gap-2.5 max-w-3xl mx-auto">
          {/* Search Row with Top-Left Filter Dropdown */}
          <div className="flex items-center gap-2">
            {/* Top-Left Filter Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(prev => !prev)}
                className={`h-10 px-3.5 rounded-2xl text-xs font-black flex items-center gap-1.5 border shadow-xs transition-all active:scale-95 cursor-pointer ${
                  dietaryFilter === 'veg'
                    ? 'bg-green-600 text-white border-green-500 shadow-green-500/20'
                    : dietaryFilter === 'non-veg'
                    ? 'bg-red-500 text-white border-red-400 shadow-red-500/20'
                    : dietaryFilter === 'bestseller'
                    ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <SlidersHorizontal size={14} className={dietaryFilter !== 'all' ? 'text-white' : 'text-orange-500'} />
                <span className="truncate max-w-[75px] sm:max-w-none">
                  {dietaryFilter === 'veg' ? t("Veg") :
                   dietaryFilter === 'non-veg' ? t("Non-Veg") :
                   dietaryFilter === 'bestseller' ? t("Bestseller") :
                   t("Filter")}
                </span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isFilterDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsFilterDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.95 }}
                      className="absolute left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-1.5 min-w-[170px] z-50 flex flex-col gap-1"
                    >
                      <button
                        type="button"
                        onClick={() => { setDietaryFilter('all'); setIsFilterDropdownOpen(false); scrollToMenuItems(); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${dietaryFilter === 'all' ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>🍽️</span>
                          <span>{t("All Items")}</span>
                        </div>
                        {dietaryFilter === 'all' && <Check size={14} className="text-orange-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setDietaryFilter('veg'); setIsFilterDropdownOpen(false); scrollToMenuItems(); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${dietaryFilter === 'veg' ? 'bg-green-50 text-green-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
                          <span>{t("Pure Veg")}</span>
                        </div>
                        {dietaryFilter === 'veg' && <Check size={14} className="text-green-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setDietaryFilter('non-veg'); setIsFilterDropdownOpen(false); scrollToMenuItems(); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${dietaryFilter === 'non-veg' ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                          <span>{t("Non-Veg")}</span>
                        </div>
                        {dietaryFilter === 'non-veg' && <Check size={14} className="text-red-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setDietaryFilter('bestseller'); setIsFilterDropdownOpen(false); scrollToMenuItems(); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${dietaryFilter === 'bestseller' ? 'bg-amber-50 text-amber-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>🔥</span>
                          <span>{t("Bestsellers")}</span>
                        </div>
                        {dietaryFilter === 'bestseller' && <Check size={14} className="text-amber-600" />}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Search Bar Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                placeholder={t("Search dishes, biryani, drinks...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 bg-white border border-slate-200 rounded-2xl py-2 pl-10 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-xs transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
          
          {/* Category Quick-Jump */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-slate-100 pt-2 mt-1">
            {(loading || (items.length === 0 && !error)) ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div key={`cat-skel-${i}`} className="h-7 w-20 rounded-xl bg-orange-100/70 animate-pulse shrink-0 border border-orange-100" />
              ))
            ) : (
              visibleCategoriesData.map((category) => (
                <button
                  key={`nav-${category._id}`}
                  onClick={() => scrollToMenuItems(category._id)}
                  className="px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold whitespace-nowrap border border-orange-100 transition-colors hover:bg-orange-100 active:bg-orange-200 cursor-pointer"
                >
                  {(language !== 'en' && category.nameTranslations?.[language]) || t(category.name)}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── ORDER LOADING SPINNER SKELETON ── shown while checking table order */}
      {isCheckingOrder && !activeOrderData && (
        <div className="px-2 sm:px-4 pt-3 pb-1 max-w-3xl mx-auto">
          <div className="bg-white/90 border border-orange-200/90 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <RefreshCw className="animate-spin" size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black text-slate-800">{t("Checking active table order...")}</p>
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping inline-block"></span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">{t("Checking current items for")} {table}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── YOUR CURRENT ORDER SECTION ── shown when table has an active bill (hidden during active search for top viewport focus) */}
      {activeOrderData && activeOrderData.items && activeOrderData.items.filter(i => !i.isCancelled).length > 0 && !searchQuery.trim() && (
        <div className="px-2 sm:px-4 pt-3 pb-2 w-full max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-md border border-orange-100 overflow-hidden">
            {/* Section header */}
            <div className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 ${
              activeOrderData.status === 'Paid' ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
              activeOrderData.status === 'Billed' ? 'bg-gradient-to-r from-purple-500 to-violet-500' :
              'bg-orange-500'
            }`}>
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                {activeOrderData.status === 'Paid' ? <BadgeCheck size={17} className="text-white shrink-0" /> :
                 activeOrderData.status === 'Billed' ? <Receipt size={17} className="text-white shrink-0" /> :
                 <ChefHat size={17} className="text-white shrink-0" />}
                <span className="font-black text-xs sm:text-sm text-white whitespace-nowrap">
                  {activeOrderData.status === 'Paid' ? t('Payment Completed') :
                   activeOrderData.status === 'Billed' ? t('Bill Generated') :
                   t('Your Current Order')}
                </span>
                <span className="bg-white/20 text-white text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                  {activeOrderData.items.filter(i => !i.isCancelled).length} {t("items")}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black shrink-0 whitespace-nowrap ${
                activeOrderData.status === 'Paid'
                  ? 'bg-white text-emerald-700'
                  : activeOrderData.status === 'Billed'
                  ? 'bg-white/90 text-purple-700'
                  : activeOrderData.kitchenStatus === 'Ready'
                  ? 'bg-emerald-100 text-emerald-800'
                  : activeOrderData.kitchenStatus === 'Preparing'
                  ? 'bg-amber-100 text-amber-800'
                  : activeOrderData.kitchenStatus === 'Completed'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${
                  activeOrderData.status === 'Paid' ? 'bg-emerald-500' :
                  activeOrderData.status === 'Billed' ? 'bg-purple-500' :
                  activeOrderData.kitchenStatus === 'Ready' ? 'bg-emerald-500' :
                  activeOrderData.kitchenStatus === 'Preparing' ? 'bg-amber-500' :
                  activeOrderData.kitchenStatus === 'Completed' ? 'bg-purple-500' : 'bg-blue-500'
                } ${activeOrderData.status === 'Paid' ? '' : 'animate-pulse'} inline-block`}></span>
                <span className="whitespace-nowrap">
                  {activeOrderData.status === 'Paid' ? `✓ ${t('Paid')}${activeOrderData.paymentMode ? ` · ${activeOrderData.paymentMode}` : ''}` :
                   activeOrderData.status === 'Billed' ? `${t('Bill Generated')}${activeOrderData.billNumber ? ` #${activeOrderData.billNumber}` : ''}` :
                   activeOrderData.kitchenStatus === 'Ready' ? t('Prepared & Ready') :
                   activeOrderData.kitchenStatus === 'Preparing' ? t('Preparing') :
                   activeOrderData.kitchenStatus === 'Completed' ? t('Bill Generated') : t('Received')}
                </span>
              </div>
            </div>

            {/* ── ORDER PROGRESS STEPPER ── Color-coded lifecycle tracker */}
            {(() => {
              const billStatus = activeOrderData.status;
              const kStatus = activeOrderData.kitchenStatus;
              
              // Determine which step is active (0-indexed)
              let activeStep = 0;
              if (billStatus === 'Paid') activeStep = 4;
              else if (billStatus === 'Billed') activeStep = 3;
              else if (kStatus === 'Ready') activeStep = 2;
              else if (kStatus === 'Preparing') activeStep = 1;
              else activeStep = 0;

              const steps = [
                { label: t('Ordered'), icon: '📋', color: 'blue' },
                { label: t('Preparing'), icon: '👨‍🍳', color: 'amber' },
                { label: t('Ready'), icon: '✅', color: 'emerald' },
                { label: t('Billed'), icon: '🧾', color: 'purple' },
                { label: t('Paid'), icon: '💳', color: 'green' },
              ];

              const colorMap = {
                blue:    { bg: 'bg-blue-500',    ring: 'ring-blue-200',    line: 'bg-blue-400',    text: 'text-blue-700' },
                amber:   { bg: 'bg-amber-500',   ring: 'ring-amber-200',   line: 'bg-amber-400',   text: 'text-amber-700' },
                emerald: { bg: 'bg-emerald-500',  ring: 'ring-emerald-200', line: 'bg-emerald-400', text: 'text-emerald-700' },
                purple:  { bg: 'bg-purple-500',   ring: 'ring-purple-200',  line: 'bg-purple-400',  text: 'text-purple-700' },
                green:   { bg: 'bg-green-500',    ring: 'ring-green-200',   line: 'bg-green-400',   text: 'text-green-700' },
              };

              return (
                <div className="px-3 sm:px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                  <div className="flex items-center justify-between relative">
                    {steps.map((step, idx) => {
                      const isComplete = idx < activeStep;
                      const isCurrent = idx === activeStep;
                      const isPending = idx > activeStep;
                      const c = colorMap[step.color];

                      return (
                        <React.Fragment key={idx}>
                          <div className="flex flex-col items-center z-10" style={{ minWidth: '36px' }}>
                            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 ${
                              isComplete
                                ? `${c.bg} text-white shadow-sm`
                                : isCurrent
                                ? `${c.bg} text-white ring-4 ${c.ring} shadow-md animate-pulse`
                                : 'bg-slate-200 text-slate-400'
                            }`}>
                              {isComplete ? <Check size={13} strokeWidth={3} /> : <span className="text-[11px]">{step.icon}</span>}
                            </div>
                            <span className={`text-[8px] sm:text-[9px] font-bold mt-1 text-center leading-tight whitespace-nowrap ${
                              isComplete || isCurrent ? c.text : 'text-slate-400'
                            }`}>
                              {step.label}
                            </span>
                          </div>
                          {idx < steps.length - 1 && (
                            <div className="flex-1 h-0.5 mx-0.5 sm:mx-1 rounded-full overflow-hidden bg-slate-200 relative" style={{ marginTop: '-10px' }}>
                              <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                  idx < activeStep ? colorMap[steps[idx + 1].color].line : 'bg-transparent'
                                }`}
                                style={{ width: idx < activeStep ? '100%' : isCurrent ? '0%' : '0%' }}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── PAYMENT INFO BANNER ── Shown when Billed or Paid */}
            {activeOrderData.status === 'Paid' && (
              <div className="mx-3 sm:mx-4 mt-2.5 mb-1 rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 px-3.5 py-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <BadgeCheck size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-emerald-800">{t('Payment Settled Successfully')} 🎉</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      {activeOrderData.billNumber && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <Receipt size={10} /> Bill #{activeOrderData.billNumber}
                        </span>
                      )}
                      {activeOrderData.paymentMode && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <Wallet size={10} /> {activeOrderData.paymentMode === 'Mixed' ? t('Split Payment') : activeOrderData.paymentMode}
                          {activeOrderData.paymentMode === 'UPI' && activeOrderData.upiApp ? ` (${activeOrderData.upiApp})` : ''}
                        </span>
                      )}
                      <span className="text-[10px] font-black text-emerald-700 flex items-center gap-1">
                        ₹{activeOrderData.total}
                      </span>
                      {activeOrderData.paymentMode === 'Mixed' && activeOrderData.splitPayments && (
                        <span className="text-[10px] text-emerald-500 font-semibold">
                          ({activeOrderData.splitPayments.cash ? `Cash ₹${activeOrderData.splitPayments.cash}` : ''}
                          {activeOrderData.splitPayments.upi ? `${activeOrderData.splitPayments.cash ? ' + ' : ''}UPI ₹${activeOrderData.splitPayments.upi}` : ''}
                          {activeOrderData.splitPayments.card ? `${(activeOrderData.splitPayments.cash || activeOrderData.splitPayments.upi) ? ' + ' : ''}Card ₹${activeOrderData.splitPayments.card}` : ''})
                        </span>
                      )}
                    </div>
                    {activeOrderData.discount > 0 && (
                      <p className="text-[10px] text-emerald-500 mt-1 font-semibold">
                        🏷️ {t('Discount Applied')}: ₹{activeOrderData.discount}
                        {activeOrderData.discountType === 'percentage' ? ` (${activeOrderData.discountValue}%)` : ''}
                        {activeOrderData.discountType === 'complimentary' ? ` (${t('Complimentary')})` : ''}
                      </p>
                    )}
                    <p className="text-[10px] text-emerald-500 mt-1 font-semibold">{t('Thank you for dining with us!')} 🙏</p>
                  </div>
                </div>
              </div>
            )}
            {activeOrderData.status === 'Billed' && (
              <div className="mx-3 sm:mx-4 mt-2.5 mb-1 rounded-2xl bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 px-3.5 py-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Receipt size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-purple-800">{t('Your Bill Has Been Generated')}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      {activeOrderData.billNumber && (
                        <span className="text-[10px] font-bold text-purple-600 flex items-center gap-1">
                          <Receipt size={10} /> Bill #{activeOrderData.billNumber}
                        </span>
                      )}
                      <span className="text-[10px] font-black text-purple-700">₹{activeOrderData.total}</span>
                    </div>
                    <p className="text-[10px] text-purple-500 mt-1 font-semibold">
                      💳 {t('Please settle at the counter or request your waiter.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Items list */}
            <div className="divide-y divide-slate-100">
              {activeOrderData.items.filter(i => !i.isCancelled).map((item, idx) => {
                const effectiveQty = item.quantity - (item.cancelledQuantity || 0);
                const itemTotal = item.price * effectiveQty;
                const isPrepared = item.kdsStatus === 'Ready' || item.status === 'Ready' || item.kdsStatus === 'Prepared';
                const isPreparing = item.kdsStatus === 'Preparing' || item.status === 'Preparing';

                return (
                  <div key={item._id || idx} className="px-3 sm:px-5 py-2.5">
                    {/* Top row: Qty badge + Item name + Price */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-50 text-orange-600 text-xs sm:text-sm font-black flex items-center justify-center shrink-0 mt-0.5">
                          {effectiveQty}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5 whitespace-nowrap">
                              🕒 {format12HourTime(item.orderedAt || item.createdAt || item.time || activeOrderData.createdAt)}
                            </span>
                            {item.specialNote && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">📝 {item.specialNote}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-black text-orange-600 shrink-0 whitespace-nowrap mt-0.5">₹{itemTotal}</span>
                    </div>
                    {/* Bottom row: Status badges */}
                    <div className="flex items-center gap-1.5 mt-1.5 ml-8 sm:ml-9 flex-wrap">
                      {(() => {
                        const rawEffective = parseInt(effectiveQty || 0, 10) || 0;
                        const safeEffectiveQty = Math.max(0, rawEffective);
                        const unitStatuses = Array.isArray(item.unitStatuses) && item.unitStatuses.length === safeEffectiveQty && safeEffectiveQty > 0
                          ? item.unitStatuses
                          : Array.from({ length: safeEffectiveQty }, () => item.kdsStatus || item.status || 'Pending');

                        const preparedCount = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
                        const preparingCount = unitStatuses.filter(s => s === 'Preparing').length;
                        const pendingCount = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

                        const hasMixedStatus = safeEffectiveQty > 1 && (
                          (preparedCount > 0 && (preparingCount > 0 || pendingCount > 0)) ||
                          (preparingCount > 0 && pendingCount > 0)
                        );

                        if (item.cancellationRequested) {
                          return (
                            <>
                              <span className="text-[9px] sm:text-[10px] bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">Cancel Pending</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleWithdrawItemCancel(item); }}
                                className="text-[9px] sm:text-[10px] bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black px-2.5 py-0.5 rounded-full flex items-center gap-0.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                                title={t("Withdraw Cancel Request")}
                              >
                                ↩️ {t("Withdraw")}
                              </button>
                            </>
                          );
                        }

                        if (item.cancellationRejected) {
                          return (
                            <>
                              <span className="text-[9px] sm:text-[10px] bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                                ✕ {t("Cancel Rejected")}
                              </span>
                              {isPrepared ? (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-2xs whitespace-nowrap">
                                  <Check size={10} strokeWidth={3} className="text-emerald-600 shrink-0" />
                                  <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}{t("Prepared")}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap">
                                  <Loader2 size={10} className="animate-spin text-amber-600 shrink-0" />
                                  <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}👨‍🍳 {t("Preparing")}</span>
                                </span>
                              )}
                            </>
                          );
                        }

                        if (hasMixedStatus) {
                          return (
                            <>
                              {preparedCount > 0 && (
                                <span className="text-[9px] sm:text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 sm:px-2 py-0.5 rounded-full font-black flex items-center gap-0.5 sm:gap-1 shadow-2xs whitespace-nowrap">
                                  <Check size={9} strokeWidth={3} className="text-emerald-600 shrink-0" />
                                  <span>{preparedCount}x {t("Prepared")}</span>
                                </span>
                              )}
                              {preparingCount > 0 && (
                                <span className="text-[9px] sm:text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 sm:gap-1 shadow-2xs whitespace-nowrap">
                                  <Loader2 size={9} className="animate-spin text-amber-600 shrink-0" />
                                  <span>{preparingCount}x 👨‍🍳 {t("Preparing")}</span>
                                </span>
                              )}
                              {pendingCount > 0 && (
                                <span className="text-[9px] sm:text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 sm:gap-1 shadow-2xs whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                                  <span>{pendingCount}x ⏳ {t("Pending")}</span>
                                </span>
                              )}
                            </>
                          );
                        }

                        if (isPrepared) {
                          return (
                            <span className="text-[9px] sm:text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-2xs whitespace-nowrap">
                              <Check size={10} strokeWidth={3} className="text-emerald-600 shrink-0" />
                              <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}{t("Prepared")}</span>
                            </span>
                          );
                        }

                        if (isPreparing) {
                          return (
                            <span className="text-[9px] sm:text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap">
                              <Loader2 size={10} className="animate-spin text-amber-600 shrink-0" />
                              <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}👨‍🍳 {t("Preparing")}</span>
                            </span>
                          );
                        }

                        return (
                          <>
                            <span className="text-[9px] sm:text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                              <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}⏳ {t("Pending")}</span>
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRequestItemCancel(item); }}
                              className="text-[9px] sm:text-[10px] font-bold bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 px-2 py-0.5 rounded-full transition-all cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap"
                              title={t("Cancel Item")}
                            >
                              {t("Cancel")}
                            </button>
                          </>
                        );
                      })()}
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
                  <span>₹{activeOrderData.subtotal !== undefined ? activeOrderData.subtotal : (activeOrderData.subTotal || activeOrderData.total)}</span>
                </div>
                {activeOrderData.taxBreakdown?.cgst > 0 && (
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{t("CGST")} ({((activeOrderData.tax || 5) / 2).toFixed(1)}%)</span>
                    <span>₹{activeOrderData.taxBreakdown.cgst}</span>
                  </div>
                )}
                {activeOrderData.taxBreakdown?.sgst > 0 && (
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{t("SGST")} ({((activeOrderData.tax || 5) / 2).toFixed(1)}%)</span>
                    <span>₹{activeOrderData.taxBreakdown.sgst}</span>
                  </div>
                )}
                {(!activeOrderData.taxBreakdown || (!activeOrderData.taxBreakdown.cgst && !activeOrderData.taxBreakdown.sgst)) && activeOrderData.tax > 0 && (
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
            <div className="bg-slate-50 px-3.5 sm:px-5 py-3 flex items-center justify-between border-t border-slate-100">
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
                  className="bg-orange-500 text-white text-[11px] font-black px-3.5 py-1.5 rounded-xl hover:bg-orange-600 active:scale-95 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  {t("Details")} {isDetailsExpanded ? '▲' : '→'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Categories & Items */}
      <main id="menu-items-container" style={{ scrollMarginTop: '135px' }} className="p-2 sm:p-4 space-y-8 mt-2 max-w-3xl mx-auto scroll-mt-36">
        {(loading || (items.length === 0 && !error)) ? (
          /* ── DYNAMIC ANIMATED MENU LOADING SKELETON ── */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Attractive Chef Loading Banner with Floating Emojis */}
            <div className="relative overflow-hidden bg-gradient-to-r from-orange-500/10 via-amber-500/15 to-orange-500/10 border border-orange-200/80 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                  <motion.div
                    animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  >
                    <ChefHat size={24} />
                  </motion.div>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800 tracking-tight">
                      {loadingTips[loadingTipIndex]?.title || t("Crafting Your Menu Experience")}
                    </h3>
                    <span className="text-xs animate-bounce">✨</span>
                  </div>
                  <p className="text-xs text-orange-600 font-bold mt-0.5 animate-pulse">
                    {loadingTips[loadingTipIndex]?.subtitle || t("Fetching fresh dishes, seasonal specials & prices...")}
                  </p>
                </div>
              </div>

              {/* Shimmer glowing progress bar */}
              <div className="mt-3.5 w-full bg-orange-100/80 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 rounded-full"
                  initial={{ x: "-100%" }}
                  animate={{ x: "120%" }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                  style={{ width: "50%" }}
                />
              </div>

              {/* Floating food icons */}
              <div className="flex justify-around mt-3 pt-2.5 border-t border-orange-200/50 text-base">
                {['🍕', '🍔', '🥗', '🍜', '🍹', '🥘', '🍨'].map((emoji, idx) => (
                  <motion.span
                    key={idx}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: idx * 0.18, ease: "easeInOut" }}
                    className="cursor-default select-none"
                  >
                    {emoji}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* Section Header Shimmer */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="h-6 w-36 bg-slate-200/80 rounded-lg animate-pulse"></div>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              {/* Grid of Dish Card Skeletons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={`dish-skel-${i}`}
                    className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 flex gap-4 relative overflow-hidden"
                  >
                    {/* Image Skeleton with pulse icon */}
                    <div className="w-24 h-24 rounded-xl bg-gradient-to-tr from-slate-100 to-orange-50/60 flex items-center justify-center text-slate-300 shrink-0 relative overflow-hidden border border-slate-100">
                      <motion.div
                        animate={{ scale: [0.95, 1.05, 0.95] }}
                        transition={{ repeat: Infinity, duration: 1.8, delay: i * 0.15 }}
                      >
                        <UtensilsCrossed size={28} className="text-orange-300/50" />
                      </motion.div>
                    </div>

                    {/* Info Skeleton */}
                    <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="h-4 bg-slate-200 rounded-md w-3/4 animate-pulse"></div>
                          <div className="w-3 h-3 rounded-full bg-slate-200 animate-pulse shrink-0"></div>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-md w-full animate-pulse"></div>
                        <div className="h-3 bg-slate-100 rounded-md w-1/2 animate-pulse"></div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2">
                        <div className="h-5 w-16 bg-orange-100/70 rounded-md animate-pulse"></div>
                        <div className="h-7 w-16 bg-orange-500/20 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : visibleCategoriesData.length === 0 ? (
          /* ── NO DISHES MATCH FILTER / EMPTY MENU ── */
          <div className="p-8 text-center max-w-md mx-auto my-8 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">
              {searchQuery || dietaryFilter !== 'all' ? t("No dishes found") : t("Menu is being prepared")}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {searchQuery || dietaryFilter !== 'all'
                ? t("Try clearing your search or dietary filter to see more dishes.")
                : t("Our kitchen is currently updating the menu. Please check back in a moment!")}
            </p>
            {(searchQuery || dietaryFilter !== 'all') ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDietaryFilter('all');
                }}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
              >
                {t("Clear Filters")}
              </button>
            ) : (
              <button
                onClick={() => fetchMenu()}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
              >
                {t("Refresh Menu")}
              </button>
            )}
          </div>
        ) : (
          /* ── REAL MENU ITEMS WITH STAGGERED REVEAL ── */
          visibleCategoriesData.map((category) => {
            const categoryItems = category.filteredItems;

            return (
              <div key={category._id} id={`category-${category._id}`} style={{ scrollMarginTop: '135px' }} className="animate-in fade-in slide-in-from-bottom-4 duration-500 scroll-mt-36">
                <h2 className="text-xl font-black text-slate-800 mb-4 px-2 flex items-center gap-2">
                  {(language !== 'en' && category.nameTranslations?.[language]) || t(category.name)}
                  <div className="h-px bg-slate-200 flex-1 ml-4 mt-1"></div>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categoryItems.map((item) => (
                    <div 
                      key={item._id} 
                      onClick={() => handleOpenItemDetail(item)}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 transition-all hover:shadow-md hover:border-orange-200 cursor-pointer active:scale-[0.99] group"
                    >
                      {item.image ? (
                        <div className="w-24 h-24 rounded-xl overflow-hidden shadow-2xs shrink-0 relative">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 shrink-0">
                          <UtensilsCrossed size={32} />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="font-bold text-slate-800 leading-tight pr-1 group-hover:text-orange-600 transition-colors">{(language !== 'en' && item.nameTranslations?.[language]) || t(item.name)}</h3>
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
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenItemDetail(item);
                            }}
                            className="bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white px-4 py-1.5 rounded-full font-bold text-sm transition-colors shadow-xs active:scale-95 cursor-pointer"
                          >
                            {t("ADD")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
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
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4"
                onClick={() => setShowOrderModal(false)}
              >
                <motion.div
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                  onClick={(e) => e.stopPropagation()}
                  className={`w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto rounded-t-3xl sm:rounded-3xl text-white p-4 sm:p-6 shadow-2xl flex flex-col gap-3 max-h-[90dvh] sm:max-h-[92vh] overflow-hidden ${
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
                    <div className="mt-2 bg-white/10 rounded-2xl p-3 sm:p-4 max-h-[46vh] overflow-y-auto custom-scrollbar flex flex-col gap-2.5">
                      <h3 className="font-bold text-sm border-b border-white/20 pb-2 mb-1">{t("Order Details")}</h3>
                      {activeOrderData.items.map(item => {
                        const rawQty = parseInt(item.quantity || 0, 10) || 0;
                        const cancelledQty = parseInt(item.cancelledQuantity || 0, 10) || 0;
                        const safeEffectiveQty = Math.max(0, rawQty - cancelledQty);
                        const itemTotal = item.price * safeEffectiveQty;

                        return (
                        <div key={item._id} className={`py-2 border-b border-white/10 last:border-0 ${item.isCancelled ? 'opacity-50' : ''}`}>
                          {/* Row 1: Name + Price */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-sm text-white leading-snug ${item.isCancelled ? 'line-through' : ''}`}>
                                {safeEffectiveQty}x {item.name}
                                {item.cancelledQuantity > 0 && !item.isCancelled && <span className="text-[10px] ml-1.5 bg-red-500/20 px-1.5 py-0.5 rounded text-red-100 font-normal">({item.cancelledQuantity} Cancelled)</span>}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[10.5px] text-white/80 font-medium flex items-center gap-0.5 whitespace-nowrap">
                                  🕒 {format12HourTime(item.orderedAt || item.createdAt || item.time || activeOrderData.createdAt)}
                                </span>
                                {item.specialNote && <span className="text-[10.5px] text-white/80 truncate max-w-[120px]">📝 {item.specialNote}</span>}
                              </div>
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
                            </div>
                            <span className={`font-black text-sm shrink-0 ${item.isCancelled ? 'line-through' : ''}`}>
                              ₹{itemTotal}
                            </span>
                          </div>
                          {/* Row 2: Status badges */}
                          {!item.isCancelled && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {item.cancellationRejected ? (
                                <span className="text-[10px] font-bold bg-slate-500/50 px-2 py-0.5 rounded-full text-white/90">{t("Rejected")}</span>
                              ) : item.cancellationRequested ? (
                                <>
                                  <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full text-center">
                                    {item.cancellationRequestedQty > 1 ? `${item.cancellationRequestedQty} Pending...` : t("Pending...")}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleWithdrawItemCancel(item); }}
                                    className="text-[10px] font-black bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-900 px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                                    title={t("Withdraw Cancel Request")}
                                  >
                                    ↩️ {t("Withdraw")}
                                  </button>
                                </>
                              ) : (() => {
                                const unitStatuses = Array.isArray(item.unitStatuses) && item.unitStatuses.length === safeEffectiveQty && safeEffectiveQty > 0
                                  ? item.unitStatuses
                                  : Array.from({ length: safeEffectiveQty }, () => item.kdsStatus || item.status || 'Pending');

                                const preparedCount = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
                                const preparingCount = unitStatuses.filter(s => s === 'Preparing').length;
                                const pendingCount = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

                                const hasMixedStatus = safeEffectiveQty > 1 && (
                                  (preparedCount > 0 && (preparingCount > 0 || pendingCount > 0)) ||
                                  (preparingCount > 0 && pendingCount > 0)
                                );

                                if (hasMixedStatus) {
                                  return (
                                    <>
                                      {preparedCount > 0 && (
                                        <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-500/70 text-white border border-emerald-400/50 px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm whitespace-nowrap">
                                          <Check size={9} strokeWidth={3} className="shrink-0" />
                                          <span>{preparedCount}x {t("Prepared")}</span>
                                        </span>
                                      )}
                                      {preparingCount > 0 && (
                                        <span className="text-[9px] sm:text-[10px] font-bold bg-amber-500/60 text-white border border-amber-400/40 px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm whitespace-nowrap">
                                          <Loader2 size={9} className="animate-spin text-amber-200 shrink-0" />
                                          <span>{preparingCount}x 👨‍🍳 {t("Preparing")}</span>
                                        </span>
                                      )}
                                      {pendingCount > 0 && (
                                        <span className="text-[9px] sm:text-[10px] font-bold bg-blue-500/40 text-white border border-blue-400/30 px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse shrink-0"></span>
                                          <span>{pendingCount}x ⏳ {t("Pending")}</span>
                                        </span>
                                      )}
                                    </>
                                  );
                                }

                                if (item.kdsStatus === 'Ready' || item.status === 'Ready' || item.kdsStatus === 'Prepared' || item.status === 'Prepared') {
                                  return (
                                    <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-500/70 text-white border border-emerald-400/50 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm whitespace-nowrap">
                                      <Check size={10} strokeWidth={3} className="shrink-0" />
                                      <span>{safeEffectiveQty > 1 ? `${safeEffectiveQty}x ` : ''}{t("Prepared")}</span>
                                    </span>
                                  );
                                }

                                if (item.kdsStatus === 'Preparing' || item.status === 'Preparing') {
                                  return (
                                    <span className="text-[9px] sm:text-[10px] font-bold bg-amber-500/60 text-white border border-amber-400/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm whitespace-nowrap">
                                      <Loader2 size={10} className="animate-spin text-amber-200 shrink-0" />
                                      <span>{safeEffectiveQty > 1 ? `${safeEffectiveQty}x ` : ''}👨‍🍳 {t("Preparing")}</span>
                                    </span>
                                  );
                                }

                                return (
                                  <>
                                    <span className="text-[9px] sm:text-[10px] font-bold bg-blue-500/40 text-white border border-blue-400/30 px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse shrink-0"></span>
                                      <span>{safeEffectiveQty > 1 ? `${safeEffectiveQty}x ` : ''}⏳ {t("Pending")}</span>
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRequestItemCancel(item); }}
                                      className="text-[9px] sm:text-[10px] font-bold bg-red-500/80 hover:bg-red-500 px-2 py-0.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                      {t("Cancel")}
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                        );
                      })}
                      
                      <div className="border-t border-white/20 pt-2 mt-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{t("Subtotal")}</span>
                          <span>₹{activeOrderData.subtotal !== undefined ? activeOrderData.subtotal : (activeOrderData.subTotal || activeOrderData.total)}</span>
                        </div>
                        {activeOrderData.taxBreakdown?.cgst > 0 && (
                          <div className="flex justify-between text-xs text-white/80">
                            <span>{t("CGST")} ({((activeOrderData.tax || 5) / 2).toFixed(1)}%)</span>
                            <span>₹{activeOrderData.taxBreakdown.cgst}</span>
                          </div>
                        )}
                        {activeOrderData.taxBreakdown?.sgst > 0 && (
                          <div className="flex justify-between text-xs text-white/80">
                            <span>{t("SGST")} ({((activeOrderData.tax || 5) / 2).toFixed(1)}%)</span>
                            <span>₹{activeOrderData.taxBreakdown.sgst}</span>
                          </div>
                        )}
                        {(!activeOrderData.taxBreakdown || (!activeOrderData.taxBreakdown.cgst && !activeOrderData.taxBreakdown.sgst)) && activeOrderData.tax > 0 && (
                          <div className="flex justify-between text-xs text-white/80">
                            <span>{t("Taxes (GST)")}</span>
                            <span>₹{activeOrderData.tax}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-sm pt-1 border-t border-white/10">
                          <span>{t("Grand Total")}</span>
                          <span>₹{activeOrderData.total}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Close button — only closes the modal, does NOT cancel the order */}
                  <button
                    onClick={() => setShowOrderModal(false)}
                    className="mt-2 w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-2xl transition-colors cursor-pointer"
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

      {/* ── GORGEOUS ITEM DETAIL MODAL ── */}
      <AnimatePresence>
        {viewingItemDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setViewingItemDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 25 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85dvh] sm:max-h-[90vh] border border-slate-100 relative my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Hero Image Section with Pinch-To-Zoom Touch Controls & Full Uncropped Image */}
              <div 
                className="relative w-full h-44 sm:h-64 bg-slate-950 shrink-0 overflow-hidden select-none touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {viewingItemDetail.image ? (
                  <>
                    {/* Blurred backdrop to fill the aspect container seamlessly */}
                    <img
                      src={viewingItemDetail.image}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-md opacity-40 scale-110 pointer-events-none"
                    />

                    {/* Main sharp uncropped image with interactive pinch zoom and pan */}
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      <img
                        src={viewingItemDetail.image}
                        alt={viewingItemDetail.name}
                        style={{
                          transform: `scale(${modalZoom}) translate(${modalPan.x / modalZoom}px, ${modalPan.y / modalZoom}px)`,
                          transition: modalZoom === 1 ? 'transform 0.25s ease-out' : 'none'
                        }}
                        className="w-full h-full object-contain drop-shadow-2xl will-change-transform"
                        draggable={false}
                      />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-orange-600 via-amber-500 to-orange-400 text-white p-6 text-center">
                    <UtensilsCrossed size={48} className="opacity-90 animate-pulse mb-2" />
                    <span className="font-bold text-sm tracking-wide uppercase opacity-85">{t("Fresh Kitchen Special")}</span>
                  </div>
                )}

                {/* Dark Gradient Overlay at Bottom of Image */}
                <div className={`absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/30 pointer-events-none transition-opacity ${modalZoom > 1.2 ? 'opacity-0' : 'opacity-100'}`} />

                {/* Zoom Level Indicator / Reset Pill when Zoomed */}
                {modalZoom > 1.05 && (
                  <button
                    type="button"
                    onClick={resetModalZoom}
                    className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/75 hover:bg-black text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/20 shadow-lg z-20 flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>🔍 {modalZoom.toFixed(1)}x</span>
                    <span className="text-orange-400 font-extrabold">• {t("Reset")}</span>
                  </button>
                )}

                {/* Floating Close Button */}
                <button
                  type="button"
                  onClick={() => setViewingItemDetail(null)}
                  className="absolute top-4 right-4 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md active:scale-90 z-20 cursor-pointer"
                >
                  <X size={20} />
                </button>

                {/* Floating Veg/Non-Veg & Bestseller Badges */}
                <div className={`absolute top-4 left-4 flex items-center gap-2 z-10 transition-opacity ${modalZoom > 1.2 ? 'opacity-0' : 'opacity-100'}`}>
                  <span className={`px-3 py-1 rounded-full text-xs font-black text-white flex items-center gap-1.5 shadow-md backdrop-blur-md ${
                    viewingItemDetail.type === 'veg' ? 'bg-green-600/90 border border-green-400/50' : 'bg-red-600/90 border border-red-400/50'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    {viewingItemDetail.type === 'veg' ? t("Pure Veg") : t("Non-Veg")}
                  </span>

                  {viewingItemDetail.isFavorite && (
                    <span className="bg-amber-500/90 text-white text-xs font-black px-3 py-1 rounded-full shadow-md backdrop-blur-md border border-amber-300/40 flex items-center gap-1">
                      🔥 {t("Bestseller")}
                    </span>
                  )}
                </div>

                {/* Bottom Overlay Title Info */}
                <div className={`absolute bottom-3 left-4 right-4 text-white z-10 transition-opacity ${modalZoom > 1.2 ? 'opacity-0' : 'opacity-100'}`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-300 bg-black/50 backdrop-blur-xs px-2.5 py-0.5 rounded-md inline-block mb-1">
                    {(language !== 'en' && viewingItemDetail.category?.nameTranslations?.[language]) || viewingItemDetail.category?.name || viewingItemDetail.category || t("Specialty Dish")}
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight drop-shadow-md text-white truncate">
                      {(language !== 'en' && viewingItemDetail.nameTranslations?.[language]) || t(viewingItemDetail.name)}
                    </h2>
                    <span className="text-[10px] text-white/70 font-semibold shrink-0 bg-black/40 px-2 py-0.5 rounded-full">
                      👆 {t("Pinch to zoom")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Body Info */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0 bg-slate-50/60 custom-scrollbar">
                {/* Description Card */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs space-y-1">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <Info size={14} className="text-orange-500" />
                    <span>{t("About this Dish")}</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed font-normal">
                    {(language !== 'en' && viewingItemDetail.descriptionTranslations?.[language]) ||
                     viewingItemDetail.description ||
                     t("Prepared fresh to order using finest ingredients, house-ground spices, and authentic culinary techniques.")}
                  </p>
                </div>

                {/* Variants & Pricing Structure */}
                {viewingItemDetail.variants && viewingItemDetail.variants.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-700 uppercase tracking-wider">{t("Choose Portion / Variant")}</p>
                      <span className="text-[11px] font-bold text-orange-600">{t("Select 1 option")}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {viewingItemDetail.variants.map((v, idx) => {
                        const isSelected = (detailSelectedVariant?.name || viewingItemDetail.variants[0]?.name) === v.name;
                        return (
                          <div
                            key={idx}
                            onClick={() => setDetailSelectedVariant(v)}
                            className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'border-orange-500 bg-orange-50/80 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                              </div>
                              <span className="font-bold text-xs text-slate-800">{v.name}</span>
                            </div>
                            <span className="font-black text-sm text-orange-600">₹{v.price}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex items-center justify-between">
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider">{t("Item Price")}</span>
                    <span className="text-xl font-black text-orange-600">₹{viewingItemDetail.price}</span>
                  </div>
                )}

                {/* Chef Special Cooking Instructions */}
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Clipboard size={13} className="text-orange-500" />
                    <span>{t("Cooking Note / Special Requests")}</span>
                  </p>
                  <textarea
                    value={detailSpecialNote}
                    onChange={(e) => setDetailSpecialNote(e.target.value)}
                    placeholder={t("e.g., Less spicy, no onion/garlic, extra sauce, well done...")}
                    className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none h-16 shadow-2xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="bg-white border-t border-slate-100 p-3 sm:p-4 flex items-center gap-3 shrink-0 shadow-lg">
                {/* Quantity Stepper */}
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-2xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDetailQuantity(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-slate-600 hover:bg-white hover:text-orange-600 active:scale-90 transition-all cursor-pointer"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-7 text-center font-black text-sm text-slate-800">{detailQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setDetailQuantity(prev => prev + 1)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-slate-600 hover:bg-white hover:text-green-600 active:scale-90 transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                {/* Add to Order Button */}
                {(() => {
                  const effectiveVariant = detailSelectedVariant || (viewingItemDetail.variants && viewingItemDetail.variants.length > 0 ? viewingItemDetail.variants[0] : null);
                  const effectivePrice = effectiveVariant ? effectiveVariant.price : viewingItemDetail.price;
                  const itemTotal = effectivePrice * detailQuantity;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(viewingItemDetail, effectiveVariant, detailSpecialNote, detailQuantity);
                        setViewingItemDetail(null);
                        setServiceMessage(`✅ ${t("Added")} ${detailQuantity}x "${(language !== 'en' && viewingItemDetail.nameTranslations?.[language]) || viewingItemDetail.name}" ${t("to order!")}`);
                        setTimeout(() => setServiceMessage(null), 3000);
                      }}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-orange-500/25 flex items-center justify-between cursor-pointer"
                    >
                      <span>{t("Add to Order")}</span>
                      <span className="font-mono text-base font-black">₹{itemTotal}</span>
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
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
                  className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white rounded-2xl py-4 font-black text-lg shadow-xl shadow-orange-500/30 transition-all disabled:opacity-75 flex items-center justify-center gap-2.5 cursor-pointer">
                  {orderStatus === 'placing' ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      <span>{t("Sending to Kitchen...")}</span>
                    </>
                  ) : (
                    <span>{t("Place Order Now")}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Placing Order Full Overlay Spinner */}
      <AnimatePresence>
        {orderStatus === 'placing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[70] flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-xs w-full shadow-2xl flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center">
                <RefreshCw className="animate-spin text-orange-500" size={32} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">{t("Sending to Kitchen...")}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t("Please wait while your table order is registered with the chef.")}</p>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                <div className="bg-orange-500 h-full w-full animate-progress rounded-full"></div>
              </div>
            </motion.div>
          </motion.div>
        )}
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

      {/* ── CUSTOM IN-APP MODAL FOR QUANTITY SELECTION DURING ITEM CANCEL ── */}
      <AnimatePresence>
        {cancelModalData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setCancelModalData(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col gap-4 text-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center font-black text-lg">
                    ✕
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-800 leading-tight">
                      {t("Cancel Item")}
                    </h3>
                    <p className="text-xs text-slate-500 truncate max-w-[190px]">
                      {cancelModalData.item.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCancelModalData(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center gap-2 border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t("Quantity to Cancel")}
                </span>
                <div className="flex items-center gap-4 my-1">
                  <button
                    type="button"
                    onClick={() => setCancelModalData(prev => ({
                      ...prev,
                      selectedQty: Math.max(1, prev.selectedQty - 1)
                    }))}
                    disabled={cancelModalData.selectedQty <= 1}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-lg flex items-center justify-center shadow-xs hover:bg-slate-100 active:scale-95 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-2xl font-black text-slate-800 w-12 text-center font-mono">
                    {cancelModalData.selectedQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCancelModalData(prev => ({
                      ...prev,
                      selectedQty: Math.min(prev.maxQty, prev.selectedQty + 1)
                    }))}
                    disabled={cancelModalData.selectedQty >= cancelModalData.maxQty}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-lg flex items-center justify-center shadow-xs hover:bg-slate-100 active:scale-95 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <span className="text-[11px] text-slate-400">
                  {t("Max available to cancel")}: <strong className="text-slate-700">{cancelModalData.maxQty}</strong>
                </span>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancelModalData(null)}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  {t("Keep Item")}
                </button>
                <button     
                  type="button"
                  onClick={() => executeItemCancel(cancelModalData.item, cancelModalData.selectedQty)}
                  className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all cursor-pointer"
                >
                  {t("Confirm Cancel")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>);

};

export default CustomerMenu;