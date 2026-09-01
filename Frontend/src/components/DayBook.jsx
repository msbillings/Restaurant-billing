import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import { getDayBook, downloadDayBookExcel } from '../api/analytics';
import { Calendar, Download, TrendingUp, TrendingDown, RefreshCw, CreditCard, Wallet, Smartphone, Banknote, Loader2 } from 'lucide-react';
import Toast from './Toast';
import BackButton from './common/BackButton';
import { sendWhatsAppMessage, sendWhatsAppBill, getWhatsAppStatus } from '../api/whatsapp';
import api from '../api/axios';

const DayBook = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState({
    summary: { totalSales: 0, salesCount: 0, totalExpenses: 0, expensesCount: 0 },
    cashFlow: { cashIn: 0, cashOut: 0, onlineIn: 0, onlineOut: 0, onlineInBreakdown: [] },
    transactions: []
  });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchDayBookData();
  }, [date]);

  const fetchDayBookData = async () => {
    setLoading(true);
    try {
      const response = await getDayBook(date);
      setData(response);
    } catch (error) {
      console.error('Error fetching daybook:', error);
      setToast({ message: 'Failed to load DayBook data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await downloadDayBookExcel(date, user.username || 'RESTAURANT');
    } catch (error) {
      console.error('Error downloading excel:', error);
      setToast({ message: 'Failed to download Excel report', type: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async (customPhone = null) => {
    try {
      let s = {};
      try {
        const configRes = await api.get('/config/info');
        s = configRes.data?.restaurantSettings || configRes.data || {};
      } catch (e) {
        s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      }
      const restName = (s.restaurantName || 'MS Billings Restaurant').trim();
      
      let rawPhone = customPhone || s.whatsappNumber;
      if (!rawPhone) {
        try {
          const waStatus = await getWhatsAppStatus();
          if (waStatus?.status === 'CONNECTED' && waStatus?.connectedNumber) {
            rawPhone = waStatus.connectedNumber;
          }
        } catch (e) {}
      }
      if (!rawPhone) {
        rawPhone = s.phone || '';
      }

      let cleanPhone = String(rawPhone).replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone; // Default country code for 10-digit Indian numbers
      }

      if (!cleanPhone || cleanPhone.length < 10) {
        setToast({ message: t("Please enter a valid WhatsApp number in POS Settings"), type: 'warning' });
        return;
      }

      let formattedDate = date;
      try {
        const [y, m, d] = date.split('-');
        if (y && m && d) formattedDate = `${d}/${m}/${y}`;
      } catch (e) {}

      const totalSales = Number(data.summary.totalSales || 0).toLocaleString('en-IN');
      const salesCount = data.summary.salesCount || 0;
      const totalExpenses = Number(data.summary.totalExpenses || 0).toLocaleString('en-IN');
      const expensesCount = data.summary.expensesCount || 0;
      const netCashFlow = Number((data.summary.totalSales || 0) - (data.summary.totalExpenses || 0)).toLocaleString('en-IN');

      const cashIn = Number(data.cashFlow.cashIn || 0).toLocaleString('en-IN');
      const onlineIn = Number(data.cashFlow.onlineIn || 0).toLocaleString('en-IN');
      const cashOut = Number(data.cashFlow.cashOut || 0).toLocaleString('en-IN');
      const onlineOut = Number(data.cashFlow.onlineOut || 0).toLocaleString('en-IN');

      let onlineBreakdownText = '';
      if (data.cashFlow.onlineInBreakdown && data.cashFlow.onlineInBreakdown.length > 0) {
        onlineBreakdownText = data.cashFlow.onlineInBreakdown
          .map(b => `  • ${b.app}: ₹${Number(b.amount || 0).toLocaleString('en-IN')}`)
          .join('\n');
      }

      const READ_MORE = String.fromCharCode(8206).repeat(4001);

      const msg = `📊 *DAILY SALES REPORT* 📊\n` +
        `🏨 *${restName.toUpperCase()}* (${formattedDate})\n` +
        READ_MORE + `\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *SALES SUMMARY*\n` +
        `• *Total Sales:* ₹${totalSales} (${salesCount} Bills)\n` +
        `• *Total Expenses:* ₹${totalExpenses} (${expensesCount} Expenses)\n` +
        `• *Net Cash Flow:* ₹${netCashFlow}\n\n` +
        `📥 *PAYMENT IN*\n` +
        `• *Cash In:* ₹${cashIn}\n` +
        `• *Online In:* ₹${onlineIn}\n` +
        (onlineBreakdownText ? `${onlineBreakdownText}\n` : '') +
        `\n📤 *PAYMENT OUT*\n` +
        `• *Cash Out:* ₹${cashOut}\n` +
        `• *Online Out:* ₹${onlineOut}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `_Generated automatically via MS Billings POS_`;

      // Try fetching Excel report as base64 document attachment
      let excelBase64 = null;
      try {
        const url = `/analytics/daybook/export?date=${date}&restaurantName=${encodeURIComponent(restName)}`;
        const response = await api.get(url, { responseType: 'arraybuffer' });
        const bytes = new Uint8Array(response.data);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        excelBase64 = window.btoa(binary);
      } catch (excelErr) {
        console.warn('Could not generate Excel attachment for WhatsApp, sending text only:', excelErr);
      }

      try {
        let res;
        if (excelBase64) {
          res = await sendWhatsAppBill(cleanPhone, msg, null, null, `DayBook-${date}.xlsx`, excelBase64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        } else {
          res = await sendWhatsAppMessage(cleanPhone, msg);
        }

        if (res && res.success) {
          setToast({ message: `${t("Daily sales report sent automatically to")} +${cleanPhone} ${t("via WhatsApp! ✓")}`, type: 'success' });
          return;
        }
      } catch (botErr) {
        console.error('WhatsApp bot background send error:', botErr);
        const errorMsg = botErr.response?.data?.error || botErr.message || t('Failed to send WhatsApp report');
        setToast({ message: `WhatsApp: ${errorMsg}`, type: 'error' });
      }
    } catch (err) {
      console.error('Error sharing report to WhatsApp:', err);
      setToast({ message: t("Failed to generate WhatsApp report"), type: 'error' });
    }
  };

  if (loading && !data.transactions.length) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-[#f97316] animate-spin" />
          <p className="text-gray-400">{t("Loading DayBook...")}</p>
        </div>
      </div>);
  }

  return (
    <div className="min-h-full h-full bg-[#09090b] text-gray-100 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto">
      <style>{`
        .glass-card {
          background: rgba(20, 20, 24, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }
        /* Custom date picker styling to fix overlap */
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.6;
          transition: 0.2s;
          padding-left: 10px;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
      `}</style>
      {/* Header */}
      <div className="glass-card p-3 sm:p-4 mb-3 sm:mb-5 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#f97316]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-10">
          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="bg-gradient-to-br from-[#f97316]/20 to-[#ea580c]/10 p-2 sm:p-2.5 rounded-xl border border-[#f97316]/20 shadow-inner flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#f97316]" />
            </div>
            <div className="flex items-center justify-between flex-1 sm:flex-initial gap-2">
              <h1 className="text-base sm:text-2xl font-black text-white tracking-tight">{t("DayBook")}</h1>
              <div className="flex items-center gap-1.5 bg-black/40 rounded-lg px-2.5 py-1 border border-white/10 shadow-sm focus-within:border-[#f97316]/50 transition-colors">
                <input
                  type="date"
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent font-semibold text-gray-200 focus:outline-none cursor-pointer [color-scheme:dark] text-xs sm:text-sm w-[110px] sm:w-[125px]" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleShareWhatsApp()}
              title={t("Share Daily Report on WhatsApp")}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] hover:text-[#4ade80] rounded-xl border border-[#25D366]/40 transition-all shadow-[0_0_15px_rgba(37,211,102,0.15)] font-bold text-xs sm:text-sm cursor-pointer active:scale-95">
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              <span>{t("WhatsApp")}</span>
            </button>
            <button
              onClick={fetchDayBookData}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-[#1e1e24] hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white shadow-sm font-bold text-xs sm:text-sm cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t("Refresh")}</span>
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] rounded-xl transition-all text-white shadow-[0_0_15px_rgba(34,197,94,0.3)] font-bold disabled:opacity-70 disabled:cursor-not-allowed border border-[#22c55e]/50 text-xs sm:text-sm cursor-pointer">
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{downloading ? t('Exporting...') : t('Export Excel')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mb-3 sm:mb-5">
        <div className="glass-card p-3 sm:p-5 relative overflow-hidden group hover:border-[#22c55e]/30 transition-all duration-300">
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-[#22c55e]/10 rounded-full blur-2xl group-hover:bg-[#22c55e]/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10 gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5 truncate">{t("Total Sales")}</p>
              <h3 className="text-base sm:text-3xl font-black text-white tracking-tight drop-shadow-sm truncate">₹{data.summary.totalSales.toLocaleString()}</h3>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]"></span>
                <span>{data.summary.salesCount} {t("Bills")}</span>
              </p>
            </div>
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-[#22c55e]/20 to-[#22c55e]/5 rounded-xl border border-[#22c55e]/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-[#22c55e]" />
            </div>
          </div>
        </div>

        <div className="glass-card p-3 sm:p-5 relative overflow-hidden group hover:border-red-500/30 transition-all duration-300">
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10 gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5 truncate">{t("Total Expenses")}</p>
              <h3 className="text-base sm:text-3xl font-black text-white tracking-tight drop-shadow-sm truncate">₹{data.summary.totalExpenses.toLocaleString()}</h3>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                <span>{data.summary.expensesCount} {t("Expenses")}</span>
              </p>
            </div>
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-xl border border-red-500/20 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 sm:w-6 sm:h-6 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5 mb-3 sm:mb-5">
        {/* Payment In */}
        <div className="glass-card p-3.5 sm:p-5 border-l-4 border-l-[#22c55e]">
          <h3 className="text-[#22c55e] font-bold text-xs sm:text-sm mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            <span>{t("Total Payment In (₹")}{(data.cashFlow.cashIn + data.cashFlow.onlineIn).toLocaleString()})</span>
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <Banknote className="text-[#22c55e] w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-semibold text-white text-xs sm:text-sm">{t("Cash In")}</span>
              </div>
              <span className="font-bold text-white text-xs sm:text-sm font-mono">₹{data.cashFlow.cashIn.toLocaleString()}</span>
            </div>

            {data.cashFlow.onlineInBreakdown.length > 0 && (
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <Smartphone className="text-[#22c55e] w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="font-semibold text-white text-xs sm:text-sm">{t("Online In")}</span>
                </div>
                <div className="space-y-2 pl-6 sm:pl-8">
                  {data.cashFlow.onlineInBreakdown.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs border-b border-white/5 last:border-0 pb-1.5 last:pb-0">
                      <span className="text-gray-300">{item.app}</span>
                      <span className="font-bold text-white font-mono">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Out */}
        <div className="glass-card p-3.5 sm:p-5 border-l-4 border-l-red-500">
          <h3 className="text-red-400 font-bold text-xs sm:text-sm mb-3 flex items-center gap-2">
            <TrendingDown size={16} />
            <span>{t("Total Payment Out (₹")}{(data.cashFlow.cashOut + data.cashFlow.onlineOut).toLocaleString()})</span>
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <Banknote className="text-red-400 w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-semibold text-white text-xs sm:text-sm">{t("Cash Out")}</span>
              </div>
              <span className="font-bold text-white text-xs sm:text-sm font-mono">₹{data.cashFlow.cashOut.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <CreditCard className="text-red-400 w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-semibold text-white text-xs sm:text-sm">{t("Online Out")}</span>
              </div>
              <span className="font-bold text-white text-xs sm:text-sm font-mono">₹{data.cashFlow.onlineOut.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="glass-card mb-4 shadow-lg overflow-hidden">
        <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#1e1e24]">
          <h3 className="font-bold text-white text-sm sm:text-base">{t("Detailed Transactions")}</h3>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto p-2">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1e1e24] shadow-sm">
              <tr>
                <th className="p-3 text-[11px] font-black text-gray-400 uppercase tracking-widest rounded-tl-lg">{t("Time")}</th>
                <th className="p-3 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t("Category")}</th>
                <th className="p-3 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t("Particulars")}</th>
                <th className="p-3 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t("Name")}</th>
                <th className="p-3 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">{t("Total")}</th>
                <th className="p-3 text-[11px] font-black text-red-400/80 uppercase tracking-widest text-right">{t("CashOut(-)")}</th>
                <th className="p-3 text-[11px] font-black text-[#22c55e]/80 uppercase tracking-widest text-right rounded-tr-lg">{t("CashIn(+)")}</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-10 text-center">
                    <p className="text-gray-500 font-medium text-xs sm:text-sm">{t("No transactions recorded for this date.")}</p>
                  </td>
                </tr>
              ) : (
                data.transactions.map((tx, i) => (
                  <tr key={`${tx.id}-${i}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 text-gray-400 text-xs sm:text-sm whitespace-nowrap">{new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${tx.type === 'Sale' ? 'bg-[#22c55e]/10 text-[#4ade80] border border-[#22c55e]/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{tx.type}</span>
                    </td>
                    <td className="p-3 font-semibold text-gray-200 text-xs sm:text-sm">{tx.particulars}</td>
                    <td className="p-3 text-gray-400 text-xs sm:text-sm truncate max-w-[200px]">{tx.name}</td>
                    <td className="p-3 font-bold text-white text-right text-xs sm:text-sm font-mono">₹{tx.total.toLocaleString()}</td>
                    <td className="p-3 font-mono font-medium text-red-400 text-right text-xs sm:text-sm">{tx.cashOut > 0 ? `- ₹${tx.cashOut.toLocaleString()}` : '-'}</td>
                    <td className="p-3 font-mono font-medium text-[#22c55e] text-right text-xs sm:text-sm">{tx.cashIn > 0 ? `+ ₹${tx.cashIn.toLocaleString()}` : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Transaction Cards */}
        <div className="md:hidden p-2.5 space-y-2">
          {data.transactions.length === 0 ? (
            <p className="text-gray-500 font-medium text-center py-6 text-xs">{t("No transactions recorded for this date.")}</p>
          ) : (
            data.transactions.map((tx, i) => (
              <div key={`${tx.id}-${i}`} className="bg-white/5 rounded-xl border border-white/10 p-3 shadow-xs">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${tx.type === 'Sale' ? 'bg-[#22c55e]/10 text-[#4ade80] border border-[#22c55e]/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{tx.type}</span>
                      <span className="text-gray-400 text-[11px] font-mono">{new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="font-semibold text-gray-200 text-xs sm:text-sm truncate">{tx.particulars}</p>
                    {tx.name && <p className="text-gray-400 text-[11px] truncate">{tx.name}</p>}
                  </div>
                  <span className="font-bold text-white text-xs sm:text-sm shrink-0 font-mono">₹{tx.total.toLocaleString()}</span>
                </div>
                {(tx.cashIn > 0 || tx.cashOut > 0) && (
                  <div className="flex gap-3 pt-1.5 border-t border-white/10 font-mono text-[11px]">
                    {tx.cashIn > 0 && <span className="font-bold text-[#22c55e]">+₹{tx.cashIn.toLocaleString()}</span>}
                    {tx.cashOut > 0 && <span className="font-bold text-red-400">-₹{tx.cashOut.toLocaleString()}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>);

};

export default DayBook;