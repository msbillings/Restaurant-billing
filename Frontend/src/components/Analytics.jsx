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

const AnimatedNumber = ({ value, duration = 800, isCurrency = false, prefix = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const endVal = typeof value === 'number' ? value : Number(String(value || 0).replace(/[^0-9.-]/g, '')) || 0;
    if (endVal === 0) {
      setDisplayValue(0);
      return;
    }

    let startTimestamp = null;
    const startVal = 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      const current = Math.round(startVal + easeProgress * (endVal - startVal));
      setDisplayValue(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    const animFrame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animFrame);
  }, [value, duration]);

  if (isCurrency) {
    return `₹${displayValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  return `${prefix}${displayValue.toLocaleString('en-IN')}${suffix}`;
};

const Analytics = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState(null); // For 7 or 30 days view
  const [viewMode, setViewMode] = useState('month'); // 'month', 'days', or 'day'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [toast, setToast] = useState(null);
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudData, setFraudData] = useState(null);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [fraudDays, setFraudDays] = useState(30);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [animKey, setAnimKey] = useState(1);
  const [animateBars, setAnimateBars] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedMonth, selectedYear, days, viewMode, selectedDate, customStart, customEnd]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setAnimateBars(false);
    try {
      let data;
      if (viewMode === 'custom' && customStart && customEnd) {
        data = await getAnalytics(null, null, null, null, customStart, customEnd);
      } else if (viewMode === 'month') {
        data = await getAnalytics(selectedMonth, selectedYear, null);
      } else if (viewMode === 'day') {
        data = await getAnalytics(null, null, null, selectedDate);
      } else {
        data = await getAnalytics(null, null, days);
      }
      setAnalytics(data);
      setAnimKey(prev => prev + 1);
      setTimeout(() => {
        setAnimateBars(true);
      }, 70);
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

  const getPaymentModeInfo = (mode) => {
    const m = (mode || '').toLowerCase();
    if (m.includes('cash')) {
      return {
        icon: <Wallet size={18} />,
        gradient: 'from-blue-500 to-cyan-400',
        bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      };
    }
    if (m.includes('upi')) {
      return {
        icon: <Smartphone size={18} />,
        gradient: 'from-amber-500 to-orange-400',
        bg: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      };
    }
    if (m.includes('card')) {
      return {
        icon: <CreditCard size={18} />,
        gradient: 'from-emerald-500 to-teal-400',
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      };
    }
    if (m.includes('mixed')) {
      return {
        icon: <BarChart3 size={18} />,
        gradient: 'from-purple-500 to-indigo-400',
        bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      };
    }
    return {
      icon: <CreditCard size={18} />,
      gradient: 'from-rose-500 to-pink-400',
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    };
  };

  const handleDownloadReport = async () => {
    try {
      setToast({ message: 'Generating report...', type: 'info' });
      let restSettings = {};
      try {
        const configRes = await api.get('/config/info');
        restSettings = configRes.data?.restaurantSettings || configRes.data || {};
      } catch (e) {
        restSettings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      }
      const restName = restSettings.restaurantName || 'RESTAURANT';

      if (viewMode === 'custom' && customStart && customEnd) {
        await downloadMonthlyReportExcel(null, null, null, null, customStart, customEnd, restName);
      } else if (viewMode === 'month') {
        await downloadMonthlyReportExcel(selectedMonth, selectedYear, null, null, null, null, restName);
      } else if (viewMode === 'day') {
        await downloadMonthlyReportExcel(null, null, null, selectedDate, null, null, restName);
      } else if (days) {
        await downloadMonthlyReportExcel(null, null, days, null, null, null, restName);
      } else {
        await downloadMonthlyReportExcel(new Date().getMonth() + 1, new Date().getFullYear(), null, null, null, null, restName);
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
      let statusRes = await getWhatsAppStatus();
      if (!statusRes || statusRes.status !== 'CONNECTED' || !statusRes.connectedNumber) {
        // Fast retry to allow 24/7 background supervisor to complete auto-reconnect
        await new Promise(r => setTimeout(r, 600));
        statusRes = await getWhatsAppStatus();
      }

      if (!statusRes || (statusRes.status !== 'CONNECTED' && statusRes.status !== 'CONNECTING')) {
        setToast({ message: t("WhatsApp is not connected. Please scan the QR code in WhatsApp settings first."), type: 'error' });
        setSendingWhatsApp(false);
        return;
      }

      let restSettings = {};
      try {
        const configRes = await api.get('/config/info');
        restSettings = configRes.data?.restaurantSettings || configRes.data || {};
      } catch (e) {
        restSettings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      }

      const targetPhone = restSettings.whatsappNumber || statusRes.connectedNumber || restSettings.phone;
      let cleanPhone = String(targetPhone).replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

      setToast({ message: t("Generating & sending WhatsApp analytics report..."), type: 'info' });

      const restName = restSettings.restaurantName || statusRes.restaurantName || 'MS BILLINGS RESTAURANT';

      const getPeriodLabelText = () => {
        if (viewMode === 'month') return `${getMonthName(selectedMonth)} ${selectedYear}`;
        if (viewMode === 'day') return selectedDate;
        if (viewMode === 'custom') {
          if (customStart && customEnd) return `${formatDate(customStart)} to ${formatDate(customEnd)}`;
          return 'Custom Period';
        }
        return `Last ${days} Days`;
      };
      
      const periodLabel = getPeriodLabelText();

      const totalRevenue = Number(analytics?.summary?.period?.revenue || 0).toLocaleString('en-IN');
      const totalBills = Number(analytics?.summary?.period?.bills || 0).toLocaleString('en-IN');
      const totalOrders = Number(analytics?.summary?.period?.orders || 0).toLocaleString('en-IN');

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

      const payload = {
        phone: cleanPhone,
        restaurantName: restName,
        caption
      };
      if (viewMode === 'custom' && customStart && customEnd) {
        payload.customStart = customStart;
        payload.customEnd = customEnd;
      } else if (viewMode === 'month') {
        payload.month = selectedMonth;
        payload.year = selectedYear;
      } else if (viewMode === 'day') {
        payload.date = selectedDate;
      } else if (days) {
        payload.days = days;
      } else {
        payload.month = new Date().getMonth() + 1;
        payload.year = new Date().getFullYear();
      }

      try {
        let directRes;
        try {
          directRes = await api.post('/analytics/whatsapp', payload);
        } catch (firstErr) {
          console.warn('Analytics WhatsApp post attempt 1 failed, retrying after auto-reconnect...', firstErr?.message);
          await new Promise(r => setTimeout(r, 800));
          directRes = await api.post('/analytics/whatsapp', payload);
        }

        if (directRes.data && directRes.data.success) {
          setToast({ message: `${t("Analytics Excel report sent to")} +${cleanPhone} ${t("via WhatsApp! ✓")}`, type: 'success' });
          return;
        } else {
          throw new Error(directRes.data?.error || t('Failed to send Analytics Excel sheet via WhatsApp'));
        }
      } catch (directErr) {
        console.error('Analytics WhatsApp send error:', directErr);
        const errorMsg = directErr.response?.data?.error || directErr.message || t('Failed to send Analytics Excel sheet via WhatsApp');
        setToast({ message: `WhatsApp: ${errorMsg}`, type: 'error' });
      }
    } catch (err) {
      console.error('WhatsApp analytics report error:', err);
      const errorMsg = err.response?.data?.error || err.message || t('Failed to send WhatsApp report');
      setToast({ message: `WhatsApp: ${errorMsg}`, type: 'error' });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <RefreshCw className="animate-spin text-[#f97316]" size={36} />
            <div className="absolute inset-0 rounded-full bg-[#f97316]/20 blur-md animate-pulse" />
          </div>
          <p className="text-gray-400 font-medium text-sm">{t("Loading analytics...")}</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-gray-400">{t("No analytics data available")}</p>
      </div>
    );
  }

  const { summary, dailyRevenue, paymentModeStats } = analytics;
  const maxRevenue = getMaxRevenue();

  const getPeriodLabel = () => {
    if (viewMode === 'month') return `${getMonthName(selectedMonth)} ${selectedYear}`;
    if (viewMode === 'day') return selectedDate;
    if (viewMode === 'custom') {
      if (customStart && customEnd) {
        return `${formatDate(customStart)} to ${formatDate(customEnd)}`;
      }
      return 'Custom Period';
    }
    return `Last ${days} Days`;
  };

  return (
    <div className="min-h-full h-full bg-[#09090b] text-gray-100 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto" key={`analytics-view-${animKey}`}>
      {/* Analytics Dynamic Styles & Keyframe Animations */}
      <style>{`
        .glass-card {
          background: rgba(20, 20, 24, 0.65);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .animate-shimmer {
          animation: shimmer 2.4s infinite linear;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-card-entry {
          animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes pulseSoft {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.03); opacity: 1; }
        }
        .animate-pulse-soft {
          animation: pulseSoft 3s infinite ease-in-out;
        }
      `}</style>

      <div className="space-y-3 sm:space-y-4">
        {/* Period Selector */}
        <div className="glass-card p-2.5 sm:p-3.5 animate-card-entry" style={{ animationDelay: '0ms' }}>
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
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center cursor-pointer ${
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
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center cursor-pointer ${
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
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center cursor-pointer ${
                      viewMode === 'day' ?
                      'bg-[#f97316] text-white shadow-md font-bold' :
                      'text-gray-400 hover:text-white hover:bg-white/5'}`
                    }>{t("Day")}
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('custom');
                      setDays(null);
                    }}
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all text-center cursor-pointer ${
                      viewMode === 'custom' ?
                      'bg-[#f97316] text-white shadow-md font-bold' :
                      'text-gray-400 hover:text-white hover:bg-white/5'}`
                    }>{t("Custom")}
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
                      className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-md text-xs font-medium transition-all text-center cursor-pointer ${
                        days === d ?
                        'bg-[#f97316] text-white shadow-md font-bold' :
                        'text-gray-400 hover:text-white hover:bg-white/5'}`
                      }>
                      {d} {t("Days")}
                    </button>
                  ))}
                </div>
              ) : viewMode === 'custom' ? (
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#1e1e24] rounded-lg px-3 py-1.5 border border-white/10 text-xs w-full sm:w-auto">
                  <div className="flex items-center gap-2 w-full">
                    <Calendar size={13} className="text-[#f97316]" />
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => {
                        setCustomStart(e.target.value);
                        if (customEnd && e.target.value > customEnd) {
                          setCustomEnd(e.target.value);
                        }
                      }}
                      className="bg-transparent font-medium text-white focus:outline-none cursor-pointer text-xs w-full [color-scheme:dark]" />
                    <span className="text-gray-400">to</span>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="bg-transparent font-medium text-white focus:outline-none cursor-pointer text-xs w-full [color-scheme:dark]" />
                  </div>
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
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 rounded-xl transition-all text-white shadow-sm font-bold text-xs cursor-pointer"
                title={t("Download Excel Report")}>
                <FileSpreadsheet size={14} />
                <span>{t("Report")}</span>
              </button>
              <button
                onClick={() => handleShareWhatsAppReport()}
                disabled={sendingWhatsApp}
                className={`flex items-center justify-center gap-2 px-2.5 py-2 sm:px-3.5 sm:py-2 rounded-xl transition-all font-bold text-xs cursor-pointer relative overflow-hidden ${
                  sendingWhatsApp
                    ? 'bg-gradient-to-r from-[#25D366]/25 via-[#10B981]/40 to-[#25D366]/25 border border-[#25D366] text-[#25D366] animate-wa-pulse-ring shadow-[0_0_25px_rgba(37,211,102,0.5)] cursor-wait ring-2 ring-[#25D366]/60'
                    : 'bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-sm active:scale-95'
                }`}
                title={t("Send Analytics Report on WhatsApp")}>
                {sendingWhatsApp ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-wa-shimmer pointer-events-none" />
                    <div className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-[#25D366] via-[#86efac] to-[#25D366] animate-wa-progress pointer-events-none rounded-full shadow-[0_0_8px_#25D366]" />
                    <div className="relative flex items-center justify-center shrink-0 w-3.5 h-3.5 z-10">
                      <Loader2 size={16} className="animate-spin text-[#25D366] absolute -inset-0.5" />
                      <svg className="w-2 h-2 fill-[#25D366] animate-pulse z-10" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                    </div>
                    <span className="relative z-10 font-extrabold tracking-wide text-[#25D366] drop-shadow-[0_0_8px_rgba(37,211,102,0.8)] flex items-center gap-0.5">
                      <span>{t("Sending")}</span>
                      <span className="animate-pulse font-mono font-black">...</span>
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    <span>{t("WhatsApp")}</span>
                  </>
                )}
              </button>
              <button
                onClick={fetchAnalytics}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 bg-[#1e1e24] hover:bg-white/10 active:scale-95 rounded-xl border border-white/10 transition-all text-white shadow-sm font-bold text-xs cursor-pointer">
                <RefreshCw size={14} className={loading ? 'animate-spin text-[#f97316]' : ''} />
                <span>{t("Refresh")}</span>
              </button>
              <button
                onClick={() => fetchFraudAnalysis()}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2 bg-red-500/10 hover:bg-red-500/20 active:scale-95 text-red-400 rounded-xl border border-red-500/20 transition-all font-bold text-xs cursor-pointer">
                <ShieldAlert size={14} />
                <span>{t("Auditor")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards with Staggered Entrance & Animated Counter */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3.5">
          {/* Total Bills */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 animate-card-entry shadow-sm" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                <Receipt size={16} />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t("Total Bills")}</p>
              <p className="text-base sm:text-xl font-bold text-white leading-tight">
                <AnimatedNumber value={summary.period.bills} />
              </p>
            </div>
          </div>

          {/* Total Orders */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 animate-card-entry shadow-sm" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
                <ShoppingBag size={16} />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t("Total Orders")}</p>
              <p className="text-base sm:text-xl font-bold text-white leading-tight">
                <AnimatedNumber value={summary.period.orders} />
              </p>
            </div>
          </div>


          {/* Period Revenue */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 animate-card-entry shadow-sm" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-[#f97316]/10 flex items-center justify-center text-[#f97316] shadow-[0_0_12px_rgba(249,115,22,0.15)]">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide truncate" title={`${getPeriodLabel()} ${t("Revenue")}`}>
                {getPeriodLabel()} {t("Revenue")}
              </p>
              <p className="text-base sm:text-xl font-bold text-white leading-tight">
                <AnimatedNumber value={summary.period.revenue} isCurrency={true} />
              </p>
            </div>
          </div>

          {/* Delivery Orders */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 col-span-2 md:col-span-1 animate-card-entry shadow-sm" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:block">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 sm:mb-1.5 text-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.15)]">
                  <Truck size={16} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t("Delivery Orders")}</p>
                  <p className="text-base sm:text-xl font-bold text-white leading-tight sm:hidden">
                    <AnimatedNumber value={summary.period.deliveryOrders || 0} />
                  </p>
                </div>
              </div>
              <p className="hidden sm:block text-base sm:text-xl font-bold text-white leading-tight">
                <AnimatedNumber value={summary.period.deliveryOrders || 0} />
              </p>
            </div>
          </div>

          {/* Pick Up Orders */}
          <div className="glass-card p-3 sm:p-4 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 col-span-2 md:col-span-1 animate-card-entry shadow-sm" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:block">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0 sm:mb-1.5 text-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.15)]">
                  <ShoppingBag size={16} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t("Pick Up Orders")}</p>
                  <p className="text-base sm:text-xl font-bold text-white leading-tight sm:hidden">
                    <AnimatedNumber value={summary.period.pickupOrders || 0} />
                  </p>
                </div>
              </div>
              <p className="hidden sm:block text-base sm:text-xl font-bold text-white leading-tight">
                <AnimatedNumber value={summary.period.pickupOrders || 0} />
              </p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Daily Revenue Chart */}
          <div className="glass-card p-6 hover:border-white/20 transition-all duration-300 animate-card-entry" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#f97316]/10 rounded-xl flex items-center justify-center text-[#f97316] shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{t("Daily Revenue & Orders")}</h2>
                  <p className="text-xs text-gray-400">
                    {getPeriodLabel()}
                  </p>
                </div>
              </div>
            </div>
            
            {dailyRevenue && dailyRevenue.length > 0 ? (
              <div className="space-y-4">
                {/* Professional Animated Chart */}
                <div className="h-64 w-full" key={`chart-container-${animKey}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barOrangeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fb923c" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#ea580c" stopOpacity={0.85}/>
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="_id"
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getDate()}/${d.getMonth() + 1}`;
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
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#18181b] border border-white/15 shadow-2xl rounded-xl p-3 z-50 animate-in zoom-in-95 duration-100">
                                <p className="font-bold text-gray-200 mb-1">{formatDate(data._id)}</p>
                                <p className="text-[#f97316] font-extrabold text-lg">{formatCurrency(data.revenue)}</p>
                                <p className="text-xs text-gray-400 mt-1 font-medium">
                                  {t("Orders:")} {data.orders} {t("• Bills:")} {data.bills}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="revenue" 
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={50}
                        isAnimationActive={true}
                        animationDuration={1100}
                        animationEasing="ease-out"
                        animationBegin={80}
                      >
                        {dailyRevenue.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill="url(#barOrangeGradient)" 
                            className="hover:opacity-85 transition-all duration-200 cursor-pointer filter drop-shadow-[0_2px_8px_rgba(249,115,22,0.25)]" 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Daily Breakdown Table */}
                <div className="mt-6 border border-white/10 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-[#1e1e24] px-4 py-3 border-b border-white/10">
                    <h3 className="font-bold text-white text-sm">{t("Daily Breakdown")}</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
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
                        {dailyRevenue.map((day, index) => (
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{t("Total Revenue")}</p>
                    <p className="text-lg font-bold text-white">
                      <AnimatedNumber value={dailyRevenue.reduce((sum, d) => sum + d.revenue, 0)} isCurrency={true} />
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{t("Total Bills")}</p>
                    <p className="text-lg font-bold text-white">
                      <AnimatedNumber value={dailyRevenue.reduce((sum, d) => sum + d.bills, 0)} />
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">{t("Avg Daily")}</p>
                    <p className="text-lg font-bold text-white">
                      <AnimatedNumber 
                        value={dailyRevenue.length > 0 ? dailyRevenue.reduce((sum, d) => sum + d.revenue, 0) / dailyRevenue.length : 0} 
                        isCurrency={true} 
                      />
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <p>{t("No revenue data for the selected period")}</p>
              </div>
            )}
          </div>

          {/* Payment Mode Breakdown with Animated Range Bars */}
          <div className="glass-card p-6 hover:border-white/20 transition-all duration-300 animate-card-entry" style={{ animationDelay: '350ms' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{t("Payment Methods")}</h2>
                  <p className="text-xs text-gray-400">
                    {getPeriodLabel()}
                  </p>
                </div>
              </div>
            </div>
            
            {paymentModeStats && paymentModeStats.length > 0 ? (
              <div className="space-y-3">
                {paymentModeStats.map((stat, index) => {
                  const totalRevenue = paymentModeStats.reduce((sum, s) => sum + s.revenue, 0);
                  const percentage = totalRevenue > 0 ? (stat.revenue / totalRevenue) * 100 : 0;
                  const modeInfo = getPaymentModeInfo(stat._id);

                  return (
                    <div 
                      key={stat._id || index} 
                      className="space-y-2 p-3 bg-white/[0.04] hover:bg-white/[0.07] rounded-xl border border-white/5 hover:border-white/15 transition-all duration-300 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 bg-gradient-to-br ${modeInfo.gradient} rounded-xl flex items-center justify-center text-white shadow-md`}>
                            {modeInfo.icon}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{stat._id || 'Unknown'}</p>
                            <p className="text-xs text-gray-400">{stat.count} {t("txns")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white text-base">
                            <AnimatedNumber value={stat.revenue} isCurrency={true} />
                          </p>
                          <p className="text-xs text-gray-400 font-mono">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>

                      {/* Animated Range Progress Bar with Shimmer Effect */}
                      <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden shadow-inner p-[1px] relative">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${modeInfo.gradient} transition-all duration-1000 ease-out shadow-sm relative overflow-hidden`}
                          style={{ 
                            width: animateBars ? `${Math.max(percentage, 1)}%` : '0%',
                            transitionDelay: `${index * 120}ms`
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer" />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-white/10 mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-400">{t("Total")}</p>
                    <p className="text-lg font-bold text-white">
                      <AnimatedNumber 
                        value={paymentModeStats.reduce((sum, s) => sum + s.revenue, 0)} 
                        isCurrency={true} 
                      />
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
                    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
                    const leastUsed = paymentModeStats.reduce((min, stat) =>
                      stat.count < min.count ? stat : min, paymentModeStats[0]
                    );
                    const revenueShare = paymentModeStats.map((stat) => ({
                      method: stat._id,
                      share: totalRevenue > 0 ? (stat.revenue / totalRevenue * 100).toFixed(1) : '0.0'
                    }));

                    return (
                      <div className="pt-3 border-t border-white/10 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-[#3b82f6]/10 rounded-xl p-2.5 border border-[#3b82f6]/20 shadow-sm">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Most Popular")}</p>
                            <p className="text-xs font-bold text-white">{mostPopularByCount._id}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{mostPopularByCount.count} {t("txns")}</p>
                          </div>
                          <div className="bg-[#22c55e]/10 rounded-xl p-2.5 border border-[#22c55e]/20 shadow-sm">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Top Revenue")}</p>
                            <p className="text-xs font-bold text-white">{mostRevenue._id}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatCurrency(mostRevenue.revenue)}</p>
                          </div>
                          <div className="bg-[#f97316]/10 rounded-xl p-2.5 border border-[#f97316]/20 shadow-sm">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Avg Transaction")}</p>
                            <p className="text-xs font-bold text-white">{formatCurrency(avgTransactionValue)}</p>
                          </div>
                          <div className="bg-[#8b5cf6]/10 rounded-xl p-2.5 border border-[#8b5cf6]/20 shadow-sm">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Total Transactions")}</p>
                            <p className="text-xs font-bold text-white">{totalTransactions}</p>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t("Revenue Share")}</p>
                          <div className="space-y-1.5">
                            {revenueShare.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">{item.method}</span>
                                <span className="text-xs font-bold text-white">{item.share}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-yellow-500/10 rounded-xl p-2.5 border border-yellow-500/20 shadow-sm">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t("Least Used")}</p>
                          <p className="text-xs font-bold text-white">{leastUsed._id}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{t("Consider promoting this method")}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <p>{t("No payment data for the selected period")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Stats with Staggered Entrance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 animate-card-entry" style={{ animationDelay: '400ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                <Calendar size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">{t("Period Summary")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Bills")}</span>
                <span className="font-bold text-white text-base">
                  <AnimatedNumber value={summary.period.bills} />
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Orders")}</span>
                <span className="font-bold text-white text-base">
                  <AnimatedNumber value={summary.period.orders} />
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Avg Bill")}</span>
                <span className="font-bold text-white text-base">
                  <AnimatedNumber value={summary.period.averageBill} isCurrency={true} />
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 animate-card-entry" style={{ animationDelay: '450ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#22c55e]/10 rounded-xl flex items-center justify-center text-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.15)]">
                <TrendingUp size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">{t("Discounts & Tax")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Total Discount")}</span>
                <span className="font-bold text-white text-base">
                  <AnimatedNumber value={summary.period.discount} isCurrency={true} />
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Total Tax")}</span>
                <span className="font-bold text-white text-base">
                  <AnimatedNumber value={summary.period.tax} isCurrency={true} />
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Net Revenue")}</span>
                <span className="font-bold text-[#22c55e] text-base">
                  <AnimatedNumber value={summary.period.revenue} isCurrency={true} />
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 animate-card-entry" style={{ animationDelay: '500ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f97316]/10 rounded-xl flex items-center justify-center text-[#f97316] shadow-[0_0_12px_rgba(249,115,22,0.15)]">
                <Receipt size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">{t("Today's Performance")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Bills")}</span>
                <span className="font-bold text-white text-base">
                  <AnimatedNumber value={summary.today.bills} />
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Orders")}</span>
                <span className="font-bold text-white text-base">
                  <AnimatedNumber value={summary.today.orders} />
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("Avg Bill")}</span>
                <span className="font-bold text-white text-base">
                  <AnimatedNumber value={summary.today.averageBill} isCurrency={true} />
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