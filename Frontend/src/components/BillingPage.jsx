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
import { getCachedOpenOrders } from '../db/offlineDb';
import { Search, UtensilsCrossed, Maximize, Minimize, TrendingUp, ShoppingBag, LayoutGrid, ArrowRightLeft, Menu, ChevronLeft, ChevronRight, ChevronDown, Lock, Unlock } from 'lucide-react';
import useDebounce from '../hooks/useDebounce';
import Invoice from './Invoice';
import CancelOrderModal from './CancelOrderModal';
import TransferTableModal from './TransferTableModal';
import { io } from 'socket.io-client';
import { useLanguage } from '../context/LanguageContext';
import { getNotificationSocket } from '../hooks/useNotifications';

const BillingPage = ({ initialTable, onOrderUpdate, onNavigate, onGoBack, userRole = 'Admin' }) => {
  const { t } = useLanguage();
  const [activeTable, setActiveTable] = useState(initialTable || '');
  const [floors, setFloors] = useState([]);
  const [openOrdersList, setOpenOrdersList] = useState([]);
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
    }).catch(() => {});

    fetchOpenOrdersList();

    // Set up Real-Time WebSocket connection
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

    // Listen for real-time events
    const handleRealtimeUpdate = (data) => {
      fetchOpenOrdersList();
      if (data && data.tableNo) {
        window.dispatchEvent(new CustomEvent('remoteOrderUpdated', { detail: data }));
      } else {
        window.dispatchEvent(new CustomEvent('remoteOrderUpdated', { detail: {} }));
      }
    };

    socket.on('orderUpdated', handleRealtimeUpdate);
    socket.on('cancellationResolved', handleRealtimeUpdate);
    socket.on('itemCancellationRequested', handleRealtimeUpdate);
    socket.on('kotUpdated', handleRealtimeUpdate);
    socket.on('prepTimeUpdated', handleRealtimeUpdate);
    socket.on('billSettled', fetchOpenOrdersList);
    socket.on('tableStatusChanged', fetchOpenOrdersList);
    socket.on('newKOT', handleRealtimeUpdate);

    const handleOfflineSave = (e) => {
      showToast(`⚠️ ${e.detail?.message || 'Order saved offline. Will sync when backend reconnects.'}`, 'error');
    };
    window.addEventListener('offlineOrderSaved', handleOfflineSave);

    return () => {
      socket.disconnect();
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
        } catch (error) {console.error('Error loading spaces:', error);}
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
      } catch (error) {console.error('Error syncing spaces:', error);}
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
  const [showInvoice, setShowInvoice] = useState(false);
  const [showKOT, setShowKOT] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [activeKOTData, setActiveKOTData] = useState(null);
  const [completedBill, setCompletedBill] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [dailyStats, setDailyStats] = useState({ sales: 0, orders: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);

  const [loading, setLoading] = useState(false);
  const newlyGeneratedTables = useRef(new Set());
  // Tracks the last time user manually edited the cart (add/remove/qty change)
  // Background fetches are suppressed for 8s after any local edit to prevent
  // the 3s poll or socket orderUpdated from reverting local-first cart state.
  const lastLocalEditTime = useRef(0);
  const LOCAL_EDIT_LOCK_MS = 8000; // 8 seconds of protection after any cart edit

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
        // eslint-disable-next-line
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
      const existingOrder = openOrdersList.find((o) => o.tableNo?.startsWith(prefix) && (o.status === 'Open' || o.status === 'Billed'));
      if (existingOrder && !initialTable) {
        // eslint-disable-next-line
        setActiveTable(existingOrder.tableNo);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billType, openOrdersList]);

  useEffect(() => {
    if (activeTable && !newlyGeneratedTables.current.has(activeTable)) {
      fetchActiveOrder(activeTable, true);
    } else if (activeTable && newlyGeneratedTables.current.has(activeTable)) {
      if (cart.length === 0) {
        // eslint-disable-next-line
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
      }
    }

    const handleRemoteOrderUpdate = (e) => {
      const data = e.detail;
      if (data) {
        if (!data.tableNo || data.tableNo === activeTable) {
          // Suppress socket-triggered fetch if user just edited the cart
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
    // Reduced from 3s to 5s to give local edits more breathing room
    const pollInterval = setInterval(() => {
      if (activeTable) {
        // Only background-fetch if user hasn't edited cart in the last LOCAL_EDIT_LOCK_MS
        const msSinceEdit = Date.now() - lastLocalEditTime.current;
        if (msSinceEdit > LOCAL_EDIT_LOCK_MS) {
          fetchActiveOrder(activeTable, false, true);
        }
      }
      fetchOpenOrdersList();
    }, 5000);

    return () => {
      window.removeEventListener('remoteOrderUpdated', handleRemoteOrderUpdate);
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable]);

  useEffect(() => {
    const socket = getNotificationSocket();
    if (!socket) return;

    const handleKotUpdatedSocket = (data) => {
      if (data && (data.tableNo === activeTable || data.orderId === orderId)) {
        if (data.itemId || data.itemName) {
          setCart((prevCart) =>
            prevCart.map((i) => {
              if (
                (data.itemId && i._id?.toString() === data.itemId?.toString()) ||
                (data.itemName && i.name === data.itemName)
              ) {
                return { ...i, status: data.status };
              }
              return i;
            })
          );
        }
        fetchActiveOrder(activeTable, false, true);
      }
    };

    socket.on('kotUpdated', handleKotUpdatedSocket);
    return () => {
      socket.off('kotUpdated', handleKotUpdatedSocket);
    };
  }, [activeTable, orderId]);

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
        } catch (error) {console.error('Error fetching customer:', error);}
      };
      fetchCustomer();
    } else {
      // eslint-disable-next-line
      setCustomerInfo(null);
    }
  }, [customerPhone]);

  async function fetchActiveOrder(tableToFetch = activeTable, forceReset = false, isBackground = false) {
    if (!tableToFetch) return;

    // Helper to check orders array and apply order immediately (0ms delay)
    const checkAndApplyCache = (ordersArr) => {
      if (!ordersArr || !Array.isArray(ordersArr) || ordersArr.length === 0) return false;
      const cleanTarget = tableToFetch.trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
      const targetTablePart = tableToFetch.includes(' - ') ? tableToFetch.split(' - ').slice(1).join(' - ').trim().replace(/[^a-z0-9]/gi, '').toLowerCase() : cleanTarget;

      const cached = ordersArr.find(o => {
        if (!o.tableNo || (o.status !== 'Open' && o.status !== 'Billed')) return false;
        const oClean = o.tableNo.trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
        const oTablePart = o.tableNo.includes(' - ') ? o.tableNo.split(' - ').slice(1).join(' - ').trim().replace(/[^a-z0-9]/gi, '').toLowerCase() : oClean;
        return oClean === cleanTarget || oClean === targetTablePart || oTablePart === cleanTarget || oTablePart === targetTablePart;
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

        const validItems = cached.items.filter(i => i.quantity > 0 || i.isCancelled).map(i => ({
          ...i,
          status: kotStatusMap[i._id?.toString()] || kotStatusMap[i.name] || i.status
        }));

        if (validItems.length > 0) {
          setCart(validItems);
          setOrderId(cached._id);
          setOrderStatus(cached.status);
          setBillNumber(cached.billNumber);
          setBillType(cached.billType || 'Dine-In');
          setCustomerPhone(cached.customerPhone || '');
          setCustomerName(cached.customerName || '');
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
      } catch (e) {}
    }

    if (!hasInstantCache && !isBackground) {
      setLoading(true);
    }

    try {
      let order = await getActiveOrder(tableToFetch);
      if (!order && openOrdersList && openOrdersList.length > 0) {
        const cleanTarget = tableToFetch.trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
        const targetTablePart = tableToFetch.includes(' - ') ? tableToFetch.split(' - ').slice(1).join(' - ').trim().replace(/[^a-z0-9]/gi, '').toLowerCase() : cleanTarget;

        order = openOrdersList.find(o => {
          if (!o.tableNo || (o.status !== 'Open' && o.status !== 'Billed')) return false;
          const oClean = o.tableNo.trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
          const oTablePart = o.tableNo.includes(' - ') ? o.tableNo.split(' - ').slice(1).join(' - ').trim().replace(/[^a-z0-9]/gi, '').toLowerCase() : oClean;
          return oClean === cleanTarget || oClean === targetTablePart || oTablePart === cleanTarget || oTablePart === targetTablePart;
        });
      }

      if (order) {
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

        setCart((prevCart) => {
          const backendItems = (order.items || []).filter(i => i.quantity > 0 || i.isCancelled).map(i => ({
            ...i,
            status: kotStatusMap[i._id?.toString()] || kotStatusMap[i.name] || i.status
          }));

          if (forceReset || !prevCart || prevCart.length === 0) return backendItems;

          // If user edited the cart recently, protect local state:
          // never reduce quantities below what the user set, and keep local-only items
          const msSinceEdit = Date.now() - lastLocalEditTime.current;
          const isEditLocked = msSinceEdit < LOCAL_EDIT_LOCK_MS;

          // Preserve local unsaved draft items (items in local cart but not yet in backend)
          const localDrafts = prevCart.filter(localItem =>
            !backendItems.some(bItem => bItem.name === localItem.name || (localItem._id && bItem._id?.toString() === localItem._id?.toString()))
          );

          const merged = backendItems.map(bItem => {
            const localMatch = prevCart.find(localItem => localItem.name === bItem.name || (localItem._id && bItem._id?.toString() === localItem._id?.toString()));
            if (localMatch) {
              if (isEditLocked) {
                // Within edit lock window: always trust local quantity & keep local state
                return { ...bItem, quantity: localMatch.quantity, printedQuantity: localMatch.printedQuantity };
              }
              // Outside lock window: take the higher qty (backend won, but preserve local if higher)
              if (localMatch.quantity > bItem.quantity) {
                return { ...bItem, quantity: localMatch.quantity };
              }
            }
            return bItem;
          });

          // If edit-locked, also keep any local items that backend didn't return yet
          if (isEditLocked) {
            return [...merged, ...localDrafts];
          }
          return [...merged, ...localDrafts];
        });
        setOrderId(order._id);
        setOrderStatus(order.status);
        setBillNumber(order.billNumber);
        setBillType(order.billType || 'Dine-In');
        if (order.billType === 'Delivery') {
          setOrderSource(order.orderSource || 'Direct');
        }
        setCustomerPhone(order.customerPhone || '');
        setCustomerName(order.customerName || '');
        if (!isBackground || forceReset) {
          setDiscount({
            type: order.discountType || 'percentage',
            value: order.discountValue || ''
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

  const autoSaveOrder = async (cartToSave, tableNo) => {
    if (!tableNo || cartToSave.length === 0) return;
    try {
      const orderData = {
        tableNo: tableNo,
        items: cartToSave,
        billType,
        customerName,
        customerPhone,
        discountType: discount.type,
        discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
        tax: taxVal,
        ...(orderId && !orderId.startsWith('offline_') && { id: orderId }),
        ...(billType === 'Delivery' && { orderSource })
      };
      const savedOrder = await saveOrder(orderData);
      if (savedOrder && savedOrder._id) {
        setOrderId(savedOrder._id);
      }
      // Don't call fetchOpenOrdersList() here — the socket 'orderUpdated' event
      // will refresh the open orders list, avoiding a double-fetch that could
      // cause a stale backend response to overwrite local cart state.
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Auto-save order error:', error);
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
    if (orderStatus !== 'Open') {
      showToast(t('orderLocked'), 'error');
      return;
    }
    const existing = cart.find((i) => i.name === item.name);
    let newCart;
    if (existing) {
      showToast(`${t('increasedQty', { defaultValue: 'Increased quantity of' })} ${item.name}`, 'success');
      newCart = cart.map((i) => i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      showToast(`${t('addedToOrder', { defaultValue: 'Added to order' })} ${item.name}`, 'success');
      newCart = [...cart, { ...item, quantity: 1 }];
    }
    setCart(newCart);
    lastLocalEditTime.current = Date.now(); // Mark local edit time - locks out background fetch for 8s
    autoSaveOrder(newCart, currentTable);
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
    if (orderStatus !== 'Open') {
      showToast(t('orderLocked'), 'error');
      return;
    }
    const newCart = cart.map((i) => {
      if (i._id === id || i.name === id) {
        const newQty = Math.max(0, i.quantity + delta);
        if (newQty === 0) showToast(`${i.name} ${t('removedFromOrder')}`, 'info');
        return { ...i, quantity: newQty };
      }
      return i;
    }).filter((i) => i.quantity > 0);
    setCart(newCart);
    lastLocalEditTime.current = Date.now(); // Mark local edit time
    autoSaveOrder(newCart, currentTable);
  };
  const calculateSubtotal = () => cart.reduce((sum, item) => {
    if (item.isCancelled) return sum;
    const activeQty = item.quantity - (item.cancelledQuantity || 0);
    return sum + (item.price * activeQty);
  }, 0);

  const hasUnprintedItems = cart.some((item) => {
    if (item.isCancelled) return false;
    const qty = item.quantity || 0;
    const printed = item.printedQuantity || 0;
    return qty > printed;
  });

  const calculateDiscount = (subtotal) => {
    const val = discount.value === '' ? 0 : parseFloat(discount.value) || 0;
    if (discount.type === 'percentage') {
      return subtotal * val / 100;
    }
    return val;
  };

  const updateItemNote = (identifier, specialNote) => {
    if (orderStatus !== 'Open') {
      showToast(t('orderLocked'), 'error');
      return;
    }
    setCart((prev) => prev.map((i) => {
      const match = i._id && identifier === i._id || !i._id && i.name === identifier;
      if (match) return { ...i, specialNote };
      return i;
    }));
  };

  const subtotal = calculateSubtotal();
  const discountAmount = calculateDiscount(subtotal);
  const taxableAmount = subtotal - discountAmount;
  const taxVal = taxRate === '' ? 0 : parseFloat(taxRate) || 0;
  const taxAmount = taxableAmount * taxVal / 100;

  const additionalCharges = parseFloat(deliveryCharge || 0) + parseFloat(containerCharge || 0);
  const total = Math.round(taxableAmount + taxAmount + additionalCharges);

  const handleSaveOrder = async () => {
    if (!activeTable) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        const generatedOrderNo = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(generatedOrderNo);
        setActiveTable(generatedOrderNo);
        setTimeout(() => handleSaveOrderWithTable(generatedOrderNo), 100);
        return;
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }
    handleSaveOrderWithTable(activeTable);
  };

  const handleSaveOrderWithTable = async (tableNo) => {
    if (cart.length === 0) return;
    setLoading(true);
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
      showToast(t('orderSaved'), 'success');
      // Extend edit lock after save completes so poll doesn't overwrite confirmed state
      lastLocalEditTime.current = Date.now();
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error saving order:', error);
      const errorMessage = error.response?.data?.message || error.message;
      showToast(`${t('failedToSave')}: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  };



  // HOLD = SAVE: backend always stores with status 'Open' and marks table Occupied.
  // The "Hold Bills" counter in the header reflects all saved-but-unpaid Open orders.
  const handleHoldOrder = () => handleSaveOrder();


  const handleGenerateBill = async () => {
    if (!orderId || orderId.startsWith('offline_')) {
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

      setLoading(true);
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
          orderSource: billType === 'Delivery' ? orderSource : undefined
        };
        const savedOrder = await saveOrder(orderData);
        setOrderId(savedOrder._id);
        await generateBillAfterSave(savedOrder._id);
      } catch (error) {
        console.error('Error saving order before generating bill:', error);
        const errorMessage = error.response?.data?.message || error.message;
        showToast(`${t('failedToSave')}: ${errorMessage}`, 'error');
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    await generateBillAfterSave(orderId);
  };

  const generateBillAfterSave = async (orderIdToUse) => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      const cRate = s.enableCgst !== false ? s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5 : 0;
      const sRate = s.enableSgst !== false ? s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5 : 0;
      const gRate = s.enableGst === true ? s.gstRate !== undefined ? Number(s.gstRate) : 5 : 0;
      const totRate = cRate + sRate + gRate;

      let cAmt = 0,sAmt = 0,gAmt = 0;
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
        taxBreakdown: {
          cgst: cAmt,
          sgst: sAmt,
          igst: gAmt
        }
      };
      const billedOrder = await generateBill(orderIdToUse, billData);
      setOrderId(billedOrder._id);
      setOrderStatus('Billed');
      setBillNumber(billedOrder.billNumber);
      setCompletedBill(billedOrder);

      showToast(t('billGenerated'), 'success');
      if (onOrderUpdate) onOrderUpdate();
      // Always open Invoice/print modal immediately
      setShowInvoice(true);
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
            // Always show Invoice (print modal) for both Billed and Paid orders
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
    }
  };

  const handleSettleBill = (paymentData) => {
    completeSettlement(paymentData);
  };

  const completeSettlement = async (paymentData) => {
    if (orderStatus === 'Paid') {
      showToast(t('billAlreadySettled'), 'info');
      setShowPayment(false);
      return;
    }

    setLoading(true);
    try {
      let currentId = orderId;

      if (billType === 'Dine-In' && !currentId) {
        showToast(t('pleaseFireKOTFirst'), 'error');
        setLoading(false);
        return;
      }

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
      if (orderStatus !== 'Billed' && orderStatus !== 'Paid') {
        const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
        const cRate = s.enableCgst !== false ? s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5 : 0;
        const sRate = s.enableSgst !== false ? s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5 : 0;
        const gRate = s.enableGst === true ? s.gstRate !== undefined ? Number(s.gstRate) : 5 : 0;
        const totRate = cRate + sRate + gRate;

        let cAmt = 0,sAmt = 0,gAmt = 0;
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
        upiApp: paymentData.upiApp
      });
      setOrderStatus('Paid');
      setShowPayment(false);

      setCompletedBill({
        ...(billDetails || settledOrder),
        ...settledOrder,
        items: cart,
        status: 'Paid',
        paymentMode: paymentData.mode,
        billNumber: currentBillNum || settledOrder?.billNumber,
        tableNo: settledOrder?.tableNo || billDetails?.tableNo || activeTable
      });

      showToast(t('billSettled'), 'success');
      fetchDailyStats();
      if (onOrderUpdate) onOrderUpdate();
      setShowInvoice(true);
    } catch (error) {
      console.error('Error settling bill:', error);
      setToast({ message: error.response?.data?.message || error.message || t('failedToSettle'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintKOT = async () => {
    if (!hasUnprintedItems) {
      showToast(t('KOT already fired for current order items. Status: Preparing'), 'info');
      return;
    }
    if (!activeTable) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        const generatedOrderNo = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(generatedOrderNo);
        setActiveTable(generatedOrderNo);
        setTimeout(() => handlePrintKOTWithTable(generatedOrderNo), 100);
        return;
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }
    handlePrintKOTWithTable(activeTable);
  };

  const handlePrintKOTWithTable = async (tableNo) => {
    try {
      setLoading(true);
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
        containerCharge: parseFloat(containerCharge || 0)
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

      const response = await apiGenerateKOT(currentId, cart);

      if (response.bill && response.bill.items) {
        setCart(response.bill.items);
      }

      let kotData = response.kot;
      if (response._offline) {
        kotData = {
          items: cart,
          createdAt: new Date(),
          kotNumber: 'OFFLINE-SYNC'
        };
      }

      setActiveKOTData({
        ...kotData,
        tableNo: activeTable,
        billType,
        orderSource
      });
      setShowKOT(true);

    } catch (error) {
      console.error('Error generating KOT:', error);
      showToast(error.response?.data?.message || t('failedToGenerateKOT'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (completedBill && completedBill.status === 'Paid') {
      showToast(`${t('billSaved')} ${completedBill.billNumber || ''}`, 'success');
    }

    setShowInvoice(false);
    setCart([]);
    setOrderId(null);
    setOrderStatus('Open');
    setBillNumber(null);
    setCompletedBill(null);
    fetchActiveOrder();

    fetchDailyStats();

    if (onOrderUpdate) onOrderUpdate();

    if (onGoBack) {
      onGoBack();
    }
  };

  const handleReopenOrder = async () => {
    if (orderStatus === 'Open') {
      showToast(t('Order is open for editing. Select or update items in your cart.'), 'info');
      return;
    }
    if (!orderId) {
      showToast(t('No saved bill selected to edit'), 'warning');
      return;
    }
    try {
      setLoading(true);
      await apiReopenOrder(orderId);
      setOrderStatus('Open');
      showToast(t('orderReopened'), 'success');
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error reopening order:', error);
      showToast(error.response?.data?.message || t('failedToReopenOrder'), 'error');
    } finally {
      setLoading(false);
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
      <div className="h-14 flex items-center justify-between px-3 sm:px-6 bg-surface border-b border-border/50 shrink-0 relative z-[1]">

        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-1.5 hover:bg-surface/50 transition-colors focus-within:ring-2 focus-within:ring-primary/20 cursor-pointer z-[1]">
            <LayoutGrid size={16} className="text-text-muted shrink-0 pointer-events-none" />
            <div className="flex items-center pointer-events-none">
              <span className="font-bold text-text-main text-sm truncate max-w-[180px]">
                {activeTable ?
                activeTable === 'NEW_ORDER' ? t('newOrder') : activeTable :
                t('selectTable', { defaultValue: 'Select Table' })}
              </span>
              <ChevronDown size={14} className="text-text-muted ml-1 shrink-0" />
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
                    setActiveTable(e.target.value);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0">
                
                  <option value="NEW_ORDER" className="bg-surface text-primary font-bold">+ {t('newOrder')}</option>
                  {openOrdersList.
                filter((o) => o.tableNo?.startsWith(billType === 'Delivery' ? 'DEL-' : 'TAK-')).
                map((o) =>
                <option key={o._id} value={o.tableNo} className="bg-surface text-white">
                        {o.tableNo} ({o.status} - ₹{o.total || 0})
                      </option>
                )
                }
                  {activeTable && !openOrdersList.some((o) => o.tableNo === activeTable) &&
                <option value={activeTable} className="bg-surface text-white">
                      {activeTable} ({t('newCurrent')})
                    </option>
                }
                </select> :

              <TableDropdown
                floors={floors}
                activeTable={activeTable}
                align="left"
                onSelect={(val) => setActiveTable(val)}
                wrapperClass="absolute inset-0 w-full h-full z-10"
                customButton={<div className="absolute inset-0 w-full h-full cursor-pointer z-10" />}
              />
            }
          </div>
        </div>

        <div className="items-center gap-6 hidden sm:flex">
          {activeTable && activeTable !== 'NEW_ORDER' && billType !== 'Delivery' && billType !== 'Takeaway' && orderId && (
            <button
              onClick={() => setShowTransfer(true)}
              className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-1.5 relative z-20 cursor-pointer border border-primary/20 shadow-sm"
              title={t('transferTable', { defaultValue: 'Transfer Table' })}
            >
              <ArrowRightLeft size={16} />
              <span className="hidden sm:inline">{t('Transfer')}</span>
            </button>
          )}

          <div className="flex items-center gap-4 bg-background px-3 py-1.5 rounded-xl border border-border/50">
            <div className="flex flex-col items-end">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                {t('sales')} <TrendingUp size={10} className="text-success" />
              </p>
              <p className="text-sm font-bold text-text-main font-mono">₹{dailyStats.sales.toLocaleString()}</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsLayoutLocked(!isLayoutLocked)}
            className={`p-2 rounded-lg transition-all ${isLayoutLocked ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-primary hover:bg-primary/5'}`}
            title={isLayoutLocked ? "Unlock Layout" : "Lock Layout"}>
            
            {isLayoutLocked ? <Lock size={20} /> : <Unlock size={20} />}
          </button>
          <button
            onClick={toggleFullScreen}
            className="p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all">
            
            {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:hidden px-3 pt-2 gap-2 shrink-0 bg-background border-b border-border/50 pb-2.5">
        <div className="flex gap-2">
          <button
            onClick={() => setMobileTab('menu')}
            className={`flex-1 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'menu' ?
            'bg-primary text-white shadow-md' :
            'bg-surface text-text-muted border border-border hover:bg-surface-hover'}`
            }>
            
            <span>🍽️ {t('menuItems')}</span>
          </button>
          <button
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 relative ${
            mobileTab === 'cart' ?
            'bg-primary text-white shadow-md' :
            'bg-surface text-text-muted border border-border hover:bg-surface-hover'}`
            }>
            
            <span>🛒 {t('currentOrder')}</span>
            {cart.length > 0 &&
            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
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
          <div className={`flex flex-col overflow-hidden bg-surface border-r border-border/50 ${
          mobileTab === 'cart' ? 'hidden md:flex' : 'flex'} flex-1 transition-all duration-300`
          }>
            <MenuGrid onSelectItem={addToCart} searchTerm={searchTerm} onSearchChange={setSearchTerm} isLayoutLocked={isLayoutLocked} onNavigate={onNavigate} userRole={userRole} />
          </div>

          <div
            style={typeof window !== 'undefined' && window.innerWidth >= 768 ? { width: isCartCollapsed ? 0 : rightPanelWidth } : { width: '100%', maxWidth: '100vw' }}
            className={`flex flex-col bg-surface ${
            mobileTab === 'menu' ? 'hidden md:flex' : 'flex'} ${
            isCartCollapsed ? 'md:w-0 lg:w-0 border-none opacity-0 md:opacity-100 overflow-visible' : 'border-l border-border/50 overflow-visible'} shrink-0 md:shrink-0 w-full md:w-auto transition-none relative`}>
            
            
            {/* Drag Handle */}
            {!isCartCollapsed && !isLayoutLocked &&
            <div
              onMouseDown={startResizing}
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 bg-transparent z-40 transition-colors" />

            }
            
            <button
              onClick={() => setIsCartCollapsed(!isCartCollapsed)}
              className="hidden md:flex absolute top-1/2 -translate-y-1/2 -left-3.5 z-30 bg-white border border-border shadow-md rounded-full p-1.5 hover:bg-gray-50 transition-all text-gray-500 hover:text-primary"
              title={isCartCollapsed ? t('expandCart') : t('collapseCart')}>
              
              {isCartCollapsed ? <ChevronLeft size={14} className="ml-0.5" /> : <ChevronRight size={14} className="mr-0.5" />}
            </button>
            <div className={`w-full h-full flex flex-col overflow-hidden ${isCartCollapsed ? 'hidden' : 'flex'}`}>
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
                onCancelOrder={handleCancelOrder}
                onTransferTable={() => setShowTransfer(true)}
                floors={floors}
                onSelectTable={setActiveTable}

                discount={discount}
                setDiscount={setDiscount}
                taxRate={taxRate}
                setTaxRate={setTaxRate}
                billType={billType}
                setBillType={setBillType}
                loading={loading}

                orderSource={orderSource}
                setOrderSource={setOrderSource}

                customerPhone={customerPhone}
                setCustomerPhone={setCustomerPhone}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerInfo={customerInfo} />
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

      {showInvoice &&
      <Invoice
        bill={completedBill || {
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
          createdAt: new Date()
        }}
        onClose={handleFinish}
        onSave={handleFinish} />

      }

      {showKOT && activeKOTData &&
      <KOT
        order={activeKOTData}
        onClose={() => {
          setShowKOT(false);
          setActiveKOTData(null);
        }} />

      }

      {showTransfer &&
      <TransferTableModal
        floors={floors}
        currentTable={activeTable}
        currentOrderId={orderId}
        openOrdersList={openOrdersList}
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
        validPin={JSON.parse(localStorage.getItem('restaurantSettings') || '{}').ownerPin || '1234'} />
      
    </div>);

};

export default BillingPage;