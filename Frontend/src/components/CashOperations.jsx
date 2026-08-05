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
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center gap-4 mb-2">
        <BackButton onClick={onGoBack} />
      </div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t("Cash Operations")}</h1>
            <p className="text-sm text-gray-500">{t("Track petty cash withdrawals and top-ups")}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
            <span className="text-sm text-gray-500 font-medium mr-2">{t("Net Cash Flow:")}</span>
            <span className={`text-lg font-bold ${getNetBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{getNetBalance().toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm">
            
            <Plus size={20} />{t("Log Cash Movement")}
          </button>
        </div>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Date")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Type")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Amount")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("Reason")}</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">{t("By")}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ?
            <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">{t("No cash movements logged yet.")}</td>
                </tr> :

            logs.map((log) =>
            <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {new Date(log.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-6 py-4">
                      {log.type === 'withdrawal' ?
                <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider w-fit">
                          <ArrowDownLeft size={14} />{t("Withdrawal")}
                </span> :

                <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider w-fit">
                          <ArrowUpRight size={14} />{t("Top-Up")}
                </span>
                }
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      ₹{log.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{log.reason}</td>
                    <td className="px-6 py-4 text-gray-600">{log.performedBy}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                  onClick={() => handleDelete(log._id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
            )
            }
            </tbody>
          </table>
        </div>
      }

      {/* Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">{t("Log Cash Movement")}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'withdrawal' })}
                className={`py-3 px-4 flex items-center justify-center gap-2 rounded-xl font-bold border-2 transition-all ${
                formData.type === 'withdrawal' ?
                'border-red-500 bg-red-50 text-red-700' :
                'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`
                }>
                
                  <ArrowDownLeft size={18} />{t("Withdrawal")}
              </button>
                <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'topup' })}
                className={`py-3 px-4 flex items-center justify-center gap-2 rounded-xl font-bold border-2 transition-all ${
                formData.type === 'topup' ?
                'border-green-500 bg-green-50 text-green-700' :
                'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`
                }>
                
                  <ArrowUpRight size={18} />{t("Top-Up")}
              </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Amount (₹)")}</label>
                <input
                type="number" required min="1" step="1"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 text-lg font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder="500" />
              
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Reason / Note")}</label>
                <input
                type="text" required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder={formData.type === 'withdrawal' ? t('e.g. Paid for milk') : t('e.g. Adding change to drawer')} />
              
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">{t("Cancel")}</button>
                <button type="submit" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-medium shadow-lg shadow-primary/30 transition-all">
                  {formData.type === 'withdrawal' ? t('Save Withdrawal') : t('Save Top-Up')}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default CashOperations;