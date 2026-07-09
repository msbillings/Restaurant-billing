import React, { useState, useEffect, useCallback } from 'react';
import { getDailyStats, getBillById, deleteBill } from '../api/billing';
import { 
  TrendingUp, 
  Receipt, 
  ShoppingBag, 
  DollarSign,
  RefreshCw,
  Clock,
  CreditCard,
  Wallet,
  Smartphone,
  Activity,
  Package,
  Percent,
  TrendingDown,
  Truck
} from 'lucide-react';
import Toast from './Toast';
import Invoice from './Invoice';
import EditHistoryModal from './EditHistoryModal';
import { LayoutDashboard, Plus, Coffee, Home, Trash2, Eye, Star, FileSignature } from 'lucide-react';
import { io } from 'socket.io-client';

const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    sales: 0,
    orders: 0,
    averageOrderValue: 0,
    totalItems: 0,
    totalDiscount: 0,
    totalTax: 0,
    paymentMethods: [],
    activeOrders: 0,
    deliveryOrders: 0,
    dineInOrders: 0,
    takeawayOrders: 0,
    topItems: [],
    recentBills: [],
    openKOTs: [],
    cancelledOrders: [],
    editedOrders: []
  });
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedEditHistory, setSelectedEditHistory] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, billId: null });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [lastResetDate, setLastResetDate] = useState(() => {
    const today = new Date().toDateString();
    return localStorage.getItem('dashboardLastDate') || today;
  });





  // Fetch today's stats - Optimized with error handling
  const fetchTodayStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDailyStats();
      // Only update if we're still on the same day
      const today = new Date().toDateString();
      const storedDate = localStorage.getItem('dashboardLastDate') || today;
      
      if (storedDate === today) {
        setStats(data);
      } else {
        // Day changed, reset to zero
        setStats({
          sales: 0,
          orders: 0,
          averageOrderValue: 0,
          totalItems: 0,
          totalDiscount: 0,
          totalTax: 0,
          paymentMethods: [],
          activeOrders: 0,
          deliveryOrders: 0,
          dineInOrders: 0,
          takeawayOrders: 0,
          topItems: [],
          recentBills: []
        });
        localStorage.setItem('dashboardLastDate', today);
        setLastResetDate(today);
      }
    } catch (error) {
      console.error('Error fetching today stats:', error);
      setToast({ message: 'Failed to load dashboard data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if day has changed and reset if needed
  useEffect(() => {
    const checkDayChange = () => {
      const today = new Date().toDateString();
      const storedDate = localStorage.getItem('dashboardLastDate');
      
      if (storedDate !== today) {
        // Day has changed, reset stats and fetch new data
        setStats({
          sales: 0,
          orders: 0,
          averageOrderValue: 0,
          totalItems: 0,
          totalDiscount: 0,
          totalTax: 0,
          paymentMethods: [],
          activeOrders: 0,
          deliveryOrders: 0,
          dineInOrders: 0,
          takeawayOrders: 0,
          topItems: [],
          recentBills: []
        });
        localStorage.setItem('dashboardLastDate', today);
        setLastResetDate(today);
        // Fetch new day's stats
        fetchTodayStats();
      }
    };

    // Check immediately
    checkDayChange();

    // Set up interval to check every minute
    const interval = setInterval(checkDayChange, 60000);

    // Set up midnight reset
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const midnightTimeout = setTimeout(() => {
      checkDayChange();
      // Then check every minute after midnight
      setInterval(checkDayChange, 60000);
    }, msUntilMidnight);

    return () => {
      clearInterval(interval);
      clearTimeout(midnightTimeout);
    };
  }, [fetchTodayStats]);

  // Update current date every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchTodayStats();
    
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

    // Listen for real-time events to update dashboard stats
    socket.on('orderUpdated', fetchTodayStats);
    socket.on('billSettled', fetchTodayStats);
    socket.on('tableStatusChanged', fetchTodayStats);
    socket.on('newKOT', fetchTodayStats);

    return () => {
      socket.disconnect();
    };
  }, [fetchTodayStats]);

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, billId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.billId) return;
    
    try {
      await deleteBill(deleteModal.billId);
      setToast({ message: 'Bill deleted successfully', type: 'success' });
      setDeleteModal({ isOpen: false, billId: null });
      fetchTodayStats(); // Refresh dashboard
    } catch (error) {
      console.error('Error deleting bill:', error);
      setToast({ message: error.response?.data?.message || 'Failed to delete bill', type: 'error' });
    }
  };

  const handleViewBill = async (billId) => {
    setLoadingBill(true);
    try {
      const fullBill = await getBillById(billId);
      setSelectedBill(fullBill);
    } catch (error) {
      console.error('Error fetching bill details:', error);
      setToast({ message: 'Failed to load bill details', type: 'error' });
    } finally {
      setLoadingBill(false);
    }
  };

  const getPaymentIcon = (mode) => {
    switch (mode) {
      case 'Cash': return <Wallet size={16} />;
      case 'UPI': return <Smartphone size={16} />;
      case 'Card': return <CreditCard size={16} />;
      default: return <CreditCard size={16} />;
    }
  };

  if (loading && stats.sales === 0 && stats.orders === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-text-muted">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/5 via-accent/3 to-secondary/5 rounded-xl p-3 sm:p-4 border border-border/50 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-base sm:text-xl font-bold text-text-main mb-0.5">Today's Dashboard</h1>
              <p className="text-[10px] sm:text-xs text-text-muted font-medium">{formatDate(currentDate)}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => onNavigate && onNavigate('billing')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg text-xs sm:text-sm"
              >
                <LayoutDashboard size={14} className="sm:w-4 sm:h-4" />
                <span>Quick Billing</span>
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface rounded-lg border border-border/50">
                <Clock size={16} className="text-primary" />
                <span className="text-base font-mono font-bold text-text-main">{formatTime(currentDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Revenue Card */}
          <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-xl p-3 sm:p-5 border border-success/20 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-success/20 rounded-lg flex items-center justify-center">
                <DollarSign className="text-success" size={18} />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-text-muted uppercase tracking-wide">Revenue</p>
              <p className="text-lg sm:text-2xl font-bold text-text-main leading-tight">{formatCurrency(stats.sales)}</p>
            </div>
          </div>

          {/* Dine-In Orders Card */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-3 sm:p-5 border border-primary/20 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <ShoppingBag className="text-primary" size={18} />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-text-muted uppercase tracking-wide">Dine-In</p>
              <p className="text-lg sm:text-2xl font-bold text-text-main leading-tight">{stats.dineInOrders}</p>
            </div>
          </div>

          {/* Takeaway Orders Card */}
          <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-xl p-3 sm:p-5 border border-secondary/20 shadow-sm hover:shadow-lg hover:border-secondary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                <Package className="text-secondary" size={18} />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-text-muted uppercase tracking-wide">Takeaway</p>
              <p className="text-lg sm:text-2xl font-bold text-text-main leading-tight">{stats.takeawayOrders}</p>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl p-3 sm:p-5 border border-accent/20 shadow-sm hover:shadow-lg hover:border-accent/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-accent" size={18} />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-text-muted uppercase tracking-wide">Avg Order</p>
              <p className="text-lg sm:text-2xl font-bold text-text-main leading-tight">{formatCurrency(stats.averageOrderValue)}</p>
            </div>
          </div>

          {/* Active Orders */}
          <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-xl p-3 sm:p-5 border border-secondary/20 shadow-sm hover:shadow-lg hover:border-secondary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                <Activity className="text-secondary" size={18} />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-text-muted uppercase tracking-wide">Active</p>
              <p className="text-lg sm:text-2xl font-bold text-text-main leading-tight">{stats.activeOrders}</p>
            </div>
          </div>

          {/* Delivery Orders */}
          <div className="bg-gradient-to-br from-orange-100/50 to-orange-50/30 rounded-xl p-3 sm:p-5 border border-orange-200/50 shadow-sm hover:shadow-lg hover:border-orange-300/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-200/50 rounded-lg flex items-center justify-center">
                <Truck className="text-orange-600" size={18} />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs font-semibold text-text-muted uppercase tracking-wide">Delivery</p>
              <p className="text-lg sm:text-2xl font-bold text-text-main leading-tight">{stats.deliveryOrders || 0}</p>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Items Sold */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-lg p-4 border border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Package className="text-primary" size={18} />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Items Sold</span>
              </div>
              <span className="text-lg font-bold text-text-main">{stats.totalItems}</span>
            </div>
          </div>

          {/* Discount Given */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-lg p-4 border border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-success/10 rounded-lg flex items-center justify-center">
                  <Percent className="text-success" size={18} />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Discount Given</span>
              </div>
              <span className="text-lg font-bold text-text-main">{formatCurrency(stats.totalDiscount)}</span>
            </div>
          </div>

          {/* Tax Collected */}
          <div className="bg-surface/80 backdrop-blur-sm rounded-lg p-4 border border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Receipt className="text-accent" size={18} />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Tax Collected</span>
              </div>
              <span className="text-lg font-bold text-text-main">{formatCurrency(stats.totalTax)}</span>
            </div>
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        {stats.paymentMethods && stats.paymentMethods.length > 0 && (
          <div className="bg-surface rounded-xl p-5 border border-border shadow-sm">
            <h3 className="text-lg font-bold text-text-main mb-4 flex items-center gap-2">
              <CreditCard size={20} className="text-primary" />
              Payment Methods
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {stats.paymentMethods.map((method, index) => {
                const totalRevenue = stats.paymentMethods.reduce((sum, m) => sum + m.revenue, 0);
                const percentage = totalRevenue > 0 ? ((method.revenue / totalRevenue) * 100).toFixed(1) : 0;
                const colors = [
                  'from-primary to-primary/60',
                  'from-secondary to-secondary/60',
                  'from-accent to-accent/60'
                ];
                const colorClass = colors[index % colors.length];
                
                return (
                  <div key={method._id || index} className="bg-gradient-to-br from-surface to-surface-hover rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 bg-gradient-to-br ${colorClass} rounded-lg flex items-center justify-center text-white`}>
                        {getPaymentIcon(method._id)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-text-main">{method._id || 'Unknown'}</p>
                        <p className="text-xs text-text-muted">{method.count} transactions</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-xl font-bold text-text-main">{formatCurrency(method.revenue)}</p>
                      <p className="text-xs text-text-muted">{percentage}% of total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Items, Recent Bills, Pending KOTs & Cancelled Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Top Selling Items */}
          <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col h-[400px]">
            <div className="p-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Star size={20} className="text-yellow-500" />
                Top Selling Items
              </h3>
            </div>
            <div className="p-2 flex-1 overflow-y-auto">
              {!stats.topItems || stats.topItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted">
                  <Package size={40} className="mb-2 opacity-20" />
                  <p>No items sold today</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {stats.topItems.map((item, idx) => (
                    <div key={item._id} className="flex items-center justify-between p-3 hover:bg-surface-hover rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-text-main">{item._id}</p>
                          <p className="text-xs text-text-muted">{item.quantity} portions sold</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-primary">{formatCurrency(item.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Bills */}
          <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col h-[400px]">
            <div className="p-5 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Receipt size={20} className="text-accent" />
                Recent Bills
              </h3>
            </div>
            <div className="p-0 flex-1 overflow-y-auto">
              {!stats.recentBills || stats.recentBills.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted p-5">
                  <Receipt size={40} className="mb-2 opacity-20" />
                  <p>No bills generated today</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-background sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase">Bill #</th>
                      <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase">Time</th>
                      <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase text-right">Total</th>
                      <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.recentBills.map(bill => (
                      <tr key={bill._id} className="hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3 font-medium text-text-main text-sm">#{bill.billNumber}</td>
                        <td className="px-4 py-3 text-text-muted text-sm">{new Date(bill.updatedAt || bill.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="px-4 py-3 font-bold text-text-main text-right text-sm">₹{bill.total.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <button 
                              onClick={() => handleViewBill(bill._id)}
                              disabled={loadingBill}
                              className="p-1.5 hover:bg-background rounded-lg text-primary transition-colors disabled:opacity-50"
                              title="View Invoice"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          
          {/* Pending KOTs (Revenue Leakage Tracker) */}
          <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col h-[400px]">
            <div className="p-5 border-b border-border bg-gradient-to-r from-orange-500/5 to-transparent">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Clock size={20} className="text-orange-500" />
                  Pending KOTs (Unsettled)
                </h3>
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                  {stats.openKOTs ? stats.openKOTs.length : 0} Open
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">Orders sent to kitchen but not yet paid.</p>
            </div>
            <div className="p-0 flex-1 overflow-y-auto">
              {!stats.openKOTs || stats.openKOTs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted p-5">
                  <Clock size={40} className="mb-2 opacity-20" />
                  <p>No pending KOTs</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.openKOTs.map(kot => {
                    const waitTimeMinutes = Math.floor((new Date() - new Date(kot.createdAt)) / 60000);
                    const isOverdue = waitTimeMinutes > 60; // Flag if open for more than 1 hour
                    const kotDate = new Date(kot.createdAt);
                    const formattedDate = kotDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    const formattedTime = kotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div key={kot._id} className={`p-4 hover:bg-surface-hover transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-text-main">{kot.tableNo}</span>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-xs font-bold text-text-muted">
                              {formattedDate} at {formattedTime}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                              {waitTimeMinutes > 1440 ? `${Math.floor(waitTimeMinutes/1440)} days ago` : `${waitTimeMinutes} mins ago`}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-text-muted mb-2">
                          <span className="font-medium text-text-main">Type:</span> {kot.billType} • <span className="font-medium text-text-main">Status:</span> {kot.status}
                        </div>
                        <div className="text-xs text-text-muted line-clamp-2">
                          {kot.items && kot.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cancelled Orders Tracker */}
          <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col h-[400px]">
            <div className="p-5 border-b border-border bg-gradient-to-r from-danger/5 to-transparent">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Trash2 size={20} className="text-danger" />
                  Cancelled Orders
                </h3>
                <span className="px-2.5 py-1 bg-danger/10 text-danger text-xs font-bold rounded-full">
                  {stats.cancelledOrders ? stats.cancelledOrders.length : 0} Today
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">Orders cancelled or voided.</p>
            </div>
            <div className="p-0 flex-1 overflow-y-auto">
              {!stats.cancelledOrders || stats.cancelledOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted p-5">
                  <Trash2 size={40} className="mb-2 opacity-20" />
                  <p>No cancelled orders today</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.cancelledOrders.map(order => {
                    const orderDate = new Date(order.updatedAt || order.createdAt);
                    const formattedTime = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div key={order._id} className="p-4 hover:bg-surface-hover transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-text-main text-sm">{order.tableNo}</span>
                          <span className="text-xs font-bold text-text-muted">
                            {formattedTime}
                          </span>
                        </div>
                        <div className="text-xs text-danger bg-danger/5 p-2 rounded border border-danger/10 mt-1">
                          <span className="font-bold">Reason:</span> {order.cancelReason || (order.status !== 'Cancelled' && order.status !== 'Deleted' ? 'Items voided during active order' : 'No reason provided')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Edited Bills Tracker */}
          <div className="bg-surface rounded-xl border border-border shadow-sm flex flex-col h-[400px] lg:col-span-2">
            <div className="p-5 border-b border-border bg-gradient-to-r from-blue-500/5 to-transparent">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <FileSignature size={20} className="text-blue-500" />
                  Edited Bills
                </h3>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                  {stats.editedOrders ? stats.editedOrders.length : 0} Today
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">Orders that were modified or updated today.</p>
            </div>
            <div className="p-0 flex-1 overflow-y-auto">
              {!stats.editedOrders || stats.editedOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted p-5">
                  <FileSignature size={40} className="mb-2 opacity-20" />
                  <p>No edited bills today</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.editedOrders.map(order => {
                    const orderDate = new Date(order.updatedAt || order.createdAt);
                    const formattedTime = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div 
                        key={order._id} 
                        className="p-4 hover:bg-surface-hover transition-colors cursor-pointer group"
                        onClick={() => setSelectedEditHistory(order)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-text-main text-sm">{order.billNumber || order.tableNo}</span>
                          <span className="text-xs font-bold text-text-muted">
                            {formattedTime}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded">
                            {order.editHistory?.length || 1} {order.editHistory?.length === 1 ? 'Edit' : 'Edits'}
                          </span>
                          <span className="text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                            View Audit Trail &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Info Section */}
        <div className="bg-surface rounded-xl p-5 border border-border">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="text-primary" size={16} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-text-main mb-1">Dashboard Information</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                This dashboard shows real-time statistics for today only. The data automatically resets at midnight (00:00) 
                and starts fresh for the new day. Stats are updated every 30 seconds automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <button
            onClick={fetchTodayStats}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Now</span>
          </button>
        </div>
      </div>

      {selectedBill && (
        <Invoice 
          bill={selectedBill} 
          onClose={() => setSelectedBill(null)} 
        />
      )}

      {selectedEditHistory && (
        <EditHistoryModal
          order={selectedEditHistory}
          onClose={() => setSelectedEditHistory(null)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;

