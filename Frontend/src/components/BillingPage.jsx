import React, { useState, useEffect, useRef } from 'react';
import MenuGrid from './MenuGrid';
import BillSummary from './BillSummary';
import PaymentModal from './PaymentModal';
import KOT from './KOT';
import Toast from './Toast';
import { getActiveOrder, saveOrder, generateBill, settleBill, apiGenerateKOT, apiReopenOrder, apiCancelOrder, apiTransferTable, getOpenOrders } from '../api/billing';
import { Search, UtensilsCrossed, Maximize, Minimize, TrendingUp, ShoppingBag, LayoutGrid, ArrowRightLeft, Menu } from 'lucide-react';
import useDebounce from '../hooks/useDebounce';
import Invoice from './Invoice';
import CancelOrderModal from './CancelOrderModal';
import TransferTableModal from './TransferTableModal';
import { io } from 'socket.io-client';

const BillingPage = ({ initialTable, onOrderUpdate, onNavigate, userRole = 'Admin', onToggleMenu }) => {
  const [activeTable, setActiveTable] = useState(initialTable || '');
  const [floors, setFloors] = useState([]);
  const [openOrdersList, setOpenOrdersList] = useState([]);

  useEffect(() => {
    fetchOpenOrdersList();
    
    // Set up Real-Time WebSocket connection
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

    // Listen for real-time events
    socket.on('orderUpdated', fetchOpenOrdersList);
    socket.on('billSettled', fetchOpenOrdersList);
    socket.on('tableStatusChanged', fetchOpenOrdersList);
    socket.on('newKOT', fetchOpenOrdersList);

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchOpenOrdersList = async () => {
    try {
      const data = await getOpenOrders();
      setOpenOrdersList(data || []);
    } catch (e) {
      console.error('Error fetching open orders list:', e);
    }
  };

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
        } catch (e) {}
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
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
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
      } catch (e) {}
    };
    syncSpacesFromBackend();

    window.addEventListener('spacesUpdated', loadSpaces);
    return () => window.removeEventListener('spacesUpdated', loadSpaces);
  }, []);
  // ... (rest of state)

  // ... (rest of code)

        {/* Table Selector */}
        <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-1.5">
          <LayoutGrid size={16} className="text-text-muted" />
          <select 
            value={activeTable} 
            onChange={(e) => setActiveTable(e.target.value)}
            className="bg-transparent font-bold text-text-main focus:outline-none text-sm"
          >
            <option value="">Select Table</option>
            {[...Array(20)].map((_, i) => (
              <option key={i} value={`TBL-${String(i + 1).padStart(2, '0')}`}>
                Table {String(i + 1).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
  const [cart, setCart] = useState([]);
  const [mobileTab, setMobileTab] = useState('menu'); // 'menu' or 'cart'
  const [orderId, setOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState('Open'); // Open, Billed, Paid
  const [billNumber, setBillNumber] = useState(null);
  
  const [billType, setBillType] = useState(initialTable ? (initialTable.startsWith('DEL-') ? 'Delivery' : (initialTable.startsWith('TAK-') ? 'Takeaway' : 'Dine-In')) : 'Dine-In');
  const [taxRate, setTaxRate] = useState(''); 
  const [discount, setDiscount] = useState({ type: 'percentage', value: '' });
  
  // Delivery / CRM fields
  const [orderSource, setOrderSource] = useState('Direct');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerInfo, setCustomerInfo] = useState(null);
  
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
  
  const [loading, setLoading] = useState(false);
  const newlyGeneratedTables = useRef(new Set());
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Sync when initialTable changes from parent (e.g. clicking an order in Active Orders)
  useEffect(() => {
    if (initialTable) {
      setActiveTable(initialTable);
      if (initialTable.startsWith('DEL-')) {
        setBillType('Delivery');
      } else if (initialTable.startsWith('TAK-')) {
        setBillType('Takeaway');
      } else {
        setBillType('Dine-In');
      }
    }
  }, [initialTable]);

  // Auto-select existing or generate delivery/takeaway order number when Delivery or Takeaway is selected
  useEffect(() => {
    if ((billType === 'Delivery' || billType === 'Takeaway') && (!activeTable || !activeTable.startsWith(billType === 'Delivery' ? 'DEL-' : 'TAK-'))) {
      const prefix = billType === 'Delivery' ? 'DEL-' : 'TAK-';
      const existingOrder = openOrdersList.find(o => o.tableNo?.startsWith(prefix) && (o.status === 'Open' || o.status === 'Billed'));
      if (existingOrder && !initialTable) {
        setActiveTable(existingOrder.tableNo);
      } else {
        const timestamp = Date.now().toString().slice(-6);
        const generatedOrderNo = `${prefix}${timestamp}`;
        newlyGeneratedTables.current.add(generatedOrderNo);
        setActiveTable(generatedOrderNo);
      }
    } else if (billType === 'Dine-In' && activeTable && (activeTable.startsWith('DEL-') || activeTable.startsWith('TAK-'))) {
      setActiveTable('');
    }
  }, [billType, openOrdersList]);

  // Fetch active order when table changes
  useEffect(() => {
    if (activeTable && !newlyGeneratedTables.current.has(activeTable)) {
      fetchActiveOrder();
    } else if (activeTable && newlyGeneratedTables.current.has(activeTable)) {
      // It's a new table, make sure the cart is clear initially (unless user already added items)
      if (cart.length === 0) {
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
      }
    }
  }, [activeTable]);

  useEffect(() => {
    fetchDailyStats();
  }, []);

  useEffect(() => {
    if (customerPhone && customerPhone.length === 10) {
      const fetchCustomer = async () => {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
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
        } catch (e) {}
      };
      fetchCustomer();
    } else {
      setCustomerInfo(null);
    }
  }, [customerPhone]);

  const fetchActiveOrder = async () => {
    if (!activeTable) return;
    setLoading(true);
    try {
      const order = await getActiveOrder(activeTable);
      if (order) {
        setCart(order.items);
        setOrderId(order._id);
        setOrderStatus(order.status);
        setBillNumber(order.billNumber);
        setBillType(order.billType || 'Dine-In');
        // Restore delivery fields if delivery order
        if (order.billType === 'Delivery') {
          setOrderSource(order.orderSource || 'Direct');
        }
        setCustomerPhone(order.customerPhone || '');
        setCustomerName(order.customerName || '');
        if (order.tax !== undefined && Number(order.tax) > 0) {
          setTaxRate(order.tax);
        } else {
          try {
            const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            let tot = 0;
            if (s.enableCgst !== false) tot += (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5);
            if (s.enableSgst !== false) tot += (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5);
            if (s.enableGst === true) tot += (s.gstRate !== undefined ? Number(s.gstRate) : 5);
            if (tot > 0) setTaxRate(tot);
          } catch (e) {}
        }
      } else {
        // Reset for new order
        setCart([]);
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
        if (billType !== 'Delivery') {
          setOrderSource('Direct');
        }
        setCustomerPhone('');
        setCustomerName('');
        setCustomerInfo(null);
        try {
          const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          let tot = 0;
          if (s.enableCgst !== false) tot += (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5);
          if (s.enableSgst !== false) tot += (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5);
          if (s.enableGst === true) tot += (s.gstRate !== undefined ? Number(s.gstRate) : 5);
          setTaxRate(tot > 0 ? tot : '');
        } catch (e) {
          setTaxRate('');
        }
      }
    } catch (error) {
      console.error('Error fetching active order:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyStats = async () => {
    try {
      const { getDailyStats } = await import('../api/billing');
      const stats = await getDailyStats();
      setDailyStats(stats);
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      // Fallback to 0 if API fails
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
        const timestamp = Date.now().toString().slice(-6);
        const prefix = billType === 'Delivery' ? 'DEL-' : 'TAK-';
        currentTable = `${prefix}${timestamp}`;
        newlyGeneratedTables.current.add(currentTable);
        setActiveTable(currentTable);
      } else {
        showToast('Please select a table first', 'error');
        return;
      }
    }
    if (orderStatus !== 'Open') {
      showToast('Order is locked. Cannot add items.', 'error');
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.name === item.name); // Match by name for now, ideally ID
      if (existing) {
        showToast(`Increased quantity for ${item.name}`, 'success');
        return prev.map(i => i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i);
      }
      showToast(`Added ${item.name} to order`, 'success');
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    let currentTable = activeTable;
    if (!currentTable) {
      if (billType === 'Takeaway' || billType === 'Delivery') {
        const timestamp = Date.now().toString().slice(-6);
        const prefix = billType === 'Delivery' ? 'DEL-' : 'TAK-';
        currentTable = `${prefix}${timestamp}`;
        setActiveTable(currentTable);
      } else {
        showToast('Please select a table first', 'error');
        return;
      }
    }
    if (orderStatus !== 'Open') {
      showToast('Order is locked. Cannot modify items.', 'error');
      return;
    }
    setCart(prev => prev.map(i => {
      if (i._id === id || i.name === id) { // Handle both ID and Name matching
        const newQty = Math.max(0, i.quantity + delta);
        if (newQty === 0) showToast(`${i.name} removed from order`, 'info');
        return { ...i, quantity: newQty };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const calculateDiscount = (subtotal) => {
    const val = discount.value === '' ? 0 : parseFloat(discount.value) || 0;
    if (discount.type === 'percentage') {
      return (subtotal * val) / 100;
    }
    return val;
  };

  const subtotal = calculateSubtotal();
  const discountAmount = calculateDiscount(subtotal);
  const taxableAmount = subtotal - discountAmount;
  const taxVal = taxRate === '' ? 0 : parseFloat(taxRate) || 0;
  const taxAmount = (taxableAmount * taxVal) / 100;
  const total = Math.round(taxableAmount + taxAmount);

  // Action Handlers
  const handleSaveOrder = async () => {
    if (!activeTable) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        const timestamp = Date.now().toString().slice(-6);
        const prefix = billType === 'Delivery' ? 'DEL-' : 'TAK-';
        const generatedOrderNo = `${prefix}${timestamp}`;
        setActiveTable(generatedOrderNo);
        setTimeout(() => handleSaveOrderWithTable(generatedOrderNo), 100);
        return;
      } else {
        showToast('Please select a table first', 'error');
        return;
      }
    }
    handleSaveOrderWithTable(activeTable);
  };

  const handleSaveOrderWithTable = async (tableNo) => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const orderData = {
        tableNo: tableNo,
        items: cart,
        billType,
        // Include delivery fields if delivery order
        ...(billType === 'Delivery' && {
          orderSource
        })
      };
      const savedOrder = await saveOrder(orderData);
      setOrderId(savedOrder._id);
      setActiveTable(tableNo); // Ensure table is set
      showToast('Order saved successfully!', 'success');
      fetchActiveOrder();
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error saving order:', error);
      const errorMessage = error.response?.data?.message || error.message;
      const errorDetails = error.response?.data?.details ? JSON.stringify(error.response.data.details) : '';
      showToast(`Failed to save order: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBill = async () => {
    // For Delivery or Takeaway orders, auto-save if order doesn't exist
    if (!orderId) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        let tableToUse = activeTable;
        if (!tableToUse) {
          const timestamp = Date.now().toString().slice(-6);
          const prefix = billType === 'Delivery' ? 'DEL-' : 'TAK-';
          tableToUse = `${prefix}${timestamp}`;
          setActiveTable(tableToUse);
        }
        setLoading(true);
        try {
          const orderData = {
            tableNo: tableToUse,
            items: cart,
            billType: billType,
            orderSource: billType === 'Delivery' ? orderSource : undefined
          };
          const savedOrder = await saveOrder(orderData);
          setOrderId(savedOrder._id);
          await generateBillAfterSave(savedOrder._id);
        } catch (error) {
          console.error('Error saving order:', error);
          const errorMessage = error.response?.data?.message || error.message;
          showToast(`Failed to save order: ${errorMessage}`, 'error');
          setLoading(false);
        }
        return;
      } else {
        showToast('Please save the order first.', 'error');
        return;
      }
    }
    
    // Generate bill for existing order
    await generateBillAfterSave(orderId);
  };

  const generateBillAfterSave = async (orderIdToUse) => {
    setLoading(true);
    try {
      const billData = {
        discount: discountAmount,
        tax: taxVal
      };
      const billedOrder = await generateBill(orderIdToUse, billData);
      setOrderId(billedOrder._id);
      setOrderStatus('Billed');
      setBillNumber(billedOrder.billNumber);
      setCompletedBill(billedOrder);
      
      showToast('Bill generated successfully!', 'success');
      if (onOrderUpdate) onOrderUpdate();
      // Open Payment Modal immediately after generating bill
      setShowPayment(true);
    } catch (error) {
      console.error('Error generating bill:', error);
      
      // Graceful handling for "Order already billed" (e.g. double click or network retry)
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already billed')) {
         try {
           const order = await getActiveOrder(activeTable);
           if (order && (order.status === 'Billed' || order.status === 'Paid')) {
              setOrderStatus(order.status);
              setBillNumber(order.billNumber);
              setCompletedBill(order);
              if (order.status === 'Billed') {
                setShowPayment(true);
              } else {
                setShowInvoice(true);
              }
              showToast('Recovered existing bill status.', 'info');
              return;
           }
         } catch (fetchError) {
           console.error('Error recovering order state:', fetchError);
         }
      }

      const errorMessage = error.response?.data?.message || error.message;
      showToast(`Failed to generate bill: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSettleBill = (paymentData) => {
    completeSettlement(paymentData);
  };

  const completeSettlement = async (paymentData) => {
    setLoading(true);
    try {
      let currentId = orderId;
      
      // Enforce golden restaurant rule: Dine-In tables MUST fire KOT and generate Bill first!
      if (billType === 'Dine-In' && (!currentId || orderStatus === 'Open')) {
        showToast('Please fire KOT and generate Bill first for Dine-In tables.', 'error');
        setLoading(false);
        return;
      }
      
      // Step 1: For Delivery or Takeaway orders, auto-save if not saved yet
      if (!currentId) {
        let tableToUse = activeTable;
        if (!tableToUse) {
          const timestamp = Date.now().toString().slice(-6);
          const prefix = billType === 'Delivery' ? 'DEL-' : 'TAK-';
          tableToUse = `${prefix}${timestamp}`;
          setActiveTable(tableToUse);
        }
        const orderData = {
          tableNo: tableToUse,
          items: cart,
          subtotal,
          tax: taxAmount,
          discount: discountAmount,
          total,
          billType,
          orderSource: billType === 'Delivery' ? orderSource : undefined,
          customerPhone,
          customerName
        };
        const savedOrder = await saveOrder(orderData);
        currentId = savedOrder._id;
        setOrderId(savedOrder._id);
      }

      // Step 2: For Delivery or Takeaway, auto-generate bill if not billed yet
      let currentBillNum = billNumber;
      let billDetails = completedBill;
      if (orderStatus !== 'Billed' && orderStatus !== 'Paid') {
        const billData = {
          discount: discountAmount,
          tax: taxVal
        };
        const billedOrder = await generateBill(currentId, billData);
        setOrderStatus('Billed');
        currentBillNum = billedOrder.billNumber;
        setBillNumber(billedOrder.billNumber);
        billDetails = billedOrder;
        setCompletedBill(billedOrder);
      }

      // Step 3: Now settle the official bill!
      const settledOrder = await settleBill(currentId, { 
        paymentMode: paymentData.mode,
        splitPayments: paymentData.splitPayments,
        upiApp: paymentData.upiApp
      });
      setOrderStatus('Paid');
      setShowPayment(false);
      
      // Update completed bill with paid status and all details
      setCompletedBill({ 
        ...(billDetails || settledOrder), 
        ...settledOrder,
        items: cart, // Ensure items are preserved
        status: 'Paid', // Explicitly set status
        paymentMode: paymentData.mode, // Ensure payment mode is set
        billNumber: currentBillNum || settledOrder.billNumber,
        tableNo: settledOrder.tableNo || billDetails?.tableNo || activeTable // Always preserve table number
      });
      
      showToast('Bill Settled Successfully! Saved to billing history.', 'success');
      fetchDailyStats();
      if (onOrderUpdate) onOrderUpdate();
      setShowInvoice(true); // Show Invoice AFTER payment
    } catch (error) {
      console.error('Error settling bill:', error);
      setToast({ message: error.response?.data?.message || 'Failed to settle bill', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintKOT = async () => {
    try {
      setLoading(true);
      // Ensure order is saved first
      const orderData = {
        tableNo: activeTable,
        items: cart,
        subtotal,
        tax: taxAmount,
        discount: discountAmount,
        total,
        billType,
        orderSource: billType === 'Delivery' ? orderSource : undefined,
        customerPhone,
        customerName
      };
      
      let currentId = orderId;
      if (!currentId) {
         const savedOrder = await saveOrder(orderData);
         currentId = savedOrder._id;
         setOrderId(savedOrder._id);
      } else {
         await saveOrder({ id: currentId, ...orderData });
      }

      // Generate Delta KOT
      const response = await apiGenerateKOT(currentId, cart);
      
      // Update local cart state to reflect printed quantity
      if (response.bill && response.bill.items) {
        setCart(response.bill.items);
      }

      setActiveKOTData({
        ...response.kot,
        tableNo: activeTable,
        billType,
        orderSource
      });
      setShowKOT(true);
      
    } catch (error) {
      console.error('Error generating KOT:', error);
      showToast(error.response?.data?.message || 'Failed to generate KOT', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    // Verify bill is saved before closing
    if (completedBill && completedBill.status === 'Paid') {
      // Bill is already saved to history (status is 'Paid')
      // Show confirmation message
      showToast(`Bill ${completedBill.billNumber || 'saved'} has been saved to billing history!`, 'success');
    }
    
    // Close invoice and reset state
    setShowInvoice(false);
    setCart([]);
    setOrderId(null);
    setOrderStatus('Open');
    setBillNumber(null);
    setCompletedBill(null);
    fetchActiveOrder(); // Refresh to ensure clean state
    
    // Refresh daily stats to reflect the new bill
    fetchDailyStats();
    
    // Notify parent component to refresh active orders
    if (onOrderUpdate) onOrderUpdate();

    // Redirect to floor management after finishing the bill
    if (onNavigate) {
      onNavigate('floor');
    }
  };

  const handleReopenOrder = async () => {
    try {
      setLoading(true);
      await apiReopenOrder(orderId);
      setOrderStatus('Open');
      showToast('Order reopened successfully', 'success');
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error reopening order:', error);
      showToast(error.response?.data?.message || 'Failed to reopen order', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = () => {
    if (!orderId) {
      // Just clear local cart
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
        // Show cancellation KOT
        setActiveKOTData({
          ...response.kot,
          tableNo: activeTable,
          billType,
          orderSource
        });
        setShowKOT(true);
      }

      showToast('Order cancelled successfully', 'success');
      
      // Reset state
      setCart([]);
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);
      
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error cancelling order:', error);
      showToast(error.response?.data?.message || 'Failed to cancel order', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferTable = async (newTableNo) => {
    if (!orderId) return;
    try {
      setLoading(true);
      await apiTransferTable(orderId, newTableNo);
      showToast(`Bill successfully transferred to ${newTableNo}`, 'success');
      setShowTransfer(false);
      setActiveTable(newTableNo); // This will automatically re-fetch the order for the new table
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error transferring table:', error);
      showToast(error.response?.data?.message || 'Failed to transfer table', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Custom Header for Billing Page */}
      <div className="h-16 flex items-center justify-between px-3 sm:px-6 bg-gradient-to-r from-primary/10 via-accent/5 to-secondary/10 border-b border-border shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 font-bold text-lg sm:text-xl text-primary">
          {onToggleMenu && (
            <button
              onClick={onToggleMenu}
              className="p-1.5 rounded-lg bg-surface border border-border text-text-main hover:bg-surface-hover md:hidden shadow-sm"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="w-8 h-8 bg-primary text-white rounded-lg items-center justify-center shadow-lg shadow-primary/20 shrink-0 hidden sm:flex">
            <UtensilsCrossed size={18} />
          </div>
          <span className="tracking-tight hidden sm:inline">msbillings</span>
        </div>

        {/* Table Selector */}
        <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-1.5">
          <LayoutGrid size={16} className="text-text-muted" />
          {(billType === 'Delivery' || billType === 'Takeaway') ? (
            <select 
              value={activeTable} 
              onChange={(e) => {
                if (e.target.value === 'NEW_ORDER') {
                  const timestamp = Date.now().toString().slice(-6);
                  const prefix = billType === 'Delivery' ? 'DEL-' : 'TAK-';
                  setActiveTable(`${prefix}${timestamp}`);
                } else {
                  setActiveTable(e.target.value);
                }
              }}
              className="bg-transparent font-bold text-text-main focus:outline-none text-sm cursor-pointer"
            >
              <option value="NEW_ORDER" className="bg-surface text-primary font-bold">+ New {billType} Order</option>
              {openOrdersList
                .filter(o => o.tableNo?.startsWith(billType === 'Delivery' ? 'DEL-' : 'TAK-'))
                .map(o => (
                  <option key={o._id} value={o.tableNo} className="bg-surface text-white">
                    {o.tableNo} ({o.status} - ₹{o.total || 0})
                  </option>
                ))
              }
              {activeTable && !openOrdersList.some(o => o.tableNo === activeTable) && (
                <option value={activeTable} className="bg-surface text-white">
                  {activeTable} (New/Current)
                </option>
              )}
            </select>
          ) : (
            <select 
              value={activeTable} 
              onChange={(e) => setActiveTable(e.target.value)}
              className="bg-transparent font-bold text-text-main focus:outline-none text-sm"
            >
              <option value="" >Select Table</option>
              {floors.map(floor => {
                const hasItems = floor.tables?.length > 0 || floor.cabins?.length > 0 || floor.sofas?.length > 0;
                if (!hasItems) return null;
                return (
                  <optgroup key={floor.id} label={floor.name}>
                    {floor.tables?.map(t => <option key={`t-${t.id}`} value={t.name}>{t.name} (Table)</option>)}
                    {floor.cabins?.map(c => <option key={`c-${c.id}`} value={c.name}>{c.name} (Cabin)</option>)}
                    {floor.sofas?.map(s => <option key={`s-${s.id}`} value={s.name}>{s.name} (Sofa)</option>)}
                  </optgroup>
                );
              })}
              {/* Fallback to default tables if completely empty */}
              {floors.length === 0 && [...Array(20)].map((_, i) => (
                <option key={i} value={`TBL-${String(i + 1).padStart(2, '0')}`}>
                  Table {String(i + 1).padStart(2, '0')}
                </option>
              ))}
            </select>
          )}
          
          {/* Transfer Table Button */}
          {activeTable && orderStatus === 'Open' && orderId && billType !== 'Delivery' && (
            <button
              onClick={() => setShowTransfer(true)}
              title="Transfer Bill to Another Table"
              className="ml-2 p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors border border-primary/20 flex items-center justify-center"
            >
              <ArrowRightLeft size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search items..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 text-text-main transition-all shadow-inner"
            />
          </div>
        </div>

        <div className="items-center gap-6 hidden sm:flex">
          <div className="flex items-center gap-4 bg-background px-3 py-1.5 rounded-xl border border-border/50">
            <div className="flex flex-col items-end">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1">
                Sales <TrendingUp size={10} className="text-success" />
              </p>
              <p className="text-sm font-bold text-text-main font-mono">₹{dailyStats.sales.toLocaleString()}</p>
            </div>
          </div>
          
          <button 
            onClick={toggleFullScreen}
            className="p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
          >
            {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher & Search */}
      <div className="flex flex-col md:hidden px-3 pt-2 gap-2 shrink-0 bg-background border-b border-border/50 pb-2.5">
        <div className="flex gap-2">
          <button
            onClick={() => setMobileTab('menu')}
            className={`flex-1 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === 'menu'
                ? 'bg-primary text-white shadow-md'
                : 'bg-surface text-text-muted border border-border hover:bg-surface-hover'
            }`}
          >
            <span>🍽️ Menu Items</span>
          </button>
          <button
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 relative ${
              mobileTab === 'cart'
                ? 'bg-primary text-white shadow-md'
                : 'bg-surface text-text-muted border border-border hover:bg-surface-hover'
            }`}
          >
            <span>🛒 Current Order</span>
            {cart.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        {/* Mobile Search Bar (Only shown when on Menu tab) */}
        {mobileTab === 'menu' && (
          <div className="relative group w-full mt-0.5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search dishes, categories..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary text-xs text-text-main transition-all shadow-inner"
            />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-2 sm:p-4 gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_380px] lg:grid-cols-[1fr_400px] gap-4 overflow-hidden">
          {/* Left Panel: Menu */}
          <div className={`flex flex-col overflow-hidden bg-surface rounded-2xl shadow-sm border border-border/50 ${
            mobileTab === 'cart' ? 'hidden md:flex' : 'flex'
          }`}>
            <MenuGrid onSelectItem={addToCart} searchTerm={debouncedSearchTerm} />
          </div>

          {/* Right Panel: Summary */}
          <div className={`flex flex-col overflow-hidden rounded-2xl shadow-xl shadow-primary/5 ring-1 ring-black/5 bg-surface ${
            mobileTab === 'menu' ? 'hidden md:flex' : 'flex'
          }`}>
            <BillSummary
              cart={cart}
              updateQuantity={updateQuantity}
              subtotal={subtotal}
              taxAmount={taxAmount}
              discountAmount={discountAmount}
              total={total}
              userRole={userRole}

              // Lifecycle Props
              orderStatus={orderStatus}
              activeTable={activeTable}
              onSaveOrder={handleSaveOrder}
              onGenerateBill={handleGenerateBill}
              onSettleBill={() => setShowPayment(true)}
              onPrintKOT={handlePrintKOT}
              onPrintBill={() => setShowInvoice(true)}
              onReopenOrder={handleReopenOrder}
              onCancelOrder={handleCancelOrder}

              discount={discount}
              setDiscount={setDiscount}
              taxRate={taxRate}
              setTaxRate={setTaxRate}
              billType={billType}
              setBillType={setBillType}
              loading={loading}

              // Delivery Props
              orderSource={orderSource}
              setOrderSource={setOrderSource}
              
              // CRM Props
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerInfo={customerInfo}
            />
          </div>
        </div>

        {/* Mobile Floating Cart Bar */}
        {cart.length > 0 && mobileTab === 'menu' && (
          <div className="md:hidden p-3 bg-surface border border-border rounded-2xl shadow-xl flex items-center justify-between shrink-0 animate-bounce-short">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted font-bold uppercase">Total ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
              <span className="text-base font-black text-primary">₹{total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setMobileTab('cart')}
              className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary-hover flex items-center gap-2"
            >
              <span>View Order</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">➔</span>
            </button>
          </div>
        )}
      </div>

      {showPayment && (
        <PaymentModal 
          total={total} 
          billNumber={billNumber}
          tableNo={activeTable}
          onClose={() => setShowPayment(false)} 
          onComplete={handleSettleBill}
        />
      )}

      {showInvoice && (
        <Invoice 
          bill={completedBill || {
            _id: orderId,
            billNumber: billNumber,
            status: orderStatus,
            items: cart,
            subtotal: subtotal,
            tax: taxAmount,
            discount: discountAmount,
            total: total,
            billType: billType,
            tableNo: activeTable,
            orderSource: orderSource,
            createdAt: new Date()
          }} 
          onClose={handleFinish} 
          onSave={handleFinish} 
        />
      )}

      {showKOT && activeKOTData && (
        <KOT 
          order={activeKOTData}
          onClose={() => {
            setShowKOT(false);
            setActiveKOTData(null);
          }}
        />
      )}

      {showTransfer && (
        <TransferTableModal
          floors={floors}
          currentTable={activeTable}
          onClose={() => setShowTransfer(false)}
          onTransfer={handleTransferTable}
        />
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <CancelOrderModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancelOrder}
        validPin={JSON.parse(localStorage.getItem('restaurantSettings') || '{}').ownerPin || '1234'}
      />
    </div>
  );
};

export default BillingPage;
