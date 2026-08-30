import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import MenuGrid from './MenuGrid';
import TableDropdown from './TableDropdown';
import BillSummary from './BillSummary';
import PaymentModal from './PaymentModal';
import KOT from './KOT';
import Toast from './Toast';
import { getActiveOrder, saveOrder, generateBill, settleBill, apiGenerateKOT, apiReopenOrder, apiCancelOrder, apiTransferTable, getOpenOrders } from '../api/billing';
import api from '../api/axios';
import { getCachedOpenOrders, upsertCachedOpenOrder, removeCachedOpenOrder } from '../db/offlineDb';
import { Search, UtensilsCrossed, Maximize, Minimize, TrendingUp, ShoppingBag, LayoutGrid, ArrowRightLeft, Menu, ChevronLeft, ChevronRight, ChevronDown, Lock, Unlock, X, User, UserPlus, Phone, Loader2 } from 'lucide-react';
import useDebounce from '../hooks/useDebounce';
import Invoice from './Invoice';
import CancelOrderModal from './CancelOrderModal';
import TransferTableModal from './TransferTableModal';
import { useLanguage } from '../context/LanguageContext';
import realtimeService from '../services/realtimeService';

// Helper to match tables bidirectionally (e.g. "Ground Floor - Table 8" vs "Table 8" vs "T8", "Ground Floor - H-1" vs "H-1")
const isTableMatching = (tableA, tableB) => {
  if (!tableA || !tableB) return false;
  const cleanA = tableA.trim().replace(/\s+/g, ' ').toLowerCase();
  const cleanB = tableB.trim().replace(/\s+/g, ' ').toLowerCase();
  if (cleanA === cleanB) return true;

  const hasFloorA = cleanA.includes(' - ');
  const hasFloorB = cleanB.includes(' - ');

  // 1. If BOTH have a floor prefix, the floors MUST match!
  if (hasFloorA && hasFloorB) {
    const floorA = cleanA.split(' - ')[0].trim();
    const floorB = cleanB.split(' - ')[0].trim();
    if (floorA !== floorB) {
      return false; // Different floors (e.g. Ground Floor vs First Floor)
    }
  }

  // 2. Extract space parts
  const spaceA = hasFloorA ? cleanA.split(' - ').slice(1).join(' - ').trim() : cleanA;
  const spaceB = hasFloorB ? cleanB.split(' - ').slice(1).join(' - ').trim() : cleanB;

  if (spaceA === spaceB) return true;

  // 3. Compare alphanumeric normalization (e.g. "H-1" <-> "h1", "T-8" <-> "t8")
  const normA = spaceA.replace(/[^a-z0-9]/g, '');
  const normB = spaceB.replace(/[^a-z0-9]/g, '');
  if (normA && normB && normA === normB) return true;

  // 4. Standard space types (table, cabin, sofa, room, bar)
  const stdMatchA = spaceA.match(/^(table|cabin|sofa|room|bar)\s*0*(\d+)$/i);
  const stdMatchB = spaceB.match(/^(table|cabin|sofa|room|bar)\s*0*(\d+)$/i);

  if (stdMatchA && stdMatchB) {
    const typeA = stdMatchA[1];
    const typeB = stdMatchB[1];
    const numA = parseInt(stdMatchA[2], 10);
    const numB = parseInt(stdMatchB[2], 10);
    return typeA === typeB && numA === numB;
  }

  // 5. Short code vs Full standard type (e.g. "t1" vs "table 1", "c2" vs "cabin 2")
  if (stdMatchA && !stdMatchB) {
    const letterA = stdMatchA[1].charAt(0);
    const numA = parseInt(stdMatchA[2], 10);
    const shortB = spaceB.match(/^([a-z]+)-?0*(\d+)$/);
    if (shortB && shortB[1] === letterA && parseInt(shortB[2], 10) === numA) return true;
  } else if (!stdMatchA && stdMatchB) {
    const letterB = stdMatchB[1].charAt(0);
    const numB = parseInt(stdMatchB[2], 10);
    const shortA = spaceA.match(/^([a-z]+)-?0*(\d+)$/);
    if (shortA && shortA[1] === letterB && parseInt(shortA[2], 10) === numB) return true;
  }

  return false;
};

const BillingPage = ({ initialTable, onOrderUpdate, onNavigate, onGoBack, userRole = 'Admin' }) => {
  const { t } = useLanguage();
  const [activeTable, setActiveTable] = useState(initialTable || '');
  const [floors, setFloors] = useState([]);
  const [openOrdersList, setOpenOrdersList] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);

  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const isResizing = useRef(false);

  const startResizing = useCallback((e) => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    }
  }, []);

  const resize = useCallback((e) => {
    if (isResizing.current) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setRightPanelWidth(newWidth);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    // Instant cache load (0ms delay)
    getCachedOpenOrders().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setOpenOrdersList(cached);
      }
    }).catch(() => { });

    fetchOpenOrdersList();

    // Listen for real-time events via singleton RealtimeService
    const handleRealtimeUpdate = (data) => {
      fetchOpenOrdersList();
      if (data && data.tableNo) {
        window.dispatchEvent(new CustomEvent('remoteOrderUpdated', { detail: data }));
      } else {
        window.dispatchEvent(new CustomEvent('remoteOrderUpdated', { detail: {} }));
      }
    };

    const unsubOrderUpdated = realtimeService.subscribe('orderUpdated', handleRealtimeUpdate);
    const unsubCancellationResolved = realtimeService.subscribe('cancellationResolved', handleRealtimeUpdate);
    const unsubItemCancellationReq = realtimeService.subscribe('itemCancellationRequested', handleRealtimeUpdate);
    const unsubKotUpdated = realtimeService.subscribe('kotUpdated', handleRealtimeUpdate);
    const unsubPrepTimeUpdated = realtimeService.subscribe('prepTimeUpdated', handleRealtimeUpdate);
    const unsubBillSettled = realtimeService.subscribe('billSettled', fetchOpenOrdersList);
    const unsubTableStatusChanged = realtimeService.subscribe('tableStatusChanged', fetchOpenOrdersList);
    const unsubNewKOT = realtimeService.subscribe('newKOT', handleRealtimeUpdate);
    const unsubReservationUpdated = realtimeService.subscribe('reservationUpdated', fetchOpenOrdersList);

    const handleOfflineSave = (e) => {
      showToast(`⚠️ ${e.detail?.message || 'Order saved offline. Will sync when backend reconnects.'}`, 'error');
    };
    window.addEventListener('offlineOrderSaved', handleOfflineSave);

    return () => {
      unsubOrderUpdated();
      unsubCancellationResolved();
      unsubItemCancellationReq();
      unsubKotUpdated();
      unsubPrepTimeUpdated();
      unsubBillSettled();
      unsubTableStatusChanged();
      unsubNewKOT();
      unsubReservationUpdated();
      window.removeEventListener('offlineOrderSaved', handleOfflineSave);
    };
  }, []);

  async function fetchOpenOrdersList() {
    try {
      const data = await getOpenOrders();
      setOpenOrdersList(data || []);
    } catch (error) {
      console.error('Error fetching open orders list:', error);
    }

    try {
      const API_BASE_URL = getApiUrl();
      const res = await fetch(`${API_BASE_URL}/reservations`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) {
        const rdata = await res.json();
        setReservations(rdata || []);
      }
    } catch (e) { console.error('Error fetching reservations', e); }
  }

  useEffect(() => {
    const loadSpaces = () => {
      const savedSpaces = localStorage.getItem('msbillings_spaces');
      if (savedSpaces) {
        try {
          let parsed = JSON.parse(savedSpaces);
          if (!Array.isArray(parsed)) {
            parsed = [{
              id: 'f-default',
              name: 'Ground Floor',
              tables: parsed.tables || [],
              cabins: parsed.cabins || [],
              sofas: parsed.sofas || []
            }];
          }
          setFloors(parsed);
          return;
        } catch (error) { console.error('Error loading spaces:', error); }
      }
      setFloors([{
        id: 'f-1',
        name: 'Ground Floor',
        tables: [{ id: 't1', name: 'Table 1' }, { id: 't2', name: 'Table 2' }, { id: 't3', name: 'Table 3' }],
        cabins: [{ id: 'c1', name: 'Cabin 1' }, { id: 'c2', name: 'Cabin 2' }],
        sofas: [{ id: 's1', name: 'Sofa 1' }]
      }]);
    };

    loadSpaces();

    const syncSpacesFromBackend = async () => {
      try {
        const API_BASE_URL = getApiUrl();
        const res = await fetch(`${API_BASE_URL}/config/info`, {
          headers: {
            'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.spaces && Array.isArray(data.spaces) && data.spaces.length > 0) {
            localStorage.setItem('msbillings_spaces', JSON.stringify(data.spaces));
            setFloors(data.spaces);
          }
        }
      } catch (error) { console.error('Error syncing spaces:', error); }
    };
    syncSpacesFromBackend();

    window.addEventListener('spacesUpdated', loadSpaces);
    return () => window.removeEventListener('spacesUpdated', loadSpaces);
  }, []);

  const [cart, setCart] = useState([]);
  const [mobileTab, setMobileTab] = useState('menu'); // 'menu' or 'cart'
  const [orderId, setOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState('Open'); // Open, Billed, Paid
  const [billNumber, setBillNumber] = useState(null);

  const getDynamicTaxRateFromSettings = () => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      let tot = 0;
      if (s.enableCgst) tot += Number(s.cgstRate || 0);
      if (s.enableSgst) tot += Number(s.sgstRate || 0);
      if (s.enableGst) tot += Number(s.gstRate || 0);
      return tot;
    } catch (e) {
      return 0;
    }
  };

  const [billType, setBillType] = useState(initialTable ? initialTable.startsWith('DEL-') ? 'Delivery' : initialTable.startsWith('TAK-') ? 'Takeaway' : 'Dine-In' : 'Dine-In');
  const [taxRate, setTaxRate] = useState(() => {
    const tot = getDynamicTaxRateFromSettings();
    return tot > 0 ? tot : '';
  });

  useEffect(() => {
    const handleSettingsUpdate = () => {
      const tot = getDynamicTaxRateFromSettings();
      setTaxRate(tot > 0 ? tot : '');
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const [discount, setDiscount] = useState({ type: 'percentage', value: '' });

  // Delivery / CRM fields
  const [orderSource, setOrderSource] = useState('Direct');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerInfo, setCustomerInfo] = useState(null);

  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [containerCharge, setContainerCharge] = useState('0');

  const [showPayment, setShowPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(() => {
    try { return sessionStorage.getItem('ms_invoice_open') === 'true'; } catch { return false; }
  });
  const [showKOT, setShowKOT] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [activeKOTData, setActiveKOTData] = useState(null);
  const [completedBill, setCompletedBill] = useState(() => {
    try {
      const saved = sessionStorage.getItem('ms_completed_bill');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [tempCustomerPhone, setTempCustomerPhone] = useState('');
  const [tempCustomerName, setTempCustomerName] = useState('');
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmCustomerFound, setCrmCustomerFound] = useState(null);

  const searchInputRef = useRef(null);
  const isViewingInvoiceRef = useRef(false);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [foodTypeFilter, setFoodTypeFilter] = useState('all'); // 'all' | 'veg' | 'non-veg'
  const [dailyStats, setDailyStats] = useState({ sales: 0, orders: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'save' | 'hold' | 'print' | 'kot' | 'edit' | 'cancel' | 'settle'
  const newlyGeneratedTables = useRef(new Set());
  // Tracks the last time user manually edited the cart (add/remove/qty change)
  // Background fetches are suppressed for 8s after any local edit to prevent
  // the 3s poll or socket orderUpdated from reverting local-first cart state.
  const lastLocalEditTime = useRef(0);
  const LOCAL_EDIT_LOCK_MS = 8000; // 8 seconds of protection after any cart edit
  // Tracks whether the cart has locally-added items that haven't been saved to DB yet.
  // When true, background polls and socket events will NEVER clear or overwrite the cart.
  // Only resets to false when the order is explicitly saved, KOT'd, billed, or table is changed.
  const hasPendingLocalChanges = useRef(false);
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const generateSequentialOrderNo = (type) => {
    const prefix = type === 'Delivery' || type === 'DEL-NEW' ? 'DEL-' : 'TAK-';
    const existingTableNos = new Set();

    if (openOrdersList && Array.isArray(openOrdersList)) {
      openOrdersList.forEach((o) => {
        if (o.tableNo && o.tableNo.startsWith(prefix)) {
          existingTableNos.add(o.tableNo);
        }
      });
    }

    if (dailyStats?.recentBills && Array.isArray(dailyStats.recentBills)) {
      dailyStats.recentBills.forEach((b) => {
        if (b.tableNo && b.tableNo.startsWith(prefix)) {
          existingTableNos.add(b.tableNo);
        }
      });
    }

    if (newlyGeneratedTables.current) {
      newlyGeneratedTables.current.forEach((tNo) => {
        if (tNo && tNo.startsWith(prefix)) {
          existingTableNos.add(tNo);
        }
      });
    }

    let maxNum = 0;
    existingTableNos.forEach((tNo) => {
      const numPart = tNo.replace(prefix, '').trim();
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num < 10000 && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const formattedNum = String(nextNum).padStart(3, '0');
    return `${prefix}${formattedNum}`;
  };

  useEffect(() => {
    if (initialTable) {
      if (initialTable === 'DEL-NEW' || initialTable === 'TAK-NEW') {
        const type = initialTable === 'DEL-NEW' ? 'Delivery' : 'Takeaway';
        setBillType(type);
        const generatedOrderNo = generateSequentialOrderNo(type);
        newlyGeneratedTables.current.add(generatedOrderNo);
        setActiveTable(generatedOrderNo);
      } else {

        setActiveTable(initialTable);
        if (initialTable.startsWith('DEL-')) {
          setBillType('Delivery');
        } else if (initialTable.startsWith('TAK-')) {
          setBillType('Takeaway');
        } else {
          setBillType('Dine-In');
        }
        fetchActiveOrder(initialTable, true);
      }
    }
  }, [initialTable]);

  useEffect(() => {
    if ((billType === 'Delivery' || billType === 'Takeaway') && (!activeTable || activeTable === 'DEL-NEW' || activeTable === 'TAK-NEW' || !activeTable.startsWith(billType === 'Delivery' ? 'DEL-' : 'TAK-'))) {
      const prefix = billType === 'Delivery' ? 'DEL-' : 'TAK-';
      const isRecentOrder = (o) => {
        if (!o || !o.createdAt) return true;
        const diffHours = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60);
        return diffHours < 24;
      };
      const existingOrder = openOrdersList.find((o) =>
        o.tableNo?.startsWith(prefix) &&
        (o.status === 'Open' || o.status === 'Billed') &&
        isRecentOrder(o)
      );
      if (existingOrder && !initialTable) {
        newlyGeneratedTables.current.delete(existingOrder.tableNo);
        setActiveTable(existingOrder.tableNo);
        if (existingOrder.orderSource) {
          setOrderSource(existingOrder.orderSource);
        }
        fetchActiveOrder(existingOrder.tableNo, true);
      } else {
        const generatedOrderNo = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(generatedOrderNo);
        setCart([]);
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
        setCompletedBill(null);
        setCustomerPhone('');
        setCustomerName('');
        setDiscount({ type: 'percentage', value: '' });
        setDeliveryCharge('');
        setContainerCharge('');
        setActiveTable(generatedOrderNo);
      }
    } else if (billType === 'Dine-In' && activeTable && (activeTable.startsWith('DEL-') || activeTable.startsWith('TAK-'))) {
      setActiveTable('');
      setCart([]);
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);
      setCompletedBill(null);
      setCustomerPhone('');
      setCustomerName('');
      setDiscount({ type: 'percentage', value: '' });
      setDeliveryCharge('');
      setContainerCharge('');
    }
  }, [billType, openOrdersList]);

  useEffect(() => {
    // Reset pending local changes flag whenever the table changes.
    // This ensures that switching tables doesn't carry over the protection from the previous table.
    hasPendingLocalChanges.current = false;

    const isExistingInOpenOrders = openOrdersList && openOrdersList.some(o => isTableMatching(o.tableNo, activeTable));
    if (activeTable && (isExistingInOpenOrders || !newlyGeneratedTables.current.has(activeTable))) {
      newlyGeneratedTables.current.delete(activeTable);
      fetchActiveOrder(activeTable, true);
    } else if (activeTable && newlyGeneratedTables.current.has(activeTable)) {
      if (cart.length === 0) {
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
      }
    }

    const handleRemoteOrderUpdate = (e) => {
      // Pause updates if the user is currently viewing the invoice or payment modal
      if (showInvoice || showPayment || isViewingInvoiceRef.current) return;

      const hasLocalCart = hasPendingLocalChanges.current || (cartRef.current && cartRef.current.length > 0);
      if (hasLocalCart) {
        // Active cart has local unsaved items — protect it from being clobbered by remote socket events
        return;
      }

      const data = e.detail;
      if (data) {
        if (!data.tableNo || data.tableNo === activeTable) {
          const msSinceEdit = Date.now() - lastLocalEditTime.current;
          if (msSinceEdit > LOCAL_EDIT_LOCK_MS) {
            fetchActiveOrder(activeTable, false, true);
          }
        } else {
          const norm1 = (data.tableNo || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
          const norm2 = (activeTable || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
          if (norm1 && norm2 && norm1 === norm2) {
            const msSinceEdit = Date.now() - lastLocalEditTime.current;
            if (msSinceEdit > LOCAL_EDIT_LOCK_MS) {
              fetchActiveOrder(activeTable, false, true);
            }
          }
        }
      }
    };
    window.addEventListener('remoteOrderUpdated', handleRemoteOrderUpdate);

    // 5-Second polling to guarantee real-time bill summary UI updates
    const pollInterval = setInterval(() => {
      // Pause polling if the user is currently viewing the invoice or payment modal
      if (showInvoice || showPayment || isViewingInvoiceRef.current) return;

      if (activeTable) {
        // If user has unsaved cart items or pending local edits, NEVER fetch or overwrite activeTable!
        const hasLocalCart = hasPendingLocalChanges.current || (cartRef.current && cartRef.current.length > 0);
        if (!hasLocalCart) {
          fetchActiveOrder(activeTable, false, true);
        }
      }
      fetchOpenOrdersList();
    }, 5000);

    return () => {
      window.removeEventListener('remoteOrderUpdated', handleRemoteOrderUpdate);
      clearInterval(pollInterval);
    };
  }, [activeTable, showInvoice, showPayment]);

  useEffect(() => {
    const handleKotUpdatedSocket = (data) => {
      if (showInvoice || showPayment) return;

      if (data && (data.tableNo === activeTable || data.orderId === orderId)) {
        if (data.itemId || data.itemName) {
          setCart((prevCart) =>
            prevCart.map((i) => {
              if (
                (data.itemId && i._id?.toString() === data.itemId?.toString()) ||
                (data.itemName && i.name === data.itemName)
              ) {
                return {
                  ...i,
                  status: data.status || i.status,
                  unitStatuses: data.unitStatuses || i.unitStatuses,
                  preparedQuantity: data.preparedQuantity !== undefined ? data.preparedQuantity : i.preparedQuantity,
                  preparingQuantity: data.preparingQuantity !== undefined ? data.preparingQuantity : i.preparingQuantity,
                  pendingQuantity: data.pendingQuantity !== undefined ? data.pendingQuantity : i.pendingQuantity
                };
              }
              return i;
            })
          );
        }
        fetchActiveOrder(activeTable, false, true);
      }
    };

    const unsubKot = realtimeService.subscribe('kotUpdated', handleKotUpdatedSocket);
    const unsubReady = realtimeService.subscribe('foodReady', handleKotUpdatedSocket);
    return () => {
      unsubKot();
      unsubReady();
    };
  }, [activeTable, orderId, showInvoice, showPayment]);

  useEffect(() => {
    fetchDailyStats();
  }, []);

  useEffect(() => {
    if (customerPhone && customerPhone.length === 10) {
      const fetchCustomer = async () => {
        try {
          const API_BASE_URL = getApiUrl();
          const res = await fetch(`${API_BASE_URL}/customers/${customerPhone}`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
              'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (!data.isNew) {
              setCustomerName(data.customer.name);
              setCustomerInfo(data);
            } else {
              setCustomerInfo(null);
            }
          }
        } catch (error) { console.error('Error fetching customer:', error); }
      };
      fetchCustomer();
    } else {
      setCustomerInfo(null);
    }
  }, [customerPhone]);

  useEffect(() => {
    if (billType === 'Delivery' || billType === 'Takeaway' || activeTable?.startsWith('DEL-') || activeTable?.startsWith('TAK-')) {
      setShowTransfer(false);
    }
  }, [billType, activeTable]);

  const handleOpenCustomerModal = async () => {
    // 1. Check local state first
    let phoneToUse = customerPhone || '';
    let nameToUse = customerName || '';

    // 2. Fallback to openOrdersList
    if (!phoneToUse || !nameToUse) {
      const matchingOrder = openOrdersList.find(o => isTableMatching(o.tableNo, activeTable));
      if (matchingOrder) {
        phoneToUse = phoneToUse || matchingOrder.customerPhone || '';
        nameToUse = nameToUse || matchingOrder.customerName || '';
      }
    }

    // 3. Fallback to active order from API if table selected
    if ((!phoneToUse || !nameToUse) && activeTable) {
      try {
        const orderData = await getActiveOrder(activeTable);
        if (orderData) {
          phoneToUse = phoneToUse || orderData.customerPhone || '';
          nameToUse = nameToUse || orderData.customerName || '';
          if (orderData.customerPhone) setCustomerPhone(orderData.customerPhone);
          if (orderData.customerName) setCustomerName(orderData.customerName);
        }
      } catch (e) { }
    }

    setTempCustomerPhone(phoneToUse);
    setTempCustomerName(nameToUse);
    setCrmCustomerFound(null);
    if (phoneToUse && phoneToUse.length === 10) {
      handleCrmPhoneChange(phoneToUse);
    }
    setShowCustomerModal(true);
  };

  const handleCrmPhoneChange = async (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setTempCustomerPhone(digits);
    if (digits.length === 10) {
      setCrmLoading(true);
      try {
        const API_BASE_URL = getApiUrl();
        const res = await fetch(`${API_BASE_URL}/customers/${digits}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
            'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.isNew && data.customer) {
            setTempCustomerName(data.customer.name || '');
            setCrmCustomerFound(data.customer);
          } else {
            setCrmCustomerFound(null);
          }
        }
      } catch (err) {
        console.error('CRM lookup error:', err);
      } finally {
        setCrmLoading(false);
      }
    } else {
      setCrmCustomerFound(null);
    }
  };

  const handleSaveCustomerCRM = async (e) => {
    if (e) e.preventDefault();
    const cleanPhone = tempCustomerPhone.trim().replace(/\D/g, '');
    const cleanName = tempCustomerName.trim();

    if (!cleanPhone && !cleanName) {
      showToast(t('Please enter customer name or phone number'), 'warning');
      return;
    }

    setCrmSaving(true);
    try {
      if (cleanPhone) {
        await api.post('/customers', {
          name: cleanName || 'Guest',
          phone: cleanPhone,
          orderType: billType
        });
      }
      setCustomerPhone(cleanPhone);
      setCustomerName(cleanName || 'Guest');

      // Immediately sync customer details to the order in MongoDB!
      const targetOrderId = orderId || openOrdersList.find(o => isTableMatching(o.tableNo, activeTable))?._id;
      if (targetOrderId && !targetOrderId.startsWith('offline_')) {
        try {
          await api.patch(`/bills/${targetOrderId}/customer`, {
            customerName: cleanName || 'Guest',
            customerPhone: cleanPhone,
            billType
          });
        } catch (apiErr) {
          console.warn('Error patching customer to bill by ID:', apiErr);
        }
      } else if (activeTable) {
        try {
          await api.patch(`/bills/${encodeURIComponent(activeTable)}/customer`, {
            customerName: cleanName || 'Guest',
            customerPhone: cleanPhone,
            billType
          });
        } catch (apiErr) {
          console.warn('Error patching customer to bill by table:', apiErr);
        }
      }

      setOpenOrdersList(prev => prev.map(o => isTableMatching(o.tableNo, activeTable) ? {
        ...o,
        customerPhone: cleanPhone,
        customerName: cleanName || 'Guest'
      } : o));

      if (activeTable) {
        upsertCachedOpenOrder({
          tableNo: activeTable,
          customerPhone: cleanPhone,
          customerName: cleanName || 'Guest'
        }).catch(() => { });
      }

      showToast(t('Customer details linked to order'), 'success');
      setShowCustomerModal(false);
    } catch (err) {
      console.error('Error saving customer CRM:', err);
      setCustomerPhone(cleanPhone);
      setCustomerName(cleanName || 'Guest');
      setShowCustomerModal(false);
      showToast(t('Customer linked to order'), 'info');
    } finally {
      setCrmSaving(false);
    }
  };

  const handleOrderSourceChange = async (newSource) => {
    setOrderSource(newSource);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();

    const targetOrderId = orderId || openOrdersList.find(o => isTableMatching(o.tableNo, activeTable))?._id;
    if (targetOrderId && !targetOrderId.startsWith('offline_')) {
      try {
        await saveOrder({
          id: targetOrderId,
          tableNo: activeTable,
          billType: 'Delivery',
          orderSource: newSource,
          items: cart && cart.length > 0 ? cart : [{ name: 'Delivery Order', price: 0, quantity: 1 }],
          skipNotification: true
        });
        setOpenOrdersList(prev => prev.map(o => (o._id === targetOrderId || isTableMatching(o.tableNo, activeTable)) ? { ...o, orderSource: newSource } : o));
      } catch (err) {
        console.warn('Non-blocking error saving orderSource to DB:', err);
      }
    } else {
      setOpenOrdersList(prev => prev.map(o => isTableMatching(o.tableNo, activeTable) ? { ...o, orderSource: newSource } : o));
    }
  };

  // Global Keyboard Auto-Type to Search bar (Issue 7)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // If user is currently typing in an input, textarea, select, or contenteditable, don't intercept
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || activeEl?.isContentEditable;
      if (isInput) {
        if (e.key === 'Escape' && activeEl === searchInputRef.current) {
          setSearchTerm('');
          searchInputRef.current?.blur();
        }
        return;
      }

      // If any modal is active or viewing invoice, do not hijack typing
      if (showInvoice || showPayment || showKOT || showTransfer || showCancelModal || showCustomerModal || isViewingInvoiceRef.current) {
        return;
      }

      // Ignore modifier keys, navigation, and function keys
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) {
        if (e.key === 'Escape') {
          setSearchTerm('');
          searchInputRef.current?.blur();
        }
        return;
      }

      // If printable character (letters, numbers, space), auto-type into search bar
      if (/^[a-zA-Z0-9\s]$/.test(e.key)) {
        e.preventDefault();
        setSearchTerm((prev) => prev + e.key);
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showInvoice, showPayment, showKOT, showTransfer, showCancelModal, showCustomerModal]);

  async function fetchActiveOrder(tableToFetch = activeTable, forceReset = false, isBackground = false) {
    if (!tableToFetch) {
      setLoading(false);
      return;
    }

    const msSinceEdit = Date.now() - lastLocalEditTime.current;
    const isEditLocked = msSinceEdit < LOCAL_EDIT_LOCK_MS;

    // Helper to check orders array and apply order immediately (0ms delay)
    const checkAndApplyCache = (ordersArr) => {
      if (!ordersArr || !Array.isArray(ordersArr) || ordersArr.length === 0) return false;
      if (isEditLocked && !forceReset) return false; // Never let stale cache clobber local edits

      const cached = ordersArr.find(o => {
        if (!o.tableNo || (o.status !== 'Open' && o.status !== 'Billed')) return false;
        return isTableMatching(o.tableNo, tableToFetch);
      });

      if (cached && cached.items && cached.items.length > 0) {
        const kotStatusMap = {};
        if (cached.kots && Array.isArray(cached.kots)) {
          cached.kots.forEach(kot => {
            (kot.items || []).forEach(kItem => {
              if (kItem.name) {
                kotStatusMap[kItem.name] = kItem.status;
                if (kItem._id) kotStatusMap[kItem._id.toString()] = kItem.status;
              }
            });
          });
        }

        const validItems = cached.items.filter(i => {
          if (i.isCancelled || i.status === 'Cancelled') return false;
          const activeQty = Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0));
          return activeQty > 0;
        }).map(i => ({
          ...i,
          specialNote: i.specialNote || '',
          printedQuantity: i.printedQuantity !== undefined ? i.printedQuantity : (cached.status === 'Open' ? (i.quantity || 0) : 0),
          lastPrintedNote: i.lastPrintedNote !== undefined ? i.lastPrintedNote : (i.specialNote || ''),
          status: kotStatusMap[i._id?.toString()] || kotStatusMap[i.name] || i.status
        }));

        if (validItems.length > 0) {
          setCart(prev => {
            if (!prev || prev.length === 0 || forceReset) return validItems;
            return prev;
          });
          setOrderId(cached._id);
          setOrderStatus(cached.status);
          setBillNumber(cached.billNumber);
          setBillType(cached.billType || (cached.tableNo?.startsWith('DEL-') ? 'Delivery' : (cached.tableNo?.startsWith('TAK-') ? 'Takeaway' : 'Dine-In')));
          if (cached.orderSource) {
            setOrderSource(cached.orderSource);
          } else if (cached.billType === 'Delivery' || cached.tableNo?.startsWith('DEL-')) {
            setOrderSource('Direct');
          }
          setCustomerPhone(cached.customerPhone || '');
          setCustomerName(cached.customerName || '');
          setDeliveryCharge(cached.deliveryCharge !== undefined ? String(cached.deliveryCharge) : '0');
          setContainerCharge(cached.containerCharge !== undefined ? String(cached.containerCharge) : '0');
          if (cached.discountType || cached.discountValue !== undefined) {
            setDiscount({
              type: cached.discountType || 'percentage',
              value: cached.discountValue !== undefined && cached.discountValue !== null ? cached.discountValue : ''
            });
          }
          setLoading(false);
          return true;
        }
      }
      return false;
    };

    // 1. INSTANT 0ms CACHE READ (Memory + IndexedDB)
    let hasInstantCache = checkAndApplyCache(openOrdersList);
    if (!hasInstantCache) {
      try {
        const idbOrders = await getCachedOpenOrders();
        hasInstantCache = checkAndApplyCache(idbOrders);
      } catch (e) { }
    }

    if (hasInstantCache) {
      setLoading(false);
      return;
    }

    // If the user has local cart items or pending changes:
    // NEVER clear or clobber the cart during any background or poll fetch!
    const hasLocalCart = hasPendingLocalChanges.current || (cartRef.current && cartRef.current.length > 0);
    if (isBackground && !forceReset && hasLocalCart) {
      return;
    }

    // If this is a brand new empty table generated by user action, don't show loading or fetch
    const isNewlyGenerated = newlyGeneratedTables.current && newlyGeneratedTables.current.has(tableToFetch);
    const isKnownOrder = openOrdersList && openOrdersList.some(o => isTableMatching(o.tableNo, tableToFetch));
    if (isNewlyGenerated && !isKnownOrder) {
      if (hasLocalCart) {
        newlyGeneratedTables.current.delete(tableToFetch);
        return;
      }
      newlyGeneratedTables.current.delete(tableToFetch);
      setLoading(false);
      setCart([]);
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);
      setCompletedBill(null);
      return;
    }

    // Never clobber cart or completedBill while invoice or payment is active
    if (isViewingInvoiceRef.current || showInvoice || showPayment) {
      return;
    }

    // If the user has local items in cart, protect them until user saves or navigates away
    if (hasLocalCart && !forceReset) {
      return;
    }

    // Only set loading for tables that are actively fetching their order items
    if (!isBackground) setLoading(true);

    try {
      let order = await getActiveOrder(tableToFetch);
      if (order && (!order.tableNo || !isTableMatching(order.tableNo, tableToFetch))) {
        order = null;
      }
      if (!order && openOrdersList && openOrdersList.length > 0) {
        order = openOrdersList.find(o => {
          if (!o.tableNo || (o.status !== 'Open' && o.status !== 'Billed')) return false;
          return isTableMatching(o.tableNo, tableToFetch);
        });
      }

      if (order && order.tableNo && isTableMatching(order.tableNo, tableToFetch)) {
        const kotStatusMap = {};
        if (order.kots && Array.isArray(order.kots)) {
          order.kots.forEach(kot => {
            (kot.items || []).forEach(kItem => {
              if (kItem.name) {
                kotStatusMap[kItem.name] = kItem.status;
                if (kItem._id) kotStatusMap[kItem._id.toString()] = kItem.status;
              }
            });
          });
        }

        const backendItems = (order.items || [])
          .filter(i => (Number(i.quantity || 0) > 0 || (i.isCancelled && (i.printedQuantity || 0) > 0)))
          .map(i => ({
            ...i,
            specialNote: i.specialNote || '',
            printedQuantity: i.printedQuantity !== undefined ? i.printedQuantity : (order.status === 'Open' ? (i.quantity || 0) : 0),
            lastPrintedNote: i.lastPrintedNote !== undefined ? i.lastPrintedNote : (i.specialNote || ''),
            status: kotStatusMap[i._id?.toString()] || kotStatusMap[i.name] || i.status
          }));

        if (backendItems.length === 0) {
          setCart([]);
          setOrderId(null);
          setOrderStatus('Open');
          setBillNumber(null);
          return;
        }

        setCart(backendItems);
        setOrderId(order._id);
        setOrderStatus(order.status);
        setBillNumber(order.billNumber);
        setBillType(order.billType || 'Dine-In');
        if (order.billType === 'Delivery') {
          setOrderSource(order.orderSource || 'Direct');
        }
        setCustomerPhone(order.customerPhone || '');
        setCustomerName(order.customerName || '');
        setDeliveryCharge(order.deliveryCharge !== undefined ? String(order.deliveryCharge) : '0');
        setContainerCharge(order.containerCharge !== undefined ? String(order.containerCharge) : '0');
        if (!isBackground || forceReset) {
          setDiscount({
            type: order.discountType || 'percentage',
            value: order.discountValue !== undefined && order.discountValue !== null ? order.discountValue : ''
          });
        }
        try {
          const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          let tot = 0;
          if (s.enableCgst) tot += Number(s.cgstRate || 0);
          if (s.enableSgst) tot += Number(s.sgstRate || 0);
          if (s.enableGst) tot += Number(s.gstRate || 0);
          setTaxRate(tot > 0 ? tot : '');
        } catch (error) {
          console.error('Error parsing settings:', error);
          setTaxRate('');
        }
      } else {
        // If user has local cart items or pending local changes, NEVER reset cart!
        const hasLocalCart = hasPendingLocalChanges.current || (cartRef.current && cartRef.current.length > 0);
        if (hasLocalCart && !forceReset) {
          return;
        }

        if (isBackground && !forceReset) {
          return;
        }

        // If it's a delivery or takeaway table that has no active order (e.g. already settled/paid),
        // transition away ONLY on direct navigation when cart is completely empty!
        if (!isBackground && !hasLocalCart && tableToFetch && (tableToFetch.startsWith('DEL-') || tableToFetch.startsWith('TAK-')) && !newlyGeneratedTables.current.has(tableToFetch)) {
          newlyGeneratedTables.current.add(tableToFetch); // Mark tableToFetch as used
          const freshOrderNo = generateSequentialOrderNo(tableToFetch.startsWith('DEL-') ? 'Delivery' : 'Takeaway');
          newlyGeneratedTables.current.add(freshOrderNo);
          setActiveTable(freshOrderNo);
          setCart([]);
          setOrderId(null);
          setOrderStatus('Open');
          setBillNumber(null);
          setCompletedBill(null);
          setLoading(false);
          return;
        }

        setCart([]);
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
        setCompletedBill(null);
        if (billType !== 'Delivery') {
          setOrderSource('Direct');
        }
        setCustomerPhone('');
        setCustomerName('');
        setCustomerInfo(null);
        setDiscount({ type: 'percentage', value: '' });
        setDeliveryCharge('');
        setContainerCharge('');
        try {
          const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          let tot = 0;
          if (s.enableCgst) tot += Number(s.cgstRate || 0);
          if (s.enableSgst) tot += Number(s.sgstRate || 0);
          if (s.enableGst) tot += Number(s.gstRate || 0);
          setTaxRate(tot > 0 ? tot : '');
        } catch (error) {
          console.error('Error fetching settings:', error);
          setTaxRate('');
        }
      }
    } catch (error) {
      console.error('Error fetching active order:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };



  async function fetchDailyStats() {
    try {
      const { getDailyStats } = await import('../api/billing');
      const stats = await getDailyStats();
      setDailyStats(stats);
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      setDailyStats({ sales: 0, orders: 0 });
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => {
    if (item.isCancelled) return sum;
    const activeQty = item.quantity - (item.cancelledQuantity || 0);
    return sum + (item.price * activeQty);
  }, 0);

  const hasUnprintedItems = cart.length > 0 && cart.some((item) => {
    if (item.isCancelled) return false;
    const qty = item.quantity || 0;
    const printed = item.printedQuantity !== undefined ? item.printedQuantity : 0;
    const noteChanged = (item.specialNote || '').trim() !== (item.lastPrintedNote || '').trim();
    return qty !== printed || noteChanged;
  });

  const calculateDiscount = (subtotal) => {
    if (discount.type === 'complimentary') return subtotal;
    const val = discount.value === '' ? 0 : parseFloat(discount.value) || 0;
    if (discount.type === 'percentage') {
      return subtotal * val / 100;
    }
    return val;
  };

  const subtotal = calculateSubtotal();
  const discountAmount = calculateDiscount(subtotal);
  const taxableAmount = subtotal - discountAmount;
  const taxVal = taxRate === '' ? 0 : parseFloat(taxRate) || 0;
  const taxAmount = taxableAmount * taxVal / 100;
  const additionalCharges = parseFloat(deliveryCharge || 0) + parseFloat(containerCharge || 0);
  const total = Math.round(taxableAmount + taxAmount + additionalCharges);

  const syncTimeoutRef = useRef(null);

  const autoSyncOrder = useCallback((targetTable, currentCart, currentOrderId) => {
    if (!targetTable) return;

    if (!currentCart || currentCart.length === 0) {
      // Clear debounced save
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

      // Instantly remove from IndexedDB and local state
      if (currentOrderId) {
        removeCachedOpenOrder(currentOrderId).catch(() => { });
      }
      removeCachedOpenOrder(targetTable).catch(() => { });
      setOpenOrdersList(prev => prev.filter(o => o.tableNo !== targetTable && o._id !== currentOrderId));
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);

      // Notify backend to cancel/delete the draft order and free the table
      if (currentOrderId) {
        saveOrder({
          tableNo: targetTable,
          items: [],
          billType,
          ...(currentOrderId && !currentOrderId.startsWith('offline_') && { id: currentOrderId })
        }).then(() => {
          if (onOrderUpdate) onOrderUpdate();
          realtimeService.emit('orderUpdated', { tableNo: targetTable, status: 'Cancelled', orderId: currentOrderId });
          realtimeService.emit('tableStatusChanged', { tableNo: targetTable, status: 'Available' });
        }).catch((err) => {
          console.warn('Auto-sync empty order error:', err);
        });
      }
      return;
    }
  }, [billType, onOrderUpdate]);

  const addToCart = (item) => {
    let currentTable = activeTable;
    if (!currentTable) {
      if (billType === 'Takeaway' || billType === 'Delivery') {
        currentTable = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(currentTable);
        setActiveTable(currentTable);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') {
      showToast(t('orderLocked', { defaultValue: 'Order is locked' }), 'error');
      return;
    }
    // Strict lock: Billed orders require clicking EDIT first
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    const existing = cart.find((i) => i.name === item.name);
    let newCart;
    if (existing) {
      showToast(`${t('increasedQty', { defaultValue: 'Increased quantity of' })} ${item.name}`, 'success');
      newCart = cart.map((i) => i.name === item.name ? { ...i, quantity: i.quantity + 1, specialNote: i.specialNote || '', orderedAt: i.orderedAt || new Date().toISOString() } : i);
    } else {
      showToast(`${t('addedToOrder', { defaultValue: 'Added to order' })} ${item.name}`, 'success');
      newCart = [...cart, { ...item, quantity: 1, specialNote: item.specialNote || '', orderedAt: item.orderedAt || new Date().toISOString() }];
    }
    setCart(newCart);
    cartRef.current = newCart;
    lastLocalEditTime.current = Date.now(); // Mark local edit time
    // Mark that user has pending local changes — prevents any background poll
    // from clearing the cart until the user explicitly saves/KOTs/cancels.
    hasPendingLocalChanges.current = true;
    if (currentTable) {
      newlyGeneratedTables.current?.delete(currentTable);
    }
    // Clear any stale loading state immediately so items appear without any spinner delay
    setLoading(false);
  };

  const updateQuantity = (id, delta) => {
    let currentTable = activeTable;
    if (!currentTable) {
      if (billType === 'Takeaway' || billType === 'Delivery') {
        currentTable = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(currentTable);
        setActiveTable(currentTable);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') {
      showToast(t('orderLocked', { defaultValue: 'Order is locked' }), 'error');
      return;
    }
    // Strict lock: Billed orders require clicking EDIT first
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    const newCart = cart.map((i) => {
      const idStr = String(id || '').trim().toLowerCase();
      const iIdStr = String(i._id || '').trim().toLowerCase();
      const iNameStr = String(i.name || '').trim().toLowerCase();
      const match = (iIdStr && idStr === iIdStr) || (iNameStr && idStr === iNameStr);

      if (match) {
        const newQty = Math.max(0, i.quantity + delta);
        if (newQty === 0) {
          if ((i.printedQuantity || 0) > 0) {
            showToast(`${i.name} marked for cancellation (Print KOT)`, 'info');
          } else {
            showToast(`${i.name} ${t('removedFromOrder')}`, 'info');
          }
        }
        return { ...i, quantity: newQty, specialNote: i.specialNote || '' };
      }
      return i;
    }).filter((i) => i.quantity > 0 || (i.printedQuantity || 0) > 0);

    setCart(newCart);
    cartRef.current = newCart;
    lastLocalEditTime.current = Date.now(); // Mark local edit time
    // Mark pending local changes if cart still has items
    if (newCart.length > 0) {
      hasPendingLocalChanges.current = true;
      if (currentTable) {
        newlyGeneratedTables.current?.delete(currentTable);
      }
    } else {
      // Cart emptied — no longer pending
      hasPendingLocalChanges.current = false;
      autoSyncOrder(currentTable, [], orderId);
    }
  };

  const updateItemNote = async (identifier, specialNote) => {
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') {
      showToast(t('orderLocked', { defaultValue: 'Order is locked' }), 'error');
      return;
    }
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanNote = (specialNote || '').trim();

    lastLocalEditTime.current = Date.now();
    hasPendingLocalChanges.current = true;
    setCart((prev) => {
      return prev.map((i) => {
        const iIdStr = String(i._id || '').trim().toLowerCase();
        const iNameStr = String(i.name || '').trim().toLowerCase();
        const match = (iIdStr && cleanId === iIdStr) ||
          (iNameStr && cleanId === iNameStr);
        if (match) return { ...i, specialNote: cleanNote };
        return i;
      });
    });

    showToast(t('Note updated for kitchen'), 'success');
  };

  const handleSaveOrder = async () => {
    setActionLoading(prev => prev === 'hold' ? 'hold' : 'save');
    if (!activeTable) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        const generatedOrderNo = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(generatedOrderNo);
        setActiveTable(generatedOrderNo);
        setTimeout(() => handleSaveOrderWithTable(generatedOrderNo), 100);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        setActionLoading(null);
        return;
      }
    } else {
      handleSaveOrderWithTable(activeTable);
    }
  };

  const handleSaveOrderWithTable = async (tableNo) => {
    if (cart.length === 0) {
      showToast(t('pleaseAddItemsToOrder'), 'warning');
      setActionLoading(null);
      return;
    }
    setActionLoading(prev => prev === 'hold' ? 'hold' : 'save');
    lastLocalEditTime.current = Date.now(); // Lock out background fetches during save
    try {
      const orderData = {
        tableNo: tableNo,
        items: cart,
        billType,
        customerName,
        customerPhone,
        discountType: discount.type,
        discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
        tax: taxVal,
        deliveryCharge: parseFloat(deliveryCharge || 0),
        containerCharge: parseFloat(containerCharge || 0),
        ...(orderId && !orderId.startsWith('offline_') && { id: orderId }),
        ...(billType === 'Delivery' && {
          orderSource
        })
      };
      const savedOrder = await saveOrder(orderData);
      setOrderId(savedOrder._id);
      setActiveTable(tableNo);
      // Apply the backend-confirmed items directly (instant 0ms update)
      // This ensures removals are reflected immediately without a refetch race
      if (savedOrder.items && savedOrder.items.length > 0) {
        const kotStatusMap = {};
        if (savedOrder.kots && Array.isArray(savedOrder.kots)) {
          savedOrder.kots.forEach(kot => {
            (kot.items || []).forEach(kItem => {
              if (kItem.name) kotStatusMap[kItem.name] = kItem.status;
              if (kItem._id) kotStatusMap[kItem._id.toString()] = kItem.status;
            });
          });
        }
        const confirmedItems = savedOrder.items
          .filter(i => i.quantity > 0 || i.isCancelled)
          .map(i => ({ ...i, status: kotStatusMap[i._id?.toString()] || kotStatusMap[i.name] || i.status }));
        setCart(confirmedItems);
      }
      showToast(orderId ? t('orderUpdated', { defaultValue: 'Order updated successfully' }) : t('orderSaved'), 'success');
      // Extend edit lock after save completes so poll doesn't overwrite confirmed state
      lastLocalEditTime.current = Date.now();
      // Order is now saved to DB — clear pending local changes flag
      hasPendingLocalChanges.current = false;
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error saving order:', error);
      const errorMessage = error.response?.data?.message || error.message;
      showToast(`${t('failedToSave')}: ${errorMessage}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };



  // HOLD = SAVE: backend always stores with status 'Open' and marks table Occupied.
  // The "Hold Bills" counter in the header reflects all saved-but-unpaid Open orders.
  const handleHoldOrder = () => {
    setActionLoading('hold');
    handleSaveOrder();
  };

  const handleReopenOrder = async () => {
    if (!orderId && cart.length === 0) return;
    setActionLoading('edit');
    try {
      if (orderId && !orderId.startsWith('offline_')) {
        await apiReopenOrder(orderId);
      }
      setOrderStatus('Open');
      hasPendingLocalChanges.current = true;
      lastLocalEditTime.current = Date.now();
      showToast(t('Order unlocked for editing', { defaultValue: 'Order unlocked for editing' }), 'success');
      if (onOrderUpdate) onOrderUpdate();
    } catch (err) {
      console.error('Error reopening order for edit:', err);
      setOrderStatus('Open');
      hasPendingLocalChanges.current = true;
      lastLocalEditTime.current = Date.now();
      showToast(t('Order unlocked for editing', { defaultValue: 'Order unlocked for editing' }), 'info');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiscountChange = (val) => {
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    setDiscount(val);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
  };

  const handleDeliveryChargeChange = (val) => {
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    setDeliveryCharge(val);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
  };

  const handleContainerChargeChange = (val) => {
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    setContainerCharge(val);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
  };

  const handleGenerateBill = async () => {
    let tableToUse = activeTable;
    if (!tableToUse) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        tableToUse = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(tableToUse);
        setActiveTable(tableToUse);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }

    if (cart.length === 0) {
      showToast(t('pleaseAddItemsToOrder'), 'warning');
      return;
    }

    // If order is ALREADY billed and no unsaved local changes exist, open the invoice preview directly!
    if (orderStatus === 'Billed' && orderId && !hasPendingLocalChanges.current) {
      showToast(t('Bill already saved and printed'), 'info');
      if (!completedBill || completedBill._id !== orderId) {
        try {
          const resp = await api.get(`/bills/${orderId}`);
          if (resp.data) setCompletedBill(resp.data);
        } catch (e) { }
      }
      isViewingInvoiceRef.current = true;
      setShowInvoice(true);
      return;
    }

    setLoading(true);
    setActionLoading('print');
    try {
      const orderData = {
        tableNo: tableToUse,
        items: cart,
        billType,
        customerName,
        customerPhone,
        discountType: discount.type,
        discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
        tax: taxVal,
        deliveryCharge: parseFloat(deliveryCharge || 0),
        containerCharge: parseFloat(containerCharge || 0),
        skipNotification: true, // Do not trigger "Order Updated" right before billing
        ...(orderId && !orderId.startsWith('offline_') && { id: orderId }),
        ...(billType === 'Delivery' && { orderSource })
      };
      const savedOrder = await saveOrder(orderData);
      const activeId = savedOrder?._id || orderId;
      if (savedOrder?._id) {
        setOrderId(savedOrder._id);
        upsertCachedOpenOrder(savedOrder).catch(() => { });
      }
      await generateBillAfterSave(activeId);
    } catch (error) {
      console.error('Error saving order before generating bill:', error);
      const errorMessage = error.response?.data?.message || error.message;
      showToast(`${t('failedToSave')}: ${errorMessage}`, 'error');
      setLoading(false);
      setActionLoading(null);
    }
  };

  const generateBillAfterSave = async (orderIdToUse) => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      const cRate = s.enableCgst !== false ? s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5 : 0;
      const sRate = s.enableSgst !== false ? s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5 : 0;
      const gRate = s.enableGst === true ? s.gstRate !== undefined ? Number(s.gstRate) : 5 : 0;
      const totRate = cRate + sRate + gRate;

      let cAmt = 0, sAmt = 0, gAmt = 0;
      if (totRate > 0) {
        cAmt = taxVal * (cRate / totRate) || 0;
        sAmt = taxVal * (sRate / totRate) || 0;
        gAmt = taxVal * (gRate / totRate) || 0;
      }

      const billData = {
        tableNo: activeTable,
        discount: discountAmount,
        discountType: discount.type,
        discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
        tax: taxVal,
        deliveryCharge: parseFloat(deliveryCharge || 0),
        containerCharge: parseFloat(containerCharge || 0),
        total: total,
        orderSource: billType === 'Delivery' ? orderSource : undefined,
        customerName,
        customerPhone,
        taxBreakdown: {
          cgst: cAmt,
          sgst: sAmt,
          igst: gAmt
        }
      };
      const billedOrder = await generateBill(orderIdToUse, billData);
      const billedData = {
        ...billedOrder,
        items: (cart && cart.length > 0) ? cart : (billedOrder.items || []),
        tableNo: billedOrder.tableNo || activeTable,
        subtotal: subtotal || billedOrder.subtotal,
        tax: taxVal || billedOrder.tax,
        discount: discountAmount || billedOrder.discount,
        total: total || billedOrder.total,
        billType: billType || billedOrder.billType,
        orderSource: orderSource || billedOrder.orderSource,
        customerName: customerName || billedOrder.customerName,
        customerPhone: customerPhone || billedOrder.customerPhone,
        deliveryCharge: deliveryCharge,
        containerCharge: containerCharge,
        createdAt: billedOrder.createdAt || new Date()
      };
      setCompletedBill(billedData);
      setOrderStatus('Billed');
      if (billedOrder?.billNumber) setBillNumber(billedOrder.billNumber);
      hasPendingLocalChanges.current = false;
      isViewingInvoiceRef.current = true;
      setShowInvoice(true);

      showToast(t('Bill saved & printed successfully', { defaultValue: 'Bill saved & printed successfully' }), 'success');
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error generating bill:', error);

      if (error.response?.status === 400 && error.response?.data?.message?.includes('already billed')) {
        try {
          // Order already billed - fetch existing bill and show invoice
          const ordToFetch = orderIdToUse || orderId;
          let order = null;
          if (ordToFetch && !ordToFetch.startsWith('offline_')) {
            try {
              const resp = await api.get(`/bills/${ordToFetch}`);
              order = resp.data;
            } catch (e) {
              if (activeTable) order = await getActiveOrder(activeTable);
            }
          } else if (activeTable) {
            order = await getActiveOrder(activeTable);
          }
          if (order && (order.status === 'Billed' || order.status === 'Paid')) {
            setOrderStatus(order.status);
            setBillNumber(order.billNumber);
            setCompletedBill(order);
            isViewingInvoiceRef.current = true;
            setShowInvoice(true);
            showToast(t('recoveredExistingBill'), 'info');
            return;
          }
        } catch (fetchError) {
          console.error('Error recovering order state:', fetchError);
        }
      }

      const errorMessage = error.response?.data?.message || error.message;
      showToast(`${t('failedToGenerateBill')}: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
      setActionLoading(null);
    }
  };

  const handleSettleBill = (paymentData) => {
    completeSettlement(paymentData);
  };

  const completeSettlement = async (paymentData) => {
    if (orderStatus === 'Paid') {
      showToast(t('billAlreadySettled'), 'info');
      setShowPayment(false);
      setShowInvoice(true);
      return;
    }

    setLoading(true);
    setActionLoading('settle');
    try {
      let currentId = orderId;

      if (!currentId) {
        let tableToUse = activeTable;
        if (!tableToUse) {
          tableToUse = generateSequentialOrderNo(billType);
          newlyGeneratedTables.current.add(tableToUse);
          setActiveTable(tableToUse);
        }
        const orderData = {
          tableNo: tableToUse,
          items: cart,
          subtotal,
          tax: taxVal,
          discount: discountAmount,
          discountType: discount.type,
          discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
          total,
          billType,
          orderSource: billType === 'Delivery' ? orderSource : undefined,
          customerPhone,
          customerName,
          deliveryCharge: parseFloat(deliveryCharge || 0),
          containerCharge: parseFloat(containerCharge || 0)
        };
        const savedOrder = await saveOrder(orderData);
        currentId = savedOrder._id;
        setOrderId(savedOrder._id);
      }

      let currentBillNum = billNumber;
      let billDetails = null;
      if (orderStatus !== 'Paid') {
        const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
        const cRate = s.enableCgst !== false ? s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5 : 0;
        const sRate = s.enableSgst !== false ? s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5 : 0;
        const gRate = s.enableGst === true ? s.gstRate !== undefined ? Number(s.gstRate) : 5 : 0;
        const totRate = cRate + sRate + gRate;

        let cAmt = 0, sAmt = 0, gAmt = 0;
        if (totRate > 0) {
          cAmt = taxVal * (cRate / totRate) || 0;
          sAmt = taxVal * (sRate / totRate) || 0;
          gAmt = taxVal * (gRate / totRate) || 0;
        }

        const billData = {
          discount: discountAmount,
          discountType: discount.type,
          discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
          tax: taxVal,
          total,
          deliveryCharge: parseFloat(deliveryCharge || 0),
          containerCharge: parseFloat(containerCharge || 0),
          orderSource: billType === 'Delivery' ? orderSource : undefined,
          customerName,
          customerPhone,
          taxBreakdown: {
            cgst: cAmt,
            sgst: sAmt,
            igst: gAmt
          }
        };
        const billedOrder = await generateBill(currentId, billData);
        setOrderStatus('Billed');
        currentBillNum = billedOrder.billNumber;
        setBillNumber(billedOrder.billNumber);
        billDetails = billedOrder;
        setCompletedBill(billedOrder);
      }

      const settledOrder = await settleBill(currentId, {
        paymentMode: paymentData.mode,
        splitPayments: paymentData.splitPayments,
        amountPaid: paymentData.amountPaid,
        upiApp: paymentData.upiApp,
        total,
        deliveryCharge: parseFloat(deliveryCharge || 0),
        containerCharge: parseFloat(containerCharge || 0),
        orderSource: billType === 'Delivery' ? orderSource : undefined
      });
      setOrderStatus('Paid');
      setShowPayment(false);

      // Remove from offline cache so table is immediately released
      removeCachedOpenOrder(currentId).catch(() => { });
      if (activeTable) removeCachedOpenOrder(activeTable).catch(() => { });

      const finalBill = {
        ...(billDetails || settledOrder),
        ...settledOrder,
        items: (cart && cart.length > 0) ? cart : (settledOrder?.items || billDetails?.items || []),
        status: 'Paid',
        paymentMode: paymentData.mode,
        splitPayments: paymentData.splitPayments || settledOrder?.splitPayments,
        amountPaid: paymentData.amountPaid || settledOrder?.amountPaid,
        upiApp: paymentData.upiApp || settledOrder?.upiApp,
        paymentMethod: paymentData.upiApp || settledOrder?.upiApp,
        billNumber: currentBillNum || settledOrder?.billNumber,
        tableNo: settledOrder?.tableNo || billDetails?.tableNo || activeTable,
        subtotal: subtotal || settledOrder?.subtotal,
        tax: taxVal || settledOrder?.tax,
        discount: discountAmount || settledOrder?.discount,
        discountType: discount.type || settledOrder?.discountType,
        discountValue: discount.value || settledOrder?.discountValue,
        total: total || settledOrder?.total,
        billType: billType || settledOrder?.billType,
        orderSource: orderSource || settledOrder?.orderSource,
        customerName: customerName || settledOrder?.customerName,
        customerPhone: customerPhone || settledOrder?.customerPhone,
        deliveryCharge: deliveryCharge,
        containerCharge: containerCharge,
        createdAt: new Date()
      };

      isViewingInvoiceRef.current = true;
      setCompletedBill(finalBill);
      setShowInvoice(true);
      // Persist invoice state so page refresh restores this view
      try {
        sessionStorage.setItem('ms_invoice_open', 'true');
        sessionStorage.setItem('ms_completed_bill', JSON.stringify(finalBill));
      } catch (e) { }
      showToast(t('billSettled'), 'success');
      hasPendingLocalChanges.current = false;
      fetchDailyStats();
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error settling bill:', error);
      setToast({ message: error.response?.data?.message || error.message || t('failedToSettle'), type: 'error' });
    } finally {
      setLoading(false);
      setActionLoading(null);
    }
  };

  const handlePrintKOT = async () => {
    if (!hasUnprintedItems) {
      showToast(t('KOT already fired for current order items. Status: Preparing'), 'info');
      return;
    }
    setActionLoading('kot');
    if (!activeTable) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        const generatedOrderNo = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(generatedOrderNo);
        setActiveTable(generatedOrderNo);
        setTimeout(() => handlePrintKOTWithTable(generatedOrderNo), 100);
        return;
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        setActionLoading(null);
        return;
      }
    }
    handlePrintKOTWithTable(activeTable);
  };

  const handlePrintKOTWithTable = async (tableNo) => {
    try {
      setLoading(true);
      setActionLoading('kot');
      const orderData = {
        tableNo: tableNo,
        items: cart,
        subtotal,
        tax: taxVal,
        discount: discountAmount,
        discountType: discount.type,
        discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
        total,
        billType,
        orderSource: billType === 'Delivery' ? orderSource : undefined,
        customerPhone,
        customerName,
        deliveryCharge: parseFloat(deliveryCharge || 0),
        containerCharge: parseFloat(containerCharge || 0),
        skipNotification: true // Do not fire "New Order Placed" or "Order Updated" right before KOT is fired
      };

      let currentId = orderId;
      if (!currentId || currentId.startsWith('offline_')) {
        const savedOrder = await saveOrder(orderData);
        currentId = savedOrder._id;
        setOrderId(savedOrder._id);
      } else {
        const savedOrder = await saveOrder({ id: currentId, ...orderData });
        // Just in case it returned a new ID
        if (savedOrder && savedOrder._id !== currentId) {
          currentId = savedOrder._id;
          setOrderId(savedOrder._id);
        }
      }

      const response = await apiGenerateKOT(currentId, cart, tableNo);

      if (response.bill && response.bill.items) {
        setCart(response.bill.items.map(i => ({
          ...i,
          printedQuantity: i.printedQuantity !== undefined ? i.printedQuantity : i.quantity,
          lastPrintedNote: i.specialNote || ''
        })));
      } else {
        setCart(prev => prev.map(i => ({
          ...i,
          printedQuantity: i.quantity,
          lastPrintedNote: i.specialNote || ''
        })));
      }

      let kotData = response.kot;
      if (response._offline) {
        kotData = {
          items: cart,
          createdAt: new Date(),
          kotNumber: 'OFFLINE-SYNC'
        };
      }

      // Calculate current active queue position of this order
      const activeOrdersSorted = (openOrdersList || [])
        .filter(o => o.status === 'Open' || o.status === 'Billed')
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

      const orderIndex = activeOrdersSorted.findIndex(o =>
        (o._id && currentId && o._id === currentId) ||
        isTableMatching(o.tableNo, tableNo)
      );

      const queueNo = orderIndex !== -1 ? (orderIndex + 1) : (activeOrdersSorted.length || 1);

      setActiveKOTData({
        ...kotData,
        tableNo: tableNo,
        billType: billType,
        orderSource: kotData?.orderSource || orderSource || response?.bill?.orderSource,
        tokenNo: kotData?.tokenNo || kotData?.queueNumber || queueNo,
        queueNumber: kotData?.tokenNo || kotData?.queueNumber || queueNo,
        waiterName: userRole
      });
      setShowKOT(true);
      showToast(t('kotGeneratedSuccess', { defaultValue: 'KOT printed successfully' }), 'success');
      // KOT printed = order is now in DB, clear pending local changes
      hasPendingLocalChanges.current = false;
      fetchDailyStats();
      if (onOrderUpdate) onOrderUpdate();

    } catch (error) {
      console.error('Error generating KOT:', error);
      showToast(error.response?.data?.message || error.message || t('failedToPrintKOT'), 'error');
    } finally {
      setLoading(false);
      setActionLoading(null);
    }
  };

  const handleFinish = () => {
    isViewingInvoiceRef.current = false;
    if (completedBill && completedBill.status === 'Paid') {
      showToast(`${t('billSaved')} ${completedBill.billNumber || ''}`, 'success');
    }
    // Clear persisted invoice state
    try {
      sessionStorage.removeItem('ms_invoice_open');
      sessionStorage.removeItem('ms_completed_bill');
    } catch (e) { }
    setShowInvoice(false);
    setCart([]);
    setOrderId(null);
    setOrderStatus('Open');
    setBillNumber(null);
    setCompletedBill(null);

    // Reset order-specific states to prevent carry-over to next order
    setDiscount({ type: 'percentage', value: '' });
    setCustomerPhone('');
    setCustomerName('');
    setCustomerInfo(null);
    setDeliveryCharge('0');
    setContainerCharge('0');
    setOrderSource('Direct');

    if (billType === 'Dine-In') {
      setActiveTable('');
      fetchActiveOrder('');
    } else {
      if (activeTable) newlyGeneratedTables.current.add(activeTable);
      const generatedOrderNo = generateSequentialOrderNo(billType);
      newlyGeneratedTables.current.add(generatedOrderNo);
      setActiveTable(generatedOrderNo);
      fetchActiveOrder(generatedOrderNo);
    }

    fetchDailyStats();

    if (onOrderUpdate) onOrderUpdate();

    if (onGoBack) {
      onGoBack();
    }
  };



  const handleCancelOrder = () => {
    if (!orderId) {
      setCart([]);
      return;
    }

    setShowCancelModal(true);
  };

  const confirmCancelOrder = async (cancelReason) => {
    setShowCancelModal(false);

    try {
      setLoading(true);
      setActionLoading('cancel');
      const response = await apiCancelOrder(orderId, cancelReason);

      if (response.kot) {
        setActiveKOTData({
          ...response.kot,
          tableNo: activeTable,
          billType,
          orderSource
        });
        setShowKOT(true);
      }

      showToast(t('orderCancelled'), 'success');

      setCart([]);
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);

      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error cancelling order:', error);
      showToast(error.response?.data?.message || t('failedToCancelOrder'), 'error');
    } finally {
      setLoading(false);
      setActionLoading(null);
    }
  };

  const handleTransferTable = async (newTableNo, sourceOrderId, sourceTableNo) => {
    const idToTransfer = sourceOrderId || orderId;
    if (!idToTransfer) return;
    try {
      setLoading(true);
      await apiTransferTable(idToTransfer, newTableNo);
      showToast(`${t('billTransferred')} ${newTableNo}`, 'success');
      setShowTransfer(false);
      await fetchOpenOrdersList(); // Refresh open orders to reflect transfer
      if (!sourceTableNo || sourceTableNo === activeTable) {
        setActiveTable(newTableNo);
      }
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error transferring table:', error);
      showToast(error.response?.data?.message || t('failedToTransferTable'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <div className="h-12 sm:h-14 flex items-center justify-between px-2 sm:px-3 lg:px-6 bg-surface border-b border-border/50 shrink-0 relative z-30 gap-1 sm:gap-2">

        {/* Left Section: Select Table */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 z-30">
          <div className="relative flex items-center gap-1.5 sm:gap-2 bg-background border border-border rounded-xl px-2 sm:px-3 py-1.5 hover:bg-surface/50 transition-colors focus-within:ring-2 focus-within:ring-primary/20 cursor-pointer max-w-[130px] sm:max-w-[170px] lg:max-w-[200px]">
            <LayoutGrid size={15} className="text-text-muted shrink-0 pointer-events-none" />
            <div className="flex items-center pointer-events-none min-w-0">
              <span className="font-bold text-text-main text-xs sm:text-sm truncate">
                {activeTable ?
                  activeTable === 'NEW_ORDER' ? t('newOrder') : activeTable :
                  t('selectTable', { defaultValue: 'Select Table' })}
              </span>
              <ChevronDown size={13} className="text-text-muted ml-0.5 shrink-0" />
            </div>

            {billType === 'Delivery' || billType === 'Takeaway' ?
              <select
                value={activeTable}
                onChange={(e) => {
                  if (e.target.value === 'NEW_ORDER') {
                    const generatedOrderNo = generateSequentialOrderNo(billType);
                    newlyGeneratedTables.current.add(generatedOrderNo);
                    setActiveTable(generatedOrderNo);
                  } else {
                    const chosenTable = e.target.value;
                    setActiveTable(chosenTable);
                    const matchingOrder = openOrdersList.find(o => isTableMatching(o.tableNo, chosenTable));
                    if (matchingOrder && matchingOrder.orderSource) {
                      setOrderSource(matchingOrder.orderSource);
                    } else if (chosenTable.startsWith('DEL-')) {
                      setOrderSource('Direct');
                    }
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                style={{ backgroundColor: '#ffffff', color: '#111827' }}
              >
                <option
                  value="NEW_ORDER"
                  style={{ backgroundColor: '#ffffff', color: '#ea580c', fontWeight: 'bold' }}
                  className="bg-white text-orange-600 font-bold"
                >
                  + {t('newOrder')}
                </option>
                {openOrdersList
                  .filter((o) => o.tableNo?.startsWith(billType === 'Delivery' ? 'DEL-' : 'TAK-'))
                  .map((o) => (
                    <option
                      key={o._id}
                      value={o.tableNo}
                      style={{ backgroundColor: '#ffffff', color: '#111827', fontWeight: '500' }}
                      className="bg-white text-gray-900 font-medium"
                    >
                      {o.tableNo} ({o.status === 'Billed' ? t('Billed') : t('Open')} - ₹{o.total || 0})
                    </option>
                  ))
                }
                {activeTable && !openOrdersList.some((o) => isTableMatching(o.tableNo, activeTable)) && (
                  <option
                    value={activeTable}
                    style={{ backgroundColor: '#ffffff', color: '#111827', fontWeight: '500' }}
                    className="bg-white text-gray-900 font-medium"
                  >
                    {activeTable} ({t('newCurrent')})
                  </option>
                )}
              </select> :

              <TableDropdown
                floors={floors}
                activeTable={activeTable}
                align="left"
                onSelect={(val) => setActiveTable(val)}
                wrapperClass="absolute inset-0 w-full h-full z-30"
                customButton={<div className="absolute inset-0 w-full h-full cursor-pointer z-30" />}
                openOrders={openOrdersList}
                reservations={reservations}
              />
            }
          </div>
        </div>

        {/* Center Section: Search Bar (Desktop/Tablet, centered with Cancel/Clear button) */}
        <div className="hidden md:flex flex-1 items-center justify-center px-1 sm:px-2 lg:px-4 max-w-xs lg:max-w-md xl:max-w-xl mx-auto z-20 min-w-[100px]">
          <div className="relative w-full items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('Search all menu items...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-xs sm:text-sm text-text-main transition-all shadow-xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-full p-1 transition-all cursor-pointer shadow-2xs"
                title={t("Clear search")}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mobile-only Veg / Non-Veg / All Segmented Filter next to Select Table */}
          <div className="flex sm:hidden items-center bg-background p-0.5 rounded-xl border border-border shadow-xs shrink-0 gap-0.5 z-30">
            <button
              type="button"
              onClick={() => setFoodTypeFilter('all')}
              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${foodTypeFilter === 'all'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main'
                }`}
            >
              {t("All")}
            </button>
            <button
              type="button"
              onClick={() => setFoodTypeFilter('veg')}
              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${foodTypeFilter === 'veg'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-600 hover:bg-emerald-50/50'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 border border-white shrink-0"></span>
              <span>{t("Veg")}</span>
            </button>
            <button
              type="button"
              onClick={() => setFoodTypeFilter('non-veg')}
              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${foodTypeFilter === 'non-veg'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 hover:bg-rose-50/50'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 border border-white shrink-0"></span>
              <span>{t("Non-Veg")}</span>
            </button>
          </div>

          <div className="items-center gap-1.5 sm:gap-2 lg:gap-3 hidden sm:flex shrink-0">
            {activeTable && activeTable !== 'NEW_ORDER' && billType !== 'Delivery' && billType !== 'Takeaway' && !activeTable?.startsWith('DEL-') && !activeTable?.startsWith('TAK-') && orderId && (
              <button
                onClick={() => setShowTransfer(true)}
                className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center gap-1 relative z-20 cursor-pointer border border-primary/20 shadow-sm shrink-0"
                title={t('transferTable', { defaultValue: 'Transfer Table' })}
              >
                <ArrowRightLeft size={14} />
                <span className="hidden lg:inline">{t('Transfer')}</span>
              </button>
            )}

            {/* Customer CRM button beside Transfer Table */}
            <div className="relative flex items-center shrink-0">
              {customerPhone || customerName ? (
                <div className="flex items-center gap-1 bg-orange-50 border border-orange-200/90 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl shadow-xs">
                  <User size={13} className="text-orange-600 shrink-0" />
                  <button
                    type="button"
                    onClick={handleOpenCustomerModal}
                    className="text-xs font-bold text-orange-950 hover:underline flex items-center gap-1 cursor-pointer truncate max-w-[100px] sm:max-w-[130px]"
                    title={t("Click to edit customer details")}
                  >
                    <span className="truncate">{customerName || 'Customer'}</span>
                    {customerPhone && <span className="text-[10px] text-orange-600 font-mono hidden md:inline">({customerPhone})</span>}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomerPhone('');
                      setCustomerName('');
                      setCustomerInfo(null);
                    }}
                    className="p-0.5 hover:bg-orange-200/80 rounded-full text-orange-400 hover:text-orange-800 transition-colors ml-0.5 cursor-pointer"
                    title={t("Clear customer")}
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenCustomerModal}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-2 sm:px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title={t("Customer CRM - Add Name & Phone")}
                >
                  <UserPlus size={14} className="text-orange-600 shrink-0" />
                  <span className="hidden lg:inline">{t("Customer CRM")}</span>
                  <span className="lg:hidden">{t("CRM")}</span>
                </button>
              )}
            </div>

            {/* Sales stat badge - visible on large screens */}
            <div className="hidden lg:flex items-center gap-2 bg-background px-2.5 py-1 rounded-xl border border-border/50 shrink-0">
              <div className="flex flex-col items-end">
                <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1 leading-none">
                  {t('sales')} <TrendingUp size={10} className="text-success" />
                </p>
                <p className="text-xs font-bold text-text-main font-mono leading-tight">₹{dailyStats.sales.toLocaleString()}</p>
              </div>
            </div>

            <button
              onClick={() => setIsLayoutLocked(!isLayoutLocked)}
              className={`p-1.5 rounded-lg transition-all shrink-0 ${isLayoutLocked ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-primary hover:bg-primary/5'}`}
              title={isLayoutLocked ? "Unlock Layout" : "Lock Layout"}>

              {isLayoutLocked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
            <button
              onClick={toggleFullScreen}
              className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all shrink-0">

              {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:hidden px-3 pt-2 gap-2 shrink-0 bg-background border-b border-border/50 pb-2.5">
        <div className="flex gap-2">
          <button
            onClick={() => setMobileTab('menu')}
            className={`flex-1 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'menu' ?
                'bg-primary text-white shadow-md' :
                'bg-surface text-text-muted border border-border hover:bg-surface-hover'}`
            }>

            <span>🍽️ {t('menuItems')}</span>
          </button>
          <button
            id="mobile-cart-tab"
            data-mobile-cart-tab="true"
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 relative ${mobileTab === 'cart' ?
                'bg-primary text-white shadow-md' :
                'bg-surface text-text-muted border border-border hover:bg-surface-hover'}`
            }>

            <span>🛒 {t('currentOrder')}</span>
            {cart.length > 0 &&
              <span data-mobile-cart-badge="true" className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                {cart.length}
              </span>
            }
          </button>
        </div>

        {mobileTab === 'menu' &&
          <div className="relative group w-full mt-0.5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={16} />
            <input
              type="text"
              placeholder={t('searchDishes')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary text-xs text-text-main transition-all shadow-inner" />

          </div>
        }
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          <div className={`flex flex-col overflow-hidden bg-surface border-r border-border/50 ${mobileTab === 'cart' ? 'hidden md:flex' : 'flex'} flex-1 transition-all duration-300`
          }>
            <MenuGrid
              onSelectItem={addToCart}
              activeTable={activeTable}
              billType={billType}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              foodTypeFilter={foodTypeFilter}
              onFoodTypeFilterChange={setFoodTypeFilter}
              isLayoutLocked={isLayoutLocked}
              onNavigate={onNavigate}
              userRole={userRole}
              isLocked={orderStatus === 'Paid' || orderStatus === 'Cancelled' || (orderStatus === 'Billed' && !hasPendingLocalChanges.current)}
              orderStatus={orderStatus}
            />
          </div>

          <div
            style={typeof window !== 'undefined' && window.innerWidth >= 768 ? {
              width: isCartCollapsed ? 0 : (window.innerWidth < 1024 ? Math.min(rightPanelWidth, 360) : rightPanelWidth),
              maxWidth: '45vw',
              minWidth: isCartCollapsed ? 0 : (window.innerWidth < 1024 ? '300px' : '360px')
            } : { width: '100%', maxWidth: '100vw' }}
            className={`flex flex-col bg-surface h-full ${mobileTab === 'menu' ? 'hidden md:flex' : 'flex'} ${isCartCollapsed ? 'md:w-0 lg:w-0 border-none opacity-0 md:opacity-100 overflow-visible' : 'border-l border-border/50 overflow-visible'} shrink-0 md:shrink-0 w-full md:w-auto transition-none relative`}>


            {/* Drag Handle */}
            {!isCartCollapsed && !isLayoutLocked &&
              <div
                onMouseDown={startResizing}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 bg-transparent z-40 transition-colors" />

            }

            <button
              type="button"
              onClick={() => setIsCartCollapsed(!isCartCollapsed)}
              className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-30 bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-xl rounded-l-2xl py-3.5 px-2 hover:opacity-95 transition-all items-center gap-1 border-y border-l border-white/25 cursor-pointer group ${
                isCartCollapsed ? 'right-0' : 'left-0 -translate-x-full'
              }`}
              title={isCartCollapsed ? t('expandCart') : t('collapseCart')}>
              {isCartCollapsed ? (
                <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
              ) : (
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
            <div className={`bill-summary-container w-full h-full flex flex-col overflow-hidden ${isCartCollapsed ? 'hidden' : 'flex'}`}>
              <BillSummary
                orderId={orderId}
                cart={cart}
                hasUnprintedItems={hasUnprintedItems}
                updateQuantity={updateQuantity}
                updateItemNote={updateItemNote}
                subtotal={subtotal}
                taxAmount={taxAmount}
                discountAmount={discountAmount}
                total={total}
                userRole={userRole}

                orderStatus={orderStatus}
                activeTable={activeTable}
                onSaveOrder={handleSaveOrder}
                onHoldOrder={handleHoldOrder}
                onGenerateBill={handleGenerateBill}
                onSettleBill={() => setShowPayment(true)}
                onPrintKOT={handlePrintKOT}
                onPrintBill={() => setShowInvoice(true)}
                onReopenOrder={handleReopenOrder}
                onTransferTable={() => {
                  if (billType !== 'Delivery' && billType !== 'Takeaway' && !activeTable?.startsWith('DEL-') && !activeTable?.startsWith('TAK-')) {
                    setShowTransfer(true);
                  }
                }}
                onSelectTable={setActiveTable}

                discount={discount}
                setDiscount={handleDiscountChange}
                taxRate={taxRate}
                setTaxRate={setTaxRate}
                billType={billType}
                setBillType={setBillType}
                loading={loading}
                actionLoading={actionLoading}

                orderSource={orderSource}
                setOrderSource={handleOrderSourceChange}

                customerPhone={customerPhone}
                setCustomerPhone={setCustomerPhone}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerInfo={customerInfo}
                deliveryCharge={deliveryCharge}
                setDeliveryCharge={handleDeliveryChargeChange}
                containerCharge={containerCharge}
                setContainerCharge={handleContainerChargeChange}
                hasPendingChanges={hasPendingLocalChanges.current}
                openOrders={openOrdersList}
                reservations={reservations}
                onOpenCustomerModal={handleOpenCustomerModal} />
            </div>

          </div>
        </div>

        {cart.length > 0 && mobileTab === 'menu' &&
          <div className="md:hidden p-3 bg-surface border border-border rounded-2xl shadow-xl flex items-center justify-between shrink-0 animate-bounce-short">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted font-bold uppercase">{t('total')} ({cart.reduce((sum, item) => item.isCancelled ? sum : sum + item.quantity - (item.cancelledQuantity || 0), 0)} {t('items')})</span>
              <span className="text-base font-black text-primary">₹{total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setMobileTab('cart')}
              className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary-hover flex items-center gap-2">

              <span>{t('viewOrder')}</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">➔</span>
            </button>
          </div>
        }
      </div>

      {showPayment &&
        <PaymentModal
          total={total}
          billNumber={billNumber}
          tableNo={activeTable}
          isLoading={loading}
          onClose={() => setShowPayment(false)}
          onComplete={handleSettleBill} />

      }

      {showInvoice && (() => {
        const billToShow = completedBill || {
          _id: orderId,
          billNumber: billNumber,
          status: orderStatus,
          items: cart,
          subtotal: subtotal,
          tax: taxVal,
          discount: discountAmount,
          total: total,
          billType: billType,
          tableNo: activeTable,
          orderSource: orderSource,
          customerName: customerName,
          customerPhone: customerPhone,
          deliveryCharge: deliveryCharge,
          containerCharge: containerCharge,
          createdAt: new Date()
        };
        return (
          <Invoice
            bill={billToShow}
            onClose={handleFinish}
            onSave={handleFinish} />
        );
      })()}

      {showKOT && activeKOTData &&
        <KOT
          order={activeKOTData}
          onClose={() => {
            setShowKOT(false);
            setActiveKOTData(null);
          }} />

      }

      {showTransfer && billType !== 'Delivery' && billType !== 'Takeaway' && !activeTable?.startsWith('DEL-') && !activeTable?.startsWith('TAK-') &&
        <TransferTableModal
          floors={floors}
          currentTable={activeTable}
          currentOrderId={orderId}
          openOrdersList={openOrdersList}
          isLoading={loading}
          onClose={() => setShowTransfer(false)}
          onTransfer={handleTransferTable} />
      }

      {toast &&
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)} />

      }

      <CancelOrderModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancelOrder}
        requirePin={(() => {
          const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          return s.customLocks?.['cancel-order']?.enabled !== false;
        })()}
        validPins={[
          JSON.parse(localStorage.getItem('restaurantSettings') || '{}').customLocks?.['cancel-order']?.pin,
          JSON.parse(localStorage.getItem('restaurantSettings') || '{}').ownerPin,
          '1234'
        ].filter(Boolean)} />

      {/* Customer CRM Modal (Only Name and Phone Number) */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-orange-500/10 to-amber-500/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-500 text-white rounded-xl shadow-xs">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-gray-900 dark:text-white">{t("Customer CRM")}</h3>
                  <p className="text-[11px] text-gray-500">{t("Add customer name & phone number")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerCRM} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  {t("Phone Number (10 Digits)")}
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={tempCustomerPhone}
                    onChange={(e) => handleCrmPhoneChange(e.target.value)}
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all font-mono"
                  />
                </div>
                {crmLoading && (
                  <p className="text-[11px] text-orange-600 mt-1 flex items-center gap-1 font-medium animate-pulse">
                    Checking CRM records...
                  </p>
                )}
                {crmCustomerFound && (
                  <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-bold">
                    ✓ Existing customer found ({crmCustomerFound.totalVisits || 1} visits)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  {t("Customer Name")}
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={tempCustomerName}
                    onChange={(e) => setTempCustomerName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={crmSaving}
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-500/20 hover:shadow-orange-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {crmSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{t("Save to Order")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>);

};

export default BillingPage;