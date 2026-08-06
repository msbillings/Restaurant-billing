import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import { getDayBook, downloadDayBookExcel } from '../api/analytics';
import { Calendar, Download, TrendingUp, TrendingDown, RefreshCw, CreditCard, Wallet, Smartphone, Banknote, Loader2 } from 'lucide-react';
import Toast from './Toast';
import BackButton from './common/BackButton';

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
    <div className="min-h-full h-full bg-[#09090b] text-gray-100 px-2.5 py-4 md:p-6 overflow-y-auto">
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
      <div className="glass-card p-3 sm:p-4 mb-4 sm:mb-6 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#f97316]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 relative z-10">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="bg-gradient-to-br from-[#f97316]/20 to-[#ea580c]/10 p-2 sm:p-3.5 rounded-xl border border-[#f97316]/20 shadow-inner flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-[#f97316]" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">{t("DayBook")}</h1>
              <div className="flex items-center gap-1.5 mt-1 bg-black/40 rounded-lg px-2.5 py-1 border border-white/10 shadow-sm focus-within:border-[#f97316]/50 transition-colors">
                <input
                  type="date"
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent font-medium text-gray-200 focus:outline-none cursor-pointer [color-scheme:dark] text-xs sm:text-sm w-[110px] sm:w-[130px]" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={fetchDayBookData}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2.5 bg-[#1e1e24] hover:bg-white/10 rounded-lg border border-white/10 transition-all text-white shadow-sm font-medium text-xs sm:text-sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t("Refresh")}</span>
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2.5 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] rounded-lg transition-all text-white shadow-[0_0_15px_rgba(34,197,94,0.3)] font-medium disabled:opacity-70 disabled:cursor-not-allowed border border-[#22c55e]/50 text-xs sm:text-sm">
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{downloading ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
        <div className="glass-card p-4 sm:p-6 relative overflow-hidden group hover:border-[#22c55e]/30 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[#22c55e]/10">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#22c55e]/10 rounded-full blur-2xl group-hover:bg-[#22c55e]/20 transition-all duration-500"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t("Total Sales")}</p>
              <h3 className="text-xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm">₹{data.summary.totalSales.toLocaleString()}</h3>
              <p className="text-[10px] sm:text-sm text-gray-500 mt-2 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]"></span>
                {data.summary.salesCount} {t("Bills")}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-[#22c55e]/20 to-[#22c55e]/5 rounded-2xl border border-[#22c55e]/20 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7 text-[#22c55e]" />
            </div>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6 relative overflow-hidden group hover:border-red-500/30 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-red-500/10">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all duration-500"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t("Total Expenses")}</p>
              <h3 className="text-xl sm:text-4xl font-black text-white tracking-tight drop-shadow-sm">₹{data.summary.totalExpenses.toLocaleString()}</h3>
              <p className="text-[10px] sm:text-sm text-gray-500 mt-2 font-medium flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {data.summary.expensesCount} {t("Expenses")}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-2xl border border-red-500/20 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 shrink-0">
              <TrendingDown className="w-5 h-5 sm:w-7 sm:h-7 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment In */}
        <div className="glass-card p-6 border-l-4 border-l-[#22c55e]">
          <h3 className="text-[#22c55e] font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={20} />{t("Total Payment In (₹")}{(data.cashFlow.cashIn + data.cashFlow.onlineIn).toLocaleString()})
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/5">
              <div className="flex items-center gap-3">
                <Banknote className="text-[#22c55e] w-5 h-5" />
                <span className="font-medium text-white">{t("Cash In")}</span>
              </div>
              <span className="font-bold text-white">₹{data.cashFlow.cashIn.toLocaleString()}</span>
            </div>

            {data.cashFlow.onlineInBreakdown.length > 0 &&
              <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                <div className="flex items-center gap-3 mb-3">
                  <Smartphone className="text-[#22c55e] w-5 h-5" />
                  <span className="font-medium text-white">{t("Online In")}</span>
                </div>
                <div className="space-y-3 pl-8">
                  {data.cashFlow.onlineInBreakdown.map((item, i) =>
                    <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0">
                      <span className="text-gray-300">{item.app}</span>
                      <span className="font-bold text-white">₹{item.amount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            }
          </div>
        </div>

        {/* Payment Out */}
        <div className="glass-card p-6 border-l-4 border-l-red-500">
          <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">
            <TrendingDown size={20} />{t("Total Payment Out (₹")}{(data.cashFlow.cashOut + data.cashFlow.onlineOut).toLocaleString()})
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/5">
              <div className="flex items-center gap-3">
                <Banknote className="text-red-400 w-5 h-5" />
                <span className="font-medium text-white">{t("Cash Out")}</span>
              </div>
              <span className="font-bold text-white">₹{data.cashFlow.cashOut.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/5">
              <div className="flex items-center gap-3">
                <CreditCard className="text-red-400 w-5 h-5" />
                <span className="font-medium text-white">{t("Online Out")}</span>
              </div>
              <span className="font-bold text-white">₹{data.cashFlow.onlineOut.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="glass-card mb-4 shadow-lg">
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 bg-[#1e1e24] rounded-t-2xl">
          <h3 className="font-bold text-white text-lg">{t("Detailed Transactions")}</h3>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto p-2">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1e1e24] shadow-sm">
              <tr>
                <th className="p-4 text-[11px] font-black text-gray-400 uppercase tracking-widest rounded-tl-lg">{t("Time")}</th>
                <th className="p-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t("Category")}</th>
                <th className="p-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t("Particulars")}</th>
                <th className="p-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{t("Name")}</th>
                <th className="p-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">{t("Total")}</th>
                <th className="p-4 text-[11px] font-black text-red-400/80 uppercase tracking-widest text-right">{t("CashOut(-)")}</th>
                <th className="p-4 text-[11px] font-black text-[#22c55e]/80 uppercase tracking-widest text-right rounded-tr-lg">{t("CashIn(+)")}</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 ?
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <p className="text-gray-500 font-medium">{t("No transactions recorded for this date.")}</p>
                  </td>
                </tr> :
                data.transactions.map((t, i) =>
                  <tr key={`${t.id}-${i}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 text-gray-400 text-sm whitespace-nowrap">{new Date(t.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm ${t.type === 'Sale' ? 'bg-[#22c55e]/10 text-[#4ade80] border border-[#22c55e]/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{t.type}</span>
                    </td>
                    <td className="p-4 font-semibold text-gray-200">{t.particulars}</td>
                    <td className="p-4 text-gray-400 text-sm truncate max-w-[200px]">{t.name}</td>
                    <td className="p-4 font-bold text-white text-right">₹{t.total.toLocaleString()}</td>
                    <td className="p-4 font-mono font-medium text-red-400 text-right">{t.cashOut > 0 ? `- ₹${t.cashOut.toLocaleString()}` : '-'}</td>
                    <td className="p-4 font-mono font-medium text-[#22c55e] text-right">{t.cashIn > 0 ? `+ ₹${t.cashIn.toLocaleString()}` : '-'}</td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>

        {/* Mobile Transaction Cards */}
        <div className="md:hidden p-3 space-y-2">
          {data.transactions.length === 0 ? (
            <p className="text-gray-500 font-medium text-center py-8">{t("No transactions recorded for this date.")}</p>
          ) : data.transactions.map((tx, i) => (
            <div key={`${tx.id}-${i}`} className="bg-white/5 rounded-xl border border-white/10 p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${tx.type === 'Sale' ? 'bg-[#22c55e]/10 text-[#4ade80] border border-[#22c55e]/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{tx.type}</span>
                    <span className="text-gray-400 text-xs">{new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="font-semibold text-gray-200 text-sm truncate">{tx.particulars}</p>
                  {tx.name && <p className="text-gray-500 text-xs truncate">{tx.name}</p>}
                </div>
                <span className="font-bold text-white ml-2 shrink-0">₹{tx.total.toLocaleString()}</span>
              </div>
              {(tx.cashIn > 0 || tx.cashOut > 0) && (
                <div className="flex gap-3 pt-2 border-t border-white/10">
                  {tx.cashIn > 0 && <span className="text-xs font-bold text-[#22c55e]">+₹{tx.cashIn.toLocaleString()}</span>}
                  {tx.cashOut > 0 && <span className="text-xs font-bold text-red-400">-₹{tx.cashOut.toLocaleString()}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>);

};

export default DayBook;