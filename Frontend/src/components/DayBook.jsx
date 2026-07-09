import React, { useState, useEffect } from 'react';
import { getDayBook, downloadDayBookExcel } from '../api/analytics';
import { Calendar, Download, TrendingUp, TrendingDown, RefreshCw, CreditCard, Wallet, Smartphone, Banknote, Loader2 } from 'lucide-react';
import Toast from './Toast';

const DayBook = () => {
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
      <div className="h-full flex items-center justify-center bg-background">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-xl">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-main">DayBook</h1>
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="date" 
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="bg-surface border border-border text-text-main text-sm rounded-lg px-3 py-1 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={fetchDayBookData}
            className="flex items-center gap-2 bg-surface hover:bg-surface-hover text-text-main px-4 py-2 rounded-xl transition-colors border border-border"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button 
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl transition-colors shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {downloading ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface border border-border rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-text-muted text-sm font-semibold mb-1 uppercase tracking-wider">Total Sales</p>
              <h3 className="text-3xl font-black text-text-main">₹{data.summary.totalSales.toLocaleString()}</h3>
              <p className="text-sm text-text-muted mt-2">{data.summary.salesCount} Bills generated</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-text-muted text-sm font-semibold mb-1 uppercase tracking-wider">Total Expenses</p>
              <h3 className="text-3xl font-black text-text-main">₹{data.summary.totalExpenses.toLocaleString()}</h3>
              <p className="text-sm text-text-muted mt-2">{data.summary.expensesCount} Expenses recorded</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-xl">
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment In */}
        <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-500/30 rounded-xl p-6">
          <h3 className="text-green-400 font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={20} /> Total Payment In (₹{(data.cashFlow.cashIn + data.cashFlow.onlineIn).toLocaleString()})
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-3">
                <Banknote className="text-green-400 w-5 h-5" />
                <span className="font-medium text-white">Cash In</span>
              </div>
              <span className="font-bold text-white">₹{data.cashFlow.cashIn.toLocaleString()}</span>
            </div>
            
            {data.cashFlow.onlineInBreakdown.length > 0 && (
              <div className="bg-black/20 p-3 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <Smartphone className="text-green-400 w-5 h-5" />
                  <span className="font-medium text-white">Online In</span>
                </div>
                <div className="space-y-2 pl-8">
                  {data.cashFlow.onlineInBreakdown.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-green-200/70">{item.app}</span>
                      <span className="font-bold text-green-200">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Out */}
        <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-500/30 rounded-xl p-6">
          <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">
            <TrendingDown size={20} /> Total Payment Out (₹{(data.cashFlow.cashOut + data.cashFlow.onlineOut).toLocaleString()})
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-3">
                <Banknote className="text-red-400 w-5 h-5" />
                <span className="font-medium text-white">Cash Out</span>
              </div>
              <span className="font-bold text-white">₹{data.cashFlow.cashOut.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-3">
                <CreditCard className="text-red-400 w-5 h-5" />
                <span className="font-medium text-white">Online Out</span>
              </div>
              <span className="font-bold text-white">₹{data.cashFlow.onlineOut.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-surface border border-border rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-background/50">
          <h3 className="font-bold text-text-main">Detailed Transactions</h3>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-background sticky top-0 z-10">
              <tr>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Time</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Category</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Particulars</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Name</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border text-right">Total</th>
                <th className="p-4 font-semibold text-red-400 border-b border-border text-right bg-red-500/5">CashOut(-)</th>
                <th className="p-4 font-semibold text-green-400 border-b border-border text-right bg-green-500/5">CashIn(+)</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-text-muted">
                    No transactions recorded for this date.
                  </td>
                </tr>
              ) : (
                data.transactions.map((t, i) => (
                  <tr key={`${t.id}-${i}`} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="p-4 text-text-muted text-sm whitespace-nowrap">
                      {new Date(t.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        t.type === 'Sale' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-text-main">{t.particulars}</td>
                    <td className="p-4 text-text-muted text-sm truncate max-w-[200px]">{t.name}</td>
                    <td className="p-4 font-bold text-text-main text-right">₹{t.total.toLocaleString()}</td>
                    <td className="p-4 font-mono text-red-400 text-right bg-red-500/5">
                      {t.cashOut > 0 ? `- ₹${t.cashOut.toLocaleString()}` : '-'}
                    </td>
                    <td className="p-4 font-mono text-green-400 text-right bg-green-500/5">
                      {t.cashIn > 0 ? `+ ₹${t.cashIn.toLocaleString()}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default DayBook;
