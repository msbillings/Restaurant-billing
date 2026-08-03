import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getDailyStats, getBillById, deleteBill } from '../api/billing';
import { LayoutDashboard, Clock, Eye, ChevronDown, Filter } from 'lucide-react';
import { io } from 'socket.io-client';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

import Toast from './Toast';
import Invoice from './Invoice';
import EditHistoryModal from './EditHistoryModal';

// Some delicious placeholder images for top items
const FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1544025162-811114bd74b6?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=200&q=80',
];

const getFoodImage = (name) => {
  if (!name) return FOOD_IMAGES[0];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return FOOD_IMAGES[sum % FOOD_IMAGES.length];
};

const PIE_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f97316'];

const Dashboard = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
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
    editedOrders: [],
    hourlySales: []
  });
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedEditHistory, setSelectedEditHistory] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateFilter, setDateFilter] = useState('Today');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);


  
  const fetchTodayStats = useCallback(async () => {
    try {
      setLoading(true);
      let startDate, endDate;
      const now = new Date();
      
      if (dateFilter === 'Today') {
        // Today doesn't need start/end; backend will handle it perfectly using UTC
        startDate = undefined;
        endDate = undefined;
      } else if (dateFilter === 'Last 7 Days') {
        const past = new Date(now);
        past.setDate(past.getDate() - 7);
        startDate = past.toISOString();
        endDate = now.toISOString();
      } else if (dateFilter === '1 Month') {
        const past = new Date(now);
        past.setMonth(past.getMonth() - 1);
        startDate = past.toISOString();
        endDate = now.toISOString();
      } else if (dateFilter === '3 Months') {
        const past = new Date(now);
        past.setMonth(past.getMonth() - 3);
        startDate = past.toISOString();
        endDate = now.toISOString();
      } else if (dateFilter === '6 Months') {
        const past = new Date(now);
        past.setMonth(past.getMonth() - 6);
        startDate = past.toISOString();
        endDate = now.toISOString();
      } else if (dateFilter === '1 Year') {
        const past = new Date(now);
        past.setFullYear(past.getFullYear() - 1);
        startDate = past.toISOString();
        endDate = now.toISOString();
      } else if (dateFilter === 'Custom' && customDateRange.start && customDateRange.end) {
        startDate = new Date(customDateRange.start).toISOString();
        const endD = new Date(customDateRange.end);
        endD.setDate(endD.getDate() + 1); // include the end day fully
        endDate = endD.toISOString();
      }

      const data = await getDailyStats(startDate, endDate);
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setToast({ message: 'Failed to load dashboard data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customDateRange]);


  useEffect(() => {
    fetchTodayStats();
    
    // Realtime events
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

    socket.on('orderUpdated', fetchTodayStats);
    socket.on('billSettled', fetchTodayStats);
    socket.on('tableStatusChanged', fetchTodayStats);
    socket.on('newKOT', fetchTodayStats);

    return () => {
      socket.disconnect();
    };
  }, [fetchTodayStats]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
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

  // Real Sales Overview Data from backend (hourly breakdown)
  const salesOverviewData = (stats.hourlySales && stats.hourlySales.length > 0)
    ? stats.hourlySales
    : Array.from({ length: 24 }, (_, i) => ({ time: `${i.toString().padStart(2, '0')}:00`, sales: 0, orders: 0 }));

  // Order Status Chart Data
  const completedOrders = stats.recentBills.length;
  const runningOrders = stats.activeOrders;
  const canceledOrders = stats.cancelledOrders ? stats.cancelledOrders.length : 0;
  const pendingOrders = stats.openKOTs ? stats.openKOTs.length : 0;
  const totalOrderStatus = completedOrders + runningOrders + canceledOrders + pendingOrders || 1;

  const orderStatusData = [
    { name: 'Completed', value: completedOrders, color: '#3b82f6' },
    { name: 'Running', value: runningOrders, color: '#22c55e' },
    { name: 'Canceled', value: canceledOrders, color: '#ef4444' },
    { name: 'Pending', value: pendingOrders, color: '#f97316' },
  ].filter(d => d.value > 0);

  // Payment Methods Data
  const paymentData = stats.paymentMethods.length > 0 
    ? stats.paymentMethods.map((m, i) => ({
        name: m._id,
        value: m.revenue,
        color: PIE_COLORS[i % PIE_COLORS.length]
      }))
    : [{ name: 'No Data', value: 1, color: '#4b5563' }];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1e1e1e] border border-gray-800 p-3 rounded-lg shadow-xl">
          <p className="text-gray-300 text-xs mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm font-bold" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'sales' || entry.name === 'value' ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-full h-full bg-[#09090b] text-gray-100 p-4 md:p-6 overflow-y-auto">
      {/* Dashboard Header Container - Forcing dark mode on this specific page */}
      <style>{`
        .glass-card {
          background: rgba(20, 20, 24, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }
      `}</style>
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2">
          <LayoutDashboard className="text-gray-400" size={24} />
          {t("Dashboard")}
        </h1>
        
        <div className="text-sm text-gray-400 flex items-center gap-4 font-mono">
          <div className="relative">
            <button 
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-2 bg-[#1e1e24] px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-white text-sm"
            >
              <Filter size={16} />
              {t(dateFilter)}
              <ChevronDown size={16} />
            </button>
            
            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1a1a20] border border-white/10 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                {['Today', 'Last 7 Days', '1 Month', '3 Months', '6 Months', '1 Year', 'Custom'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => {
                      if (filter === 'Custom') {
                        setShowCustomDateModal(true);
                        setIsFilterDropdownOpen(false);
                      } else {
                        setDateFilter(filter);
                        setIsFilterDropdownOpen(false);
                      }
                    }}
                    className={`w-full text-left px-4 py-2 text-sm ${dateFilter === filter ? 'bg-orange-500/20 text-orange-400' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    {t(filter)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-500" />
            {currentDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-5 border-l-2 border-l-blue-500">
          <p className="text-gray-400 text-sm mb-1">{t("Total Sales")}</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.sales)}</p>
        </div>
        <div className="glass-card p-5 border-l-2 border-l-green-500">
          <p className="text-gray-400 text-sm mb-1">{t("Orders")}</p>
          <p className="text-2xl font-bold text-white">{stats.orders}</p>
        </div>
        <div className="glass-card p-5 border-l-2 border-l-orange-500">
          <p className="text-gray-400 text-sm mb-1">{t("Customers")}</p>
          <p className="text-2xl font-bold text-white">{stats.recentBills.length}</p>
        </div>
        <div className="glass-card p-5 border-l-2 border-l-purple-500">
          <p className="text-gray-400 text-sm mb-1">{t("Avg. Order Value")}</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.averageOrderValue)}</p>
        </div>
      </div>

      {/* Main Grid: Top Selling Items and Sales Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Selling Items */}
        <div className="glass-card p-5 flex flex-col h-[350px]">
          <h3 className="text-lg font-bold mb-6">{t("Top Selling Items")}</h3>
          <div className="flex-1 overflow-x-auto flex items-center gap-6 pb-4">
            {stats.topItems && stats.topItems.length > 0 ? (
              stats.topItems.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex flex-col items-center min-w-[120px]">
                  <div className="w-20 h-20 rounded-full border-2 border-orange-500/50 p-1 mb-3 bg-black/40">
                    <img 
                      src={getFoodImage(item._id)} 
                      alt={item._id} 
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <p className="font-bold text-sm text-center mb-1 line-clamp-1">{t(item._id)}</p>
                  <p className="text-orange-400 font-bold text-sm">{formatCurrency(item.revenue)}</p>
                  <p className="text-xs text-gray-500">{item.quantity} {t("Orders")}</p>
                </div>
              ))
            ) : (
              <div className="w-full flex items-center justify-center text-gray-500">
                {t("No items sold today")}
              </div>
            )}
          </div>
        </div>

        {/* Sales Overview Chart */}
        <div className="glass-card p-5 flex flex-col h-[350px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{t("Sales Overview")}</h3>
            <span className="bg-[#1e1e24] px-3 py-1 rounded text-xs text-gray-400 border border-white/5">{t(dateFilter)}</span>
          </div>
          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesOverviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                <Bar yAxisId="left" dataKey="sales" name={t("Sales (₹)")} fill="#f97316" barSize={28} radius={[6, 6, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="orders" name={t("Orders")} stroke="#3b82f6" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Order Status, Payment Methods, Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Order Status */}
        <div className="glass-card p-5 h-[300px] flex flex-col">
          <h3 className="text-lg font-bold mb-4">{t("Order Status")}</h3>
          <div className="flex-1 flex items-center justify-center relative">
            {orderStatusData.length > 0 ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-gray-500 text-xs">{t("Total")}</span>
                  <span className="text-xl font-bold">{totalOrderStatus}</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </>
            ) : (
               <div className="text-gray-500">{t("No data")}</div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-4 text-xs justify-center">
            {orderStatusData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-gray-400">{t(d.name)}</span>
                <span className="font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="glass-card p-5 h-[300px] flex flex-col">
          <h3 className="text-lg font-bold mb-4">{t("Payment Methods")}</h3>
          <div className="flex-1 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 text-xs justify-center">
            {paymentData.map((d, i) => {
              if(d.name === 'No Data') return null;
              const percentage = stats.sales > 0 ? ((d.value / stats.sales) * 100).toFixed(0) : 0;
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-gray-400">{t(d.name)}</span>
                  <span className="font-bold">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Orders List */}
        <div className="glass-card p-5 h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{t("Recent Orders")}</h3>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scroll">
            <style>{`
              .custom-scroll::-webkit-scrollbar { width: 4px; }
              .custom-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
              .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
            `}</style>
            {!stats.recentBills || stats.recentBills.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                {t("No recent orders")}
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentBills.slice(0, 8).map((bill) => {
                  const billTime = new Date(bill.updatedAt || bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={bill._id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 rounded px-2" onClick={() => handleViewBill(bill._id)}>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-500 font-mono text-xs">#{bill.billNumber}</span>
                        <span className="text-gray-300 w-20 truncate text-xs">{t(bill.tableNo) || 'Takeaway'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="font-bold">{formatCurrency(bill.total)}</span>
                        <span className="text-gray-500 text-[10px] w-14">{billTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      
      {showCustomDateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">{t("Select Custom Date Range")}</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t("Start Date")}</label>
                <input 
                  type="date" 
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({...customDateRange, start: e.target.value})}
                  className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t("End Date")}</label>
                <input 
                  type="date" 
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({...customDateRange, end: e.target.value})}
                  className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowCustomDateModal(false)}
                className="px-4 py-2 rounded-lg bg-[#27272a] text-white hover:bg-white/10 transition-colors"
              >
                {t("Cancel")}
              </button>
              <button 
                onClick={() => {
                  if(customDateRange.start && customDateRange.end) {
                    setDateFilter('Custom');
                    setShowCustomDateModal(false);
                  } else {
                    setToast({ message: 'Please select both start and end dates', type: 'error' });
                  }
                }}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                {t("Apply Filter")}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBill && <Invoice bill={selectedBill} onClose={() => setSelectedBill(null)} />}
      {selectedEditHistory && <EditHistoryModal order={selectedEditHistory} onClose={() => setSelectedEditHistory(null)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Dashboard;