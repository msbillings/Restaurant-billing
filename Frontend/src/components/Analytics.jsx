import React, { useState, useEffect } from 'react';
import { getAnalytics, downloadDailyReportCSV, downloadMonthlyReportExcel } from '../api/analytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  TrendingUp,
  Receipt,
  ShoppingBag,
  DollarSign,
  Calendar,
  BarChart3,
  CreditCard,
  Wallet,
  Smartphone,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Truck,
  ShieldAlert,
  AlertTriangle,
  UserX,
  X
} from 'lucide-react';
import Toast from './Toast';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState(null); // For 7 or 30 days view
  const [viewMode, setViewMode] = useState('month'); // 'month', 'days', or 'day'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState(null);
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudData, setFraudData] = useState(null);
  const [fraudLoading, setFraudLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedMonth, selectedYear, days, viewMode, selectedDate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let data;
      if (viewMode === 'month') {
        data = await getAnalytics(selectedMonth, selectedYear, null);
      } else if (viewMode === 'day') {
        data = await getAnalytics(null, null, null, selectedDate);
      } else {
        data = await getAnalytics(null, null, days);
      }
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setToast({ message: 'Failed to load analytics data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFraudAnalysis = async () => {
    setFraudLoading(true);
    setShowFraudModal(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
      const res = await fetch(`${API_BASE_URL}/ai/fraud-analysis`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        }
      });
      if (res.ok) {
        setFraudData(await res.json());
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to run fraud analysis', type: 'error' });
    } finally {
      setFraudLoading(false);
    }
  };

  const getMonthName = (monthNum) => {
    const date = new Date(2000, monthNum - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long' });
  };

  const getAvailableMonths = () => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        label: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      });
    }
    return months;
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getMaxRevenue = () => {
    if (!analytics?.dailyRevenue || analytics.dailyRevenue.length === 0) return 1;
    return Math.max(...analytics.dailyRevenue.map(d => d.revenue));
  };

  const getPaymentModeIcon = (mode) => {
    switch (mode) {
      case 'Cash': return <Wallet size={20} />;
      case 'UPI': return <Smartphone size={20} />;
      case 'Card': return <CreditCard size={20} />;
      default: return <CreditCard size={20} />;
    }
  };

  const handleDownloadReport = async () => {
    try {
      setToast({ message: 'Generating report...', type: 'info' });
      if (viewMode === 'month') {
        await downloadMonthlyReportExcel(selectedMonth, selectedYear);
      } else {
        // For days view, use the monthly Excel endpoint with current month
        await downloadMonthlyReportExcel(new Date().getMonth() + 1, new Date().getFullYear());
      }
      setToast({ message: 'Report downloaded successfully!', type: 'success' });
    } catch (error) {
      console.error('Error downloading report:', error);
      setToast({ message: 'Failed to download report', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-text-muted">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">No analytics data available</p>
      </div>
    );
  }

  const { summary, dailyRevenue, paymentModeStats } = analytics;
  const maxRevenue = getMaxRevenue();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        {/* Period Selector */}
        <div className="bg-gradient-to-r from-primary/5 via-accent/3 to-secondary/5 rounded-xl p-4 border border-border/50 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-surface rounded-lg p-1 border border-border/50">
                <button
                  onClick={() => {
                    setViewMode('month');
                    setDays(null);
                  }}
                  className={`px-4 py-2 rounded-md font-medium transition-all ${
                    viewMode === 'month'
                      ? 'bg-primary text-white shadow-md'
                      : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => {
                    setViewMode('days');
                    setDays(7);
                  }}
                  className={`px-4 py-2 rounded-md font-medium transition-all ${
                    viewMode === 'days'
                      ? 'bg-primary text-white shadow-md'
                      : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                >
                  Days
                </button>
                <button
                  onClick={() => {
                    setViewMode('day');
                    setDays(null);
                  }}
                  className={`px-4 py-2 rounded-md font-medium transition-all ${
                    viewMode === 'day'
                      ? 'bg-primary text-white shadow-md'
                      : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                >
                  Day
                </button>
              </div>
              
              {viewMode === 'month' ? (
                <div className="flex items-center gap-2 bg-surface rounded-lg px-4 py-2 border border-border/50">
                  <Calendar size={16} className="text-primary" />
                  <select
                    value={`${selectedYear}-${selectedMonth}`}
                    onChange={(e) => {
                      const [year, month] = e.target.value.split('-').map(Number);
                      setSelectedYear(year);
                      setSelectedMonth(month);
                    }}
                    className="bg-transparent font-medium text-text-main focus:outline-none cursor-pointer"
                  >
                    {getAvailableMonths().map((m) => (
                      <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : viewMode === 'days' ? (
                <div className="flex items-center gap-2 bg-surface rounded-lg p-1 border border-border/50">
                  {[7, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`px-4 py-2 rounded-md font-medium transition-all ${
                        days === d
                          ? 'bg-primary text-white shadow-md'
                          : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-surface rounded-lg px-4 py-2 border border-border/50">
                  <Calendar size={16} className="text-primary" />
                  <input
                    type="date"
                    value={selectedDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent font-medium text-text-main focus:outline-none cursor-pointer"
                  />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-2 px-4 py-2.5 bg-success hover:bg-success/90 rounded-lg border border-success transition-all text-white shadow-sm hover:shadow-md font-medium"
              >
                <FileSpreadsheet size={16} />
                <span className="text-sm">Download Report</span>
              </button>
              <button
                onClick={fetchAnalytics}
                className="flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-surface-hover rounded-lg border border-border/50 transition-all text-text-main shadow-sm hover:shadow-md font-medium"
              >
                <RefreshCw size={16} />
                <span className="text-sm">Refresh</span>
              </button>
              <button
                onClick={fetchFraudAnalysis}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-all shadow-sm hover:shadow-md font-bold ml-2"
              >
                <ShieldAlert size={16} />
                <span className="text-sm hidden sm:inline">Silent Auditor</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Bills */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-5 border border-primary/20 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Receipt className="text-primary" size={20} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Total Bills</p>
              <p className="text-2xl font-bold text-text-main leading-tight">{summary.totalBills.toLocaleString()}</p>
            </div>
          </div>

          {/* Total Orders */}
          <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-xl p-5 border border-secondary/20 shadow-sm hover:shadow-lg hover:border-secondary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center">
                <ShoppingBag className="text-secondary" size={20} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Total Orders</p>
              <p className="text-2xl font-bold text-text-main leading-tight">{summary.totalOrders.toLocaleString()}</p>
            </div>
          </div>

          {/* Today's Revenue */}
          <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-xl p-5 border border-success/20 shadow-sm hover:shadow-lg hover:border-success/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-success/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-success" size={20} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Today's Revenue</p>
              <p className="text-2xl font-bold text-text-main leading-tight">{formatCurrency(summary.today.revenue)}</p>
            </div>
          </div>

          {/* Period Revenue */}
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl p-5 border border-accent/20 shadow-sm hover:shadow-lg hover:border-accent/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <DollarSign className="text-accent" size={20} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                {viewMode === 'month' ? `${getMonthName(selectedMonth)} ${selectedYear}` : `${days} Days`} Revenue
              </p>
              <p className="text-2xl font-bold text-text-main leading-tight">{formatCurrency(summary.period.revenue)}</p>
            </div>
          </div>

          {/* Delivery Orders */}
          <div className="bg-gradient-to-br from-orange-100/50 to-orange-50/30 rounded-xl p-5 border border-orange-200/50 shadow-sm hover:shadow-lg hover:border-orange-300/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-orange-200/50 rounded-lg flex items-center justify-center">
                <Truck className="text-orange-600" size={20} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Delivery Orders</p>
              <p className="text-2xl font-bold text-text-main leading-tight">{summary.period.deliveryOrders?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Daily Revenue Chart */}
          <div className="bg-surface rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="text-primary" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-main">Daily Revenue & Orders</h2>
                  <p className="text-xs text-text-muted">
                    {viewMode === 'month' 
                      ? `${getMonthName(selectedMonth)} ${selectedYear}` 
                      : `Last ${days} days`}
                  </p>
                </div>
              </div>
            </div>
            
            {dailyRevenue && dailyRevenue.length > 0 ? (
              <div className="space-y-4">
                {/* Professional Chart */}
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis 
                        dataKey="_id" 
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getDate()}/${d.getMonth()+1}`;
                        }}
                        tick={{ fontSize: 11, fill: '#8b8d97' }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        tickFormatter={(val) => {
                          if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
                          return `₹${val}`;
                        }}
                        tick={{ fontSize: 11, fill: '#8b8d97' }}
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-3 z-50">
                                <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">{formatDate(data._id)}</p>
                                <p className="text-orange-500 font-bold text-lg">{formatCurrency(data.revenue)}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                                  Orders: {data.orders} • Bills: {data.bills}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {dailyRevenue.map((entry, index) => (
                          <Cell key={`cell-${index}`} className="fill-primary hover:opacity-80 transition-opacity" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Daily Breakdown Table */}
                <div className="mt-6 border border-border/50 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-primary/5 px-4 py-3 border-b border-border/50">
                    <h3 className="font-bold text-text-main text-sm">Daily Breakdown</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-surface-hover sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-bold text-text-muted uppercase">Date</th>
                          <th className="text-right px-4 py-2 text-xs font-bold text-text-muted uppercase">Revenue</th>
                          <th className="text-right px-4 py-2 text-xs font-bold text-text-muted uppercase">Bills</th>
                          <th className="text-right px-4 py-2 text-xs font-bold text-text-muted uppercase">Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyRevenue.map((day, index) => (
                          <tr key={index} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                            <td className="px-4 py-2 text-sm font-medium text-text-main">
                              {formatDate(day._id)}
                            </td>
                            <td className="px-4 py-2 text-sm font-bold text-text-main text-right">
                              {formatCurrency(day.revenue)}
                            </td>
                            <td className="px-4 py-2 text-sm text-text-muted text-right">
                              {day.bills}
                            </td>
                            <td className="px-4 py-2 text-sm text-text-muted text-right">
                              {day.orders}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="text-center">
                    <p className="text-xs text-text-muted">Total Revenue</p>
                    <p className="text-lg font-bold text-text-main">
                      {formatCurrency(dailyRevenue.reduce((sum, d) => sum + d.revenue, 0))}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-text-muted">Total Bills</p>
                    <p className="text-lg font-bold text-text-main">
                      {dailyRevenue.reduce((sum, d) => sum + d.bills, 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-text-muted">Avg Daily</p>
                    <p className="text-lg font-bold text-text-main">
                      {formatCurrency(
                        dailyRevenue.reduce((sum, d) => sum + d.revenue, 0) / dailyRevenue.length
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-text-muted">
                <p>No revenue data for the selected period</p>
              </div>
            )}
          </div>

          {/* Payment Mode Breakdown */}
          <div className="bg-surface rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center">
                  <CreditCard className="text-secondary" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-main">Payment Methods</h2>
                  <p className="text-xs text-text-muted">
                    {viewMode === 'month' 
                      ? `${getMonthName(selectedMonth)} ${selectedYear}` 
                      : `Last ${days} days`}
                  </p>
                </div>
              </div>
            </div>
            
            {paymentModeStats && paymentModeStats.length > 0 ? (
              <div className="space-y-2.5">
                {paymentModeStats.map((stat, index) => {
                  const totalRevenue = paymentModeStats.reduce((sum, s) => sum + s.revenue, 0);
                  const percentage = totalRevenue > 0 ? (stat.revenue / totalRevenue) * 100 : 0;
                  const colors = [
                    'from-primary to-primary/60',
                    'from-secondary to-secondary/60',
                    'from-accent to-accent/60'
                  ];
                  const colorClass = colors[index % colors.length];
                  
                  return (
                    <div key={stat._id || index} className="space-y-2 p-3 bg-surface/50 rounded-lg border border-border/30 hover:border-border/50 transition-all duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 bg-gradient-to-br ${colorClass} rounded-lg flex items-center justify-center text-white shadow-sm`}>
                            {getPaymentModeIcon(stat._id)}
                          </div>
                          <div>
                            <p className="font-bold text-text-main text-sm">{stat._id || 'Unknown'}</p>
                            <p className="text-xs text-text-muted">{stat.count} txns</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-text-main text-base">{formatCurrency(stat.revenue)}</p>
                          <p className="text-xs text-text-muted">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-border/50 rounded-full h-2 overflow-hidden shadow-inner">
                        <div
                          className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500 shadow-sm`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-4 border-t border-border/50 mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-text-muted">Total</p>
                    <p className="text-lg font-bold text-text-main">
                      {formatCurrency(
                        paymentModeStats.reduce((sum, s) => sum + s.revenue, 0)
                      )}
                    </p>
                  </div>
                  
                  {/* Payment Insights */}
                  {paymentModeStats.length > 0 && (() => {
                    const totalRevenue = paymentModeStats.reduce((sum, s) => sum + s.revenue, 0);
                    const totalTransactions = paymentModeStats.reduce((sum, s) => sum + s.count, 0);
                    const mostPopularByCount = paymentModeStats.reduce((max, stat) => 
                      stat.count > max.count ? stat : max, paymentModeStats[0]
                    );
                    const mostRevenue = paymentModeStats.reduce((max, stat) => 
                      stat.revenue > max.revenue ? stat : max, paymentModeStats[0]
                    );
                    const avgTransactionValue = totalRevenue / totalTransactions;
                    const leastUsed = paymentModeStats.reduce((min, stat) => 
                      stat.count < min.count ? stat : min, paymentModeStats[0]
                    );
                    const revenueShare = paymentModeStats.map(stat => ({
                      method: stat._id,
                      share: ((stat.revenue / totalRevenue) * 100).toFixed(1)
                    }));
                    
                    return (
                      <div className="pt-3 border-t border-border/30 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-primary/5 rounded-lg p-2.5 border border-primary/10">
                            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Most Popular</p>
                            <p className="text-xs font-bold text-text-main">{mostPopularByCount._id}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">{mostPopularByCount.count} txns</p>
                          </div>
                          <div className="bg-success/5 rounded-lg p-2.5 border border-success/10">
                            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Top Revenue</p>
                            <p className="text-xs font-bold text-text-main">{mostRevenue._id}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">{formatCurrency(mostRevenue.revenue)}</p>
                          </div>
                          <div className="bg-accent/5 rounded-lg p-2.5 border border-accent/10">
                            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Avg Transaction</p>
                            <p className="text-xs font-bold text-text-main">{formatCurrency(avgTransactionValue)}</p>
                          </div>
                          <div className="bg-secondary/5 rounded-lg p-2.5 border border-secondary/10">
                            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Total Transactions</p>
                            <p className="text-xs font-bold text-text-main">{totalTransactions}</p>
                          </div>
                        </div>
                        <div className="bg-surface/50 rounded-lg p-2.5 border border-border/30">
                          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">Revenue Share</p>
                          <div className="space-y-1.5">
                            {revenueShare.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className="text-xs text-text-muted">{item.method}</span>
                                <span className="text-xs font-bold text-text-main">{item.share}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-orange-50/50 dark:bg-orange-950/10 rounded-lg p-2.5 border border-orange-200/30">
                          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Least Used</p>
                          <p className="text-xs font-bold text-text-main">{leastUsed._id}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">Consider promoting this method</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-text-muted">
                <p>No payment data for the selected period</p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface/80 backdrop-blur-sm rounded-xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="text-primary" size={20} />
              </div>
              <h3 className="font-bold text-text-main text-sm">Period Summary</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Bills</span>
                <span className="font-bold text-text-main text-base">{summary.period.bills}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Orders</span>
                <span className="font-bold text-text-main text-base">{summary.period.orders}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Avg Bill</span>
                <span className="font-bold text-text-main text-base">
                  {formatCurrency(summary.period.averageBill)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface/80 backdrop-blur-sm rounded-xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-success" size={20} />
              </div>
              <h3 className="font-bold text-text-main text-sm">Discounts & Tax</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Total Discount</span>
                <span className="font-bold text-text-main text-base">
                  {formatCurrency(summary.period.discount)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Total Tax</span>
                <span className="font-bold text-text-main text-base">
                  {formatCurrency(summary.period.tax)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Net Revenue</span>
                <span className="font-bold text-success text-base">
                  {formatCurrency(summary.period.revenue)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface/80 backdrop-blur-sm rounded-xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Receipt className="text-accent" size={20} />
              </div>
              <h3 className="font-bold text-text-main text-sm">Today's Performance</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Bills</span>
                <span className="font-bold text-text-main text-base">{summary.today.bills}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Orders</span>
                <span className="font-bold text-text-main text-base">{summary.today.orders}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Avg Bill</span>
                <span className="font-bold text-text-main text-base">
                  {formatCurrency(summary.today.averageBill)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Fraud Analysis Modal */}
      {showFraudModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border/50 flex justify-between items-center bg-red-50/50 dark:bg-red-950/20">
              <div>
                <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6" />
                  AI Silent Auditor
                </h2>
                <p className="text-sm text-red-600/70 mt-1">Analyzing last 30 days of billing activity for fraud & anomalies.</p>
              </div>
              <button onClick={() => setShowFraudModal(false)} className="p-2 hover:bg-red-100 rounded-lg text-red-500 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-background">
              {fraudLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <ShieldAlert className="w-16 h-16 text-red-500 animate-pulse" />
                    <RefreshCw className="w-6 h-6 text-red-500 animate-spin absolute -bottom-2 -right-2 bg-white rounded-full" />
                  </div>
                  <p className="mt-6 text-text-main font-bold text-lg">Scanning Database...</p>
                  <p className="text-text-muted mt-2 text-sm">Looking for cancelled bills, unusual discounts, and staff patterns.</p>
                </div>
              ) : fraudData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface border border-border rounded-xl p-4 text-center">
                      <p className="text-text-muted text-sm uppercase font-bold mb-1">Bills Analyzed</p>
                      <p className="text-3xl font-black text-text-main">{fraudData.totalAnalyzed}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 rounded-xl p-4 text-center">
                      <p className="text-red-500 text-sm uppercase font-bold mb-1">Anomalies Detected</p>
                      <p className="text-3xl font-black text-red-600">{fraudData.alerts?.length || 0}</p>
                    </div>
                  </div>

                  {fraudData.alerts?.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-bold text-text-main text-lg mb-4 border-b border-border/50 pb-2">Detailed Alerts</h3>
                      {fraudData.alerts.map((alert, i) => (
                        <div key={i} className={`p-4 rounded-xl border flex gap-4 ${
                          alert.severity === 'Critical' ? 'bg-red-50 border-red-300' :
                          alert.severity === 'High' ? 'bg-orange-50 border-orange-300' : 'bg-surface border-border'
                        }`}>
                          <div className={`mt-1 ${
                            alert.severity === 'Critical' ? 'text-red-600' :
                            alert.severity === 'High' ? 'text-orange-600' : 'text-text-muted'
                          }`}>
                            {alert.type === 'Staff Anomaly' ? <UserX size={24} /> : <AlertTriangle size={24} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-text-main">{alert.type}</h4>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                alert.severity === 'Critical' ? 'bg-red-600 text-white' :
                                alert.severity === 'High' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'
                              }`}>{alert.severity}</span>
                            </div>
                            <p className="text-text-muted text-sm">{alert.details}</p>
                            <div className="mt-2 flex gap-4 text-xs font-mono text-text-muted">
                              {alert.tableNo && <span>Table: {alert.tableNo}</span>}
                              {alert.billNumber && <span>Bill: {alert.billNumber}</span>}
                              <span>{new Date(alert.date).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center">
                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-text-main mb-2">No Anomalies Found</h3>
                      <p className="text-text-muted">Your billing activity looks completely normal for the past 30 days.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;

