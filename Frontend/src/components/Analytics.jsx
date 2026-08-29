import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import { getAnalytics, downloadDailyReportCSV, downloadMonthlyReportExcel } from '../api/analytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api/axios';
import { sendWhatsAppBill, sendWhatsAppMessage, getWhatsAppStatus } from '../api/whatsapp';
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
  X,
  DownloadCloud,
  ChevronDown,
  Loader2 } from
'lucide-react';
import Toast from './Toast';

const Analytics = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
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
  const [fraudDays, setFraudDays] = useState(30);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

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

  const fetchFraudAnalysis = async (days = fraudDays) => {
    setFraudLoading(true);
    setShowFraudModal(true);
    setFraudDays(days);
    try {
      const API_BASE_URL = getApiUrl();
      const res = await fetch(`${API_BASE_URL}/ai/fraud-analysis?days=${days}`, {
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
    return Math.max(...analytics.dailyRevenue.map((d) => d.revenue));
  };

  const getPaymentModeIcon = (mode) => {
    switch (mode) {
      case 'Cash':return <Wallet size={20} />;
      case 'UPI':return <Smartphone size={20} />;
      case 'Card':return <CreditCard size={20} />;
      default:return <CreditCard size={20} />;
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

  const handleShareWhatsAppReport = async () => {
    setSendingWhatsApp(true);
    setToast({ message: t("Fetching WhatsApp connection..."), type: 'info' });

    try {
      // Auto-fetch the scanned/connected owner WhatsApp number
      const statusRes = await getWhatsAppStatus();
      if (!statusRes || statusRes.status !== 'CONNECTED' || !statusRes.connectedNumber) {
        setToast({ message: t("WhatsApp is not connected. Please scan the QR code in WhatsApp settings first."), type: 'error' });
        setSendingWhatsApp(false);
        return;
      }

      let cleanPhone = String(statusRes.connectedNumber).replace(/[^0-9]/g, '');
      // connectedNumber from WhatsApp is typically in format 919701800140 (country code + number)
      // Ensure it has country code
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

      setToast({ message: t("Generating & sending WhatsApp analytics report..."), type: 'info' });

      const restSettings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      const restName = restSettings.restaurantName || 'MS BILLINGS RESTAURANT';

      let periodLabel = '';
      if (viewMode === 'month') {
        periodLabel = getMonthName(selectedMonth) + ' ' + selectedYear;
      } else if (viewMode === 'day') {
        periodLabel = selectedDate;
      } else {
        periodLabel = `Last ${days || 7} Days`;
      }

      const totalRevenue = Number(analytics?.summary?.totalRevenue || 0).toLocaleString('en-IN');
      const totalBills = Number(analytics?.summary?.totalBills || 0).toLocaleString('en-IN');
      const totalOrders = Number(analytics?.summary?.totalOrders || 0).toLocaleString('en-IN');

      let paymentBreakdownText = '';
      if (analytics?.paymentModeStats && analytics.paymentModeStats.length > 0) {
        paymentBreakdownText = analytics.paymentModeStats
          .map(p => `• *${p._id}:* ₹${Number(p.revenue || 0).toLocaleString('en-IN')} (${p.count} txns)`)
          .join('\n');
      }

      const READ_MORE = String.fromCharCode(8206).repeat(4001);

      const caption = `📊 *ANALYTICS SALES REPORT* 📊\n` +
        `🏨 *${restName.toUpperCase()}* (${periodLabel})\n` +
        READ_MORE + `\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *SALES SUMMARY*\n` +
        `• *Total Revenue:* ₹${totalRevenue}\n` +
        `• *Total Bills:* ${totalBills}\n` +
        `• *Total Orders:* ${totalOrders}\n\n` +
        (paymentBreakdownText ? `💳 *PAYMENT BREAKDOWN*\n${paymentBreakdownText}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `_Generated automatically via MS Billings POS_`;

      let excelBase64 = null;
      const fileName = `Analytics-Report-${viewMode === 'month' ? `${selectedMonth}-${selectedYear}` : viewMode === 'day' ? selectedDate : `${days}days`}.xlsx`;

      try {
        let endpoint = `/analytics/download/monthly/excel?`;
        if (viewMode === 'month') {
          endpoint += `month=${selectedMonth}&year=${selectedYear}`;
        } else {
          endpoint += `month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`;
        }
        const response = await api.get(endpoint, { responseType: 'arraybuffer' });
        const bytes = new Uint8Array(response.data);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        excelBase64 = window.btoa(binary);
      } catch (excelErr) {
        console.warn('Could not generate Excel attachment, sending text only:', excelErr);
      }

      let res;
      if (excelBase64) {
        res = await sendWhatsAppBill(
          cleanPhone,
          caption,
          null,
          null,
          fileName,
          excelBase64,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      } else {
        res = await sendWhatsAppMessage(cleanPhone, caption);
      }

      if (res && res.success) {
        setToast({ message: `${t("Analytics report sent to")} +${cleanPhone} ${t("via WhatsApp! ✓")}`, type: 'success' });
      }
    } catch (err) {
      console.error('WhatsApp analytics report error:', err);
      const errorMsg = err.response?.data?.error || err.message || t('Failed to send WhatsApp report');
      setToast({ message: `WhatsApp: ${errorMsg}`, type: 'error' });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-text-muted">{t("Loading analytics...")}</p>
        </div>
      </div>);

  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">{t("No analytics data available")}</p>
      </div>);

  }

  const { summary, dailyRevenue, paymentModeStats } = analytics;
  const maxRevenue = getMaxRevenue();
  return (
    <div className="min-h-full h-full bg-[#09090b] text-gray-100 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto">
      {/* Analytics Container - Forcing dark mode */}
      <style>{`
        .glass-card {
          background: rgba(20, 20, 24, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }
      `}</style>      <div className="space-y-3 sm:space-y-4">
        {/* Period Selector */}
        <div className="glass-card p-2.5 sm:p-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            {/* Left Controls: Back + Period Tabs + Date Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <BackButton onClick={onGoBack} className="shrink-0" />
                <div className="flex-1 sm:flex-initial flex items-center gap-0.5 bg-[#1e1e24] rounded-lg p-1 border border-white/10">
                  <button
                    onClick={() => {
                      setViewMode('month');
                      setDays(null);
                    }}
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center ${
                      viewMode === 'month' ?
                      'bg-[#f97316] text-white shadow-md font-bold' :
                      'text-gray-400 hover:text-white hover:bg-white/5'}`
                    }>{t("Month")}
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('days');
                      setDays(7);
                    }}
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center ${
                      viewMode === 'days' ?
                      'bg-[#f97316] text-white shadow-md font-bold' :
                      'text-gray-400 hover:text-white hover:bg-white/5'}`
                    }>{t("Days")}
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('day');
                      setDays(null);
                    }}
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center ${
                      viewMode === 'day' ?
                      'bg-[#f97316] text-white shadow-md font-bold' :
                      'text-gray-400 hover:text-white hover:bg-white/5'}`
                    }>{t("Day")}
                  </button>
                </div>
              </div>
              
              {viewMode === 'month' ? (
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#1e1e24] rounded-lg px-3 py-1.5 border border-white/10 text-xs w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-[#f97316]" />
                    <select
                      value={`${selectedYear}-${selectedMonth}`}
                      onChange={(e) => {
                        const [year, month] = e.target.value.split('-').map(Number);
                        setSelectedYear(year);
                        setSelectedMonth(month);
                      }}
                      className="bg-transparent font-medium text-white focus:outline-none cursor-pointer text-xs">
                      {getAvailableMonths().map((m) => (
                        <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`} className="bg-[#1e1e24] text-white">
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : viewMode === 'days' ? (
                <div className="flex items-center gap-1 bg-[#1e1e24] rounded-lg p-1 border border-white/10 w-full sm:w-auto">
                  {[7, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-md text-xs font-medium transition-all text-center ${
                        days === d ?
                        'bg-[#f97316] text-white shadow-md font-bold' :
                        'text-gray-400 hover:text-white hover:bg-white/5'}`
                      }>
                      {d} {t("Days")}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#1e1e24] rounded-lg px-3 py-1.5 border border-white/10 text-xs w-full sm:w-auto">
                  <div className="flex items-center gap-2 w-full">
                    <Calendar size={13} className="text-[#f97316]" />
                    <input
                      type="date"
                      value={selectedDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent font-medium text-white focus:outline-none cursor-pointer text-xs w-full [color-scheme:dark]" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons: 4 equal-width columns on mobile, auto on tablet/desktop */}
            <div className="grid grid-cols-4 gap-1.5 w-full sm:flex sm:items-center sm:gap-2 sm:w-auto shrink-0">
              <button
                onClick={handleDownloadReport}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 bg-[#22c55e] hover:bg-[#16a34a] rounded-xl transition-all text-white shadow-sm font-bold text-xs cursor-pointer"
                title={t("Download Excel Report")}>
                <FileSpreadsheet size={14} />
                <span>{t("Report")}</span>
              </button>
              <button
                onClick={() => handleShareWhatsAppReport()}
                disabled={sendingWhatsApp}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 bg-[#25D366] hover:bg-[#20bd5a] rounded-xl transition-all text-white shadow-sm font-bold text-xs cursor-pointer disabled:opacity-60"
                title={t("Send Analytics Report on WhatsApp")}>
                {sendingWhatsApp ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                  </svg>
                )}
                <span>{t("WhatsApp")}</span>
              </button>
              <button
                onClick={fetchAnalytics}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 bg-[#1e1e24] hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white shadow-sm font-bold text-xs cursor-pointer">
                <RefreshCw size={14} />
                <span>{t("Refresh")}</span>
              </button>
              <button
                onClick={() => fetchFraudAnalysis()}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all font-bold text-xs cursor-pointer">
                <ShieldAlert size={14} />
                <span>{t("Auditor")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3.5">
          {/* Total Bills */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Receipt className="text-blue-500" size={16} />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t("Total Bills")}</p>
              <p className="text-base sm:text-xl font-bold text-white leading-tight">{summary.totalBills.toLocaleString()}</p>
            </div>
          </div>

          {/* Total Orders */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <ShoppingBag className="text-purple-500" size={16} />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t("Total Orders")}</p>
              <p className="text-base sm:text-xl font-bold text-white leading-tight">{summary.totalOrders.toLocaleString()}</p>
            </div>
          </div>

          {/* Today's Revenue */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center">
                <TrendingUp className="text-[#22c55e]" size={16} />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t("Today's Revenue")}</p>
              <p className="text-base sm:text-xl font-bold text-white leading-tight">{formatCurrency(summary.today.revenue)}</p>
            </div>
          </div>

          {/* Period Revenue */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-[#f97316]/10 flex items-center justify-center">
                <DollarSign className="text-[#f97316]" size={16} />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide truncate" title={viewMode === 'month' ? `${getMonthName(selectedMonth)} ${selectedYear} ${t("Revenue")}` : `${days} Days ${t("Revenue")}`}>
                {viewMode === 'month' ? `${getMonthName(selectedMonth)} ${selectedYear} ` : `${days} Days `}{t("Revenue")}
              </p>
              <p className="text-base sm:text-xl font-bold text-white leading-tight">{formatCurrency(summary.period.revenue)}</p>
            </div>
          </div>

          {/* Delivery Orders */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 transition-all duration-300 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:block">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 sm:mb-1.5">
                  <Truck className="text-yellow-500" size={16} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t("Delivery Orders")}</p>
                  <p className="text-base sm:text-xl font-bold text-white leading-tight sm:hidden">{summary.period.deliveryOrders?.toLocaleString() || 0}</p>
                </div>
              </div>
              <p className="hidden sm:block text-base sm:text-xl font-bold text-white leading-tight">{summary.period.deliveryOrders?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>


        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Daily Revenue Chart */}
          <div className="glass-card p-6 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f97316]/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="text-[#f97316]" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{t("Daily Revenue & Orders")}</h2>
                  <p className="text-xs text-gray-400">
                    {viewMode === 'month' ?
                    `${getMonthName(selectedMonth)} ${selectedYear}` :
                    `Last ${days} days`}
                  </p>
                </div>
              </div>
            </div>
            
            {dailyRevenue && dailyRevenue.length > 0 ?
            <div className="space-y-4">
                {/* Professional Chart */}
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <XAxis
                      dataKey="_id"
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getDate()}/${d.getMonth() + 1}`;
                      }}
                      tick={{ fontSize: 11, fill: '#8b8d97' }}
                      axisLine={false}
                      tickLine={false}
                      dy={10} />
                    
                      <YAxis
                      tickFormatter={(val) => {
                        if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
                        return `₹${val}`;
                      }}
                      tick={{ fontSize: 11, fill: '#8b8d97' }}
                      axisLine={false}
                      tickLine={false}
                      dx={-10} />
                    
                      <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#1e1e1e] border border-gray-800 shadow-xl rounded-lg p-3 z-50">
                                <p className="font-bold text-gray-200 mb-1">{formatDate(data._id)}</p>
                                <p className="text-[#f97316] font-bold text-lg">{formatCurrency(data.revenue)}</p>
                                <p className="text-xs text-gray-400 mt-1 font-medium">{t("Orders:")}
                                {data.orders} {t("• Bills:")} {data.bills}
                                </p>
                              </div>);

                        }
                        return null;
                      }} />
                    
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {dailyRevenue.map((entry, index) =>
                      <Cell key={`cell-${index}`} fill="#f97316" className="hover:opacity-80 transition-opacity" />
                      )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Daily Breakdown Table */}
                <div className="mt-6 border border-white/10 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-[#1e1e24] px-4 py-3 border-b border-white/10">
                    <h3 className="font-bold text-white text-sm">{t("Daily Breakdown")}</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#1e1e24] sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t("Date")}</th>
                          <th className="text-right px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t("Revenue")}</th>
                          <th className="text-right px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t("Bills")}</th>
                          <th className="text-right px-4 py-2 text-xs font-bold text-gray-400 uppercase">{t("Orders")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyRevenue.map((day, index) =>
                      <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2 text-sm font-medium text-white">
                              {formatDate(day._id)}
                            </td>
                            <td className="px-4 py-2 text-sm font-bold text-white text-right">
                              {formatCurrency(day.revenue)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-400 text-right">
                              {day.bills}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-400 text-right">
                              {day.orders}
                            </td>
                          </tr>
                      )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{t("Total Revenue")}</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(dailyRevenue.reduce((sum, d) => sum + d.revenue, 0))}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{t("Total Bills")}</p>
                    <p className="text-lg font-bold text-white">
                      {dailyRevenue.reduce((sum, d) => sum + d.bills, 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{t("Avg Daily")}</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(
                      dailyRevenue.reduce((sum, d) => sum + d.revenue, 0) / dailyRevenue.length
                    )}
                    </p>
                  </div>
                </div>
              </div> :

            <div className="flex items-center justify-center h-64 text-gray-400">
                <p>{t("No revenue data for the selected period")}</p>
              </div>
            }
          </div>

          {/* Payment Mode Breakdown */}
          <div className="glass-card p-6 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <CreditCard className="text-purple-500" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{t("Payment Methods")}</h2>
                  <p className="text-xs text-gray-400">
                    {viewMode === 'month' ?
                    `${getMonthName(selectedMonth)} ${selectedYear}` :
                    `Last ${days} days`}
                  </p>
                </div>
              </div>
            </div>
            
            {paymentModeStats && paymentModeStats.length > 0 ?
            <div className="space-y-2.5">
                {paymentModeStats.map((stat, index) => {
                const totalRevenue = paymentModeStats.reduce((sum, s) => sum + s.revenue, 0);
                const percentage = totalRevenue > 0 ? stat.revenue / totalRevenue * 100 : 0;
                const colors = [
                'from-orange-500 to-orange-400',
                'from-blue-500 to-blue-400',
                'from-green-500 to-green-400'];

                const colorClass = colors[index % colors.length];

                return (
                  <div key={stat._id || index} className="space-y-2 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-all duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-9 h-9 bg-gradient-to-br ${colorClass} rounded-lg flex items-center justify-center text-white shadow-sm`}>
                            {getPaymentModeIcon(stat._id)}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{stat._id || 'Unknown'}</p>
                            <p className="text-xs text-gray-400">{stat.count} {t("txns")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white text-base">{formatCurrency(stat.revenue)}</p>
                          <p className="text-xs text-gray-400">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden shadow-inner">
                        <div
                        className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500 shadow-sm`}
                        style={{ width: `${percentage}%` }} />
                      
                      </div>
                    </div>);

              })}
                <div className="pt-4 border-t border-white/10 mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-400">{t("Total")}</p>
                    <p className="text-lg font-bold text-white">
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
                  const revenueShare = paymentModeStats.map((stat) => ({
                    method: stat._id,
                    share: (stat.revenue / totalRevenue * 100).toFixed(1)
                  }));

                  return (
                    <div className="pt-3 border-t border-white/10 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-[#3b82f6]/10 rounded-lg p-2.5 border border-[#3b82f6]/20">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Most Popular")}</p>
                            <p className="text-xs font-bold text-white">{mostPopularByCount._id}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{mostPopularByCount.count} {t("txns")}</p>
                          </div>
                          <div className="bg-[#22c55e]/10 rounded-lg p-2.5 border border-[#22c55e]/20">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Top Revenue")}</p>
                            <p className="text-xs font-bold text-white">{mostRevenue._id}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{formatCurrency(mostRevenue.revenue)}</p>
                          </div>
                          <div className="bg-[#f97316]/10 rounded-lg p-2.5 border border-[#f97316]/20">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Avg Transaction")}</p>
                            <p className="text-xs font-bold text-white">{formatCurrency(avgTransactionValue)}</p>
                          </div>
                          <div className="bg-[#8b5cf6]/10 rounded-lg p-2.5 border border-[#8b5cf6]/20">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Total Transactions")}</p>
                            <p className="text-xs font-bold text-white">{totalTransactions}</p>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t("Revenue Share")}</p>
                          <div className="space-y-1.5">
                            {revenueShare.map((item, idx) =>
                          <div key={idx} className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">{item.method}</span>
                                <span className="text-xs font-bold text-white">{item.share}%</span>
                              </div>
                          )}
                          </div>
                        </div>
                        <div className="bg-yellow-500/10 rounded-lg p-2.5 border border-yellow-500/20">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Least Used")}</p>
                          <p className="text-xs font-bold text-white">{leastUsed._id}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{t("Consider promoting this method")}</p>
                        </div>
                      </div>);

                })()}
                </div>
              </div> :

            <div className="flex items-center justify-center h-64 text-text-muted">
                <p>{t("No payment data for the selected period")}</p>
              </div>
            }
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 hover:border-white/20 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Calendar className="text-blue-500" size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">{t("Period Summary")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Bills")}</span>
                <span className="font-bold text-white text-base">{summary.period.bills}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Orders")}</span>
                <span className="font-bold text-white text-base">{summary.period.orders}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Avg Bill")}</span>
                <span className="font-bold text-white text-base">
                  {formatCurrency(summary.period.averageBill)}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 hover:border-white/20 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#22c55e]/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-[#22c55e]" size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">{t("Discounts & Tax")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Total Discount")}</span>
                <span className="font-bold text-white text-base">
                  {formatCurrency(summary.period.discount)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Total Tax")}</span>
                <span className="font-bold text-white text-base">
                  {formatCurrency(summary.period.tax)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Net Revenue")}</span>
                <span className="font-bold text-[#22c55e] text-base">
                  {formatCurrency(summary.period.revenue)}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 hover:border-white/20 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f97316]/10 rounded-lg flex items-center justify-center">
                <Receipt className="text-[#f97316]" size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">{t("Today's Performance")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Bills")}</span>
                <span className="font-bold text-white text-base">{summary.today.bills}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Orders")}</span>
                <span className="font-bold text-white text-base">{summary.today.orders}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Avg Bill")}</span>
                <span className="font-bold text-white text-base">
                  {formatCurrency(summary.today.averageBill)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast &&
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)} />

      }

      {/* Fraud Analysis Modal */}
      {showFraudModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141418] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-red-500/10">
              <div>
                <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
                  <ShieldAlert className="w-6 h-6" />{t("AI Silent Auditor")}

              </h2>
                <p className="text-sm text-red-500/80 mt-1">{t("Analyzing last")} {fraudDays} {t("days of billing activity for fraud & anomalies.")}</p>
              </div>
              <div className="flex items-center gap-4">
                <select 
                  className="bg-[#09090b] border border-red-500/30 text-red-500 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-red-500"
                  value={fraudDays}
                  onChange={(e) => fetchFraudAnalysis(parseInt(e.target.value))}
                >
                  <option value={7} className="bg-[#09090b] text-red-500">{t("Last 7 Days")}</option>
                  <option value={30} className="bg-[#09090b] text-red-500">{t("Last 30 Days")}</option>
                  <option value={90} className="bg-[#09090b] text-red-500">{t("Last 3 Months")}</option>
                  <option value={180} className="bg-[#09090b] text-red-500">{t("Last 6 Months")}</option>
                  <option value={365} className="bg-[#09090b] text-red-500">{t("Last 1 Year")}</option>
                </select>
                <button onClick={() => setShowFraudModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {fraudLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <ShieldAlert className="w-16 h-16 text-red-500 animate-pulse" />
                    <RefreshCw className="w-6 h-6 text-red-500 animate-spin absolute -bottom-2 -right-2 bg-[#141418] rounded-full" />
                  </div>
                  <p className="mt-6 text-white font-bold text-lg">{t("Scanning Database...")}</p>
                  <p className="text-gray-400 mt-2 text-sm">{t("Looking for cancelled bills, unusual discounts, and staff patterns.")}</p>
                </div>
              ) : fraudData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                      <p className="text-gray-400 text-sm uppercase font-bold mb-1">{t("Bills Analyzed")}</p>
                      <p className="text-3xl font-black text-white">{fraudData.totalAnalyzed}</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                      <p className="text-red-500 text-sm uppercase font-bold mb-1">{t("Anomalies Detected")}</p>
                      <p className="text-3xl font-black text-red-500">{fraudData.alerts?.length || 0}</p>
                    </div>
                  </div>
                  {fraudData.alerts?.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-bold text-white text-lg mb-4 border-b border-white/10 pb-2">{t("Detailed Alerts")}</h3>
                      {fraudData.alerts.map((alert, i) => (
                        <div key={i} className={`p-4 rounded-xl border flex gap-4 ${
                          alert.severity === 'Critical' ? 'bg-red-500/10 border-red-500/30' :
                          alert.severity === 'High' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/10'}`}>
                          <div className={`mt-1 ${
                            alert.severity === 'Critical' ? 'text-red-500' :
                            alert.severity === 'High' ? 'text-orange-500' : 'text-gray-400'}`}>
                            {alert.type === 'Staff Anomaly' ? <UserX size={24} /> : <AlertTriangle size={24} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-white">{alert.type}</h4>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                alert.severity === 'Critical' ? 'bg-red-500 text-white' :
                                alert.severity === 'High' ? 'bg-orange-500 text-white' : 'bg-gray-600 text-white'}`}>
                                {alert.severity}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm">{alert.details}</p>
                            <div className="mt-2 flex gap-4 text-xs font-mono text-gray-500">
                              {alert.tableNo && <span>{t("Table:")}{alert.tableNo}</span>}
                              {alert.billNumber && <span>{t("Bill:")}{alert.billNumber}</span>}
                              <span>{new Date(alert.date).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center">
                      <div className="w-16 h-16 bg-green-500/10 text-[#22c55e] rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{t("No Anomalies Found")}</h3>
                      <p className="text-gray-400">{t("Your billing activity looks completely normal for the past 30 days.")}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}


      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Analytics;