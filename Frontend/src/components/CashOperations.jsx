import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, ArrowLeft, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import BackButton from './common/BackButton';

const CashOperations = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    type: 'withdrawal',
    amount: '',
    reason: '',
    performedBy: 'Admin'
  });

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/cash-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching cash logs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      await axios.post(`${getApiUrl()}/cash-logs`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsModalOpen(false);
      setFormData({ type: 'withdrawal', amount: '', reason: '', performedBy: 'Admin' });
      fetchLogs();
    } catch (error) {
      console.error('Error logging cash', error);
      alert('Error saving log');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this log?')) {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        await axios.delete(`${getApiUrl()}/cash-logs/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchLogs();
      } catch (error) {
        console.error('Error deleting log', error);
        alert('Error deleting log');
      }
    }
  };

  const getNetBalance = () => {
    let balance = 0;
    logs.forEach((log) => {
      if (log.type === 'topup') balance += log.amount;else
      if (log.type === 'withdrawal') balance -= log.amount;
    });
    return balance;
  };

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-2.5 gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <div>
            <h1 className="text-base sm:text-2xl font-black text-text-main tracking-tight">{t("Cash Operations")}</h1>
            <p className="text-[11px] sm:text-xs text-text-muted">{t("Track petty cash withdrawals and top-ups")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:flex-initial bg-surface px-3 py-2 rounded-xl border border-border shadow-xs flex items-center justify-between sm:justify-start gap-1.5">
            <span className="text-xs text-text-muted font-bold">{t("Net:")}</span>
            <span className={`text-xs sm:text-base font-black font-mono ${getNetBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{getNetBalance().toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-xl transition-all font-bold shadow-xs text-xs sm:text-sm cursor-pointer shrink-0 whitespace-nowrap">
            <Plus size={15} />
            <span>{t("Log Movement")}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-surface rounded-2xl shadow-xs border border-border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-surface-hover border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("Date")}</th>
                  <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("Type")}</th>
                  <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("Amount")}</th>
                  <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("Reason")}</th>
                  <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("By")}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-text-muted text-xs sm:text-sm">{t("No cash movements logged yet.")}</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-6 py-4 text-text-muted font-medium text-xs sm:text-sm">{new Date(log.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td className="px-6 py-4">
                        {log.type === 'withdrawal' ? (
                          <span className="inline-flex items-center gap-1.5 text-red-600 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-md text-xs font-bold uppercase"><ArrowDownLeft size={13} />{t("Withdrawal")}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-green-600 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-md text-xs font-bold uppercase"><ArrowUpRight size={13} />{t("Top-Up")}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-black text-text-main text-xs sm:text-sm font-mono">₹{log.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-text-muted text-xs sm:text-sm">{log.reason}</td>
                      <td className="px-6 py-4 text-text-muted text-xs sm:text-sm">{log.performedBy}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(log._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-2.5">
            {logs.length === 0 ? (
              <div className="py-10 p-4 text-center text-text-muted bg-surface rounded-xl border border-border text-xs sm:text-sm">
                <p>{t("No cash movements logged yet.")}</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="bg-surface rounded-xl border border-border p-3 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        {log.type === 'withdrawal' ? (
                          <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><ArrowDownLeft size={11} />{t("Withdrawal")}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase"><ArrowUpRight size={11} />{t("Top-Up")}</span>
                        )}
                      </div>
                      <p className="font-bold text-text-main text-xs sm:text-sm truncate">{log.reason}</p>
                      <p className="text-[11px] text-text-muted mt-0.5">{new Date(log.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} · {log.performedBy}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs sm:text-sm font-black font-mono ${log.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}`}>₹{log.amount.toFixed(2)}</span>
                      <button onClick={() => handleDelete(log._id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md border-t sm:border border-border max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-border flex justify-between items-center shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-text-main">{t("Log Cash Movement")}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-main p-1 text-lg leading-none cursor-pointer">&times;</button>
            </div>
            {/* Scrollable Form Fields */}
            <form id="cash-form" onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setFormData({ ...formData, type: 'withdrawal' })}
                  className={`py-2.5 px-3 flex items-center justify-center gap-1.5 rounded-xl font-bold border-2 transition-all text-xs sm:text-sm cursor-pointer ${
                  formData.type === 'withdrawal' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'border-border bg-surface text-text-muted hover:bg-surface-hover'}`}>
                  <ArrowDownLeft size={16} />{t("Withdrawal")}
                </button>
                <button type="button" onClick={() => setFormData({ ...formData, type: 'topup' })}
                  className={`py-2.5 px-3 flex items-center justify-center gap-1.5 rounded-xl font-bold border-2 transition-all text-xs sm:text-sm cursor-pointer ${
                  formData.type === 'topup' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-border bg-surface text-text-muted hover:bg-surface-hover'}`}>
                  <ArrowUpRight size={16} />{t("Top-Up")}
                </button>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-text-main mb-1">{t("Amount (₹)")}</label>
                <input type="number" required min="1" step="1" value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-base sm:text-lg font-bold bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  placeholder="500" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-text-main mb-1">{t("Reason / Note")}</label>
                <input type="text" required value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-xs sm:text-sm"
                  placeholder={formData.type === 'withdrawal' ? t('e.g. Paid for milk') : t('e.g. Adding change to drawer')} />
              </div>
            </form>
            {/* Sticky Footer Buttons */}
            <div className="shrink-0 flex gap-2.5 px-4 sm:px-5 py-3 border-t border-border bg-surface">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 text-text-muted bg-surface-hover hover:bg-border rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer">{t("Cancel")}</button>
              <button type="submit" form="cash-form" className="flex-1 py-2.5 text-white bg-primary hover:bg-primary-hover rounded-xl font-bold shadow-md shadow-primary/20 transition-all text-xs sm:text-sm cursor-pointer">
                {formData.type === 'withdrawal' ? t('Save Withdrawal') : t('Save Top-Up')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);

};

export default CashOperations;