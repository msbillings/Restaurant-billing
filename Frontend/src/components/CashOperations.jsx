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
      const response = await axios.get(`${getApiUrl()}/cash-logs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
      await axios.post(`${getApiUrl()}/cash-logs`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
        await axios.delete(`${getApiUrl()}/cash-logs/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
    <div className="h-full flex flex-col bg-background p-4 sm:p-6 overflow-y-auto">
      <div className="flex items-center gap-4 mb-2">
        <BackButton onClick={onGoBack} />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main">{t("Cash Operations")}</h1>
          <p className="text-sm text-text-muted">{t("Track petty cash withdrawals and top-ups")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-surface px-4 py-2 rounded-xl border border-border shadow-sm">
            <span className="text-xs text-text-muted font-medium mr-1">{t("Net:")}</span>
            <span className={`text-base sm:text-lg font-black ${getNetBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{getNetBalance().toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-primary hover:bg-primary-hover text-white px-3 sm:px-4 py-2.5 rounded-xl transition-colors font-bold shadow-sm text-sm sm:text-base">
            <Plus size={18} /><span className="hidden sm:inline">{t("Log Cash Movement")}</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :
      <>
        {/* Desktop Table */}
        <div className="hidden md:block bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface-hover border-b border-border">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">{t("Date")}</th>
                <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">{t("Type")}</th>
                <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">{t("Amount")}</th>
                <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">{t("Reason")}</th>
                <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">{t("By")}</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-text-muted uppercase tracking-wider">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ?
              <tr><td colSpan="6" className="px-6 py-8 text-center text-text-muted">{t("No cash movements logged yet.")}</td></tr> :
              logs.map((log) =>
              <tr key={log._id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-4 text-text-muted font-medium text-sm">{new Date(log.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-6 py-4">
                    {log.type === 'withdrawal' ?
                    <span className="flex items-center gap-1.5 text-red-600 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-md text-xs font-bold uppercase w-fit"><ArrowDownLeft size={14} />{t("Withdrawal")}</span> :
                    <span className="flex items-center gap-1.5 text-green-600 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-md text-xs font-bold uppercase w-fit"><ArrowUpRight size={14} />{t("Top-Up")}</span>}
                  </td>
                  <td className="px-6 py-4 font-black text-text-main">₹{log.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-text-muted">{log.reason}</td>
                  <td className="px-6 py-4 text-text-muted">{log.performedBy}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(log._id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={18} /></button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden space-y-3">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-text-muted bg-surface rounded-2xl border border-border">{t("No cash movements logged yet.")}</div>
          ) : logs.map((log) => (
            <div key={log._id} className="bg-surface rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {log.type === 'withdrawal' ?
                  <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md text-xs font-bold uppercase mb-1"><ArrowDownLeft size={12} />{t("Withdrawal")}</span> :
                  <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-md text-xs font-bold uppercase mb-1"><ArrowUpRight size={12} />{t("Top-Up")}</span>}
                  <p className="font-medium text-text-main truncate">{log.reason}</p>
                  <p className="text-xs text-text-muted mt-0.5">{new Date(log.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {log.performedBy}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className={`text-lg font-black ${log.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}`}>₹{log.amount.toFixed(2)}</span>
                  <button onClick={() => handleDelete(log._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
      }

      {/* Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md border-t sm:border border-border max-h-[80vh] flex flex-col">
            {/* Sticky Header */}
            <div className="px-5 py-4 border-b border-border flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-text-main">{t("Log Cash Movement")}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-main p-2 text-2xl leading-none">&times;</button>
            </div>
            {/* Scrollable Form Fields */}
            <form id="cash-form" onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setFormData({ ...formData, type: 'withdrawal' })}
                  className={`py-3 px-4 flex items-center justify-center gap-2 rounded-xl font-bold border-2 transition-all ${
                  formData.type === 'withdrawal' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'border-border bg-surface text-text-muted hover:bg-surface-hover'}`}>
                  <ArrowDownLeft size={18} />{t("Withdrawal")}
                </button>
                <button type="button" onClick={() => setFormData({ ...formData, type: 'topup' })}
                  className={`py-3 px-4 flex items-center justify-center gap-2 rounded-xl font-bold border-2 transition-all ${
                  formData.type === 'topup' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-border bg-surface text-text-muted hover:bg-surface-hover'}`}>
                  <ArrowUpRight size={18} />{t("Top-Up")}
                </button>
              </div>
              <div>
                <label className="block text-sm font-bold text-text-main mb-1">{t("Amount (₹)")}</label>
                <input type="number" required min="1" step="1" value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 text-lg font-bold bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  placeholder="500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-main mb-1">{t("Reason / Note")}</label>
                <input type="text" required value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  placeholder={formData.type === 'withdrawal' ? t('e.g. Paid for milk') : t('e.g. Adding change to drawer')} />
              </div>
            </form>
            {/* Sticky Footer Buttons — always visible above bottom nav */}
            <div className="shrink-0 flex gap-3 px-5 py-4 border-t border-border bg-surface">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-text-muted bg-surface-hover hover:bg-border rounded-xl font-bold transition-colors">{t("Cancel")}</button>
              <button type="submit" form="cash-form" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-bold shadow-lg shadow-primary/30 transition-all">
                {formData.type === 'withdrawal' ? t('Save Withdrawal') : t('Save Top-Up')}
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default CashOperations;