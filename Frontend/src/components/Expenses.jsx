import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import { getExpenses, addExpense, deleteExpense } from '../api/expenses';
import { Wallet, Plus, Trash2, Calendar, IndianRupee, Tag, Clock, CreditCard } from 'lucide-react';
import Toast from './Toast';
import BackButton from './common/BackButton';

const CATEGORIES = ['Ingredients', 'Utility Bills', 'Staff Salary', 'Maintenance', 'Miscellaneous'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

const Expenses = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: 'Miscellaneous',
    paymentMode: 'Cash',
    date: new Date().toISOString().split('T')[0]
  });

  const [dateFilter, setDateFilter] = useState('today');

  const fetchExpensesData = React.useCallback(async () => {
    try {
      setLoading(true);
      let startDate = new Date();
      let endDate = new Date();

      if (dateFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateFilter === 'week') {
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
      } else if (dateFilter === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = null; // all time
        endDate = null;
      }

      const data = await getExpenses(startDate?.toISOString(), endDate?.toISOString());
      if (Array.isArray(data)) {
        setExpenses(data);
      } else {
        console.error('Expected array from backend, got:', data);
        setExpenses([]);
      }
    } catch (err) {
      console.error('Failed to fetch expenses', err);
      setToast({ message: 'Failed to load expenses', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchExpensesData();
  }, [fetchExpensesData]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) {
      setToast({ message: 'Amount and Description are required', type: 'error' });
      return;
    }

    try {
      await addExpense({
        ...formData,
        amount: Number(formData.amount)
      });
      setToast({ message: 'Expense added successfully', type: 'success' });
      setIsModalOpen(false);
      setFormData({ amount: '', description: '', category: 'Miscellaneous', paymentMode: 'Cash', date: new Date().toISOString().split('T')[0] });
      fetchExpensesData();
    } catch (err) {
      setToast({ message: 'Failed to add expense', type: 'error' });
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteExpense(id);
        setToast({ message: 'Expense deleted successfully', type: 'success' });
        fetchExpensesData();
      } catch (err) {
        setToast({ message: 'Failed to delete expense', type: 'error' });
      }
    }
  };

  const validExpenses = Array.isArray(expenses) ? expenses : [];
  const totalAmount = validExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden w-full">
      <div className="p-3 sm:p-5 border-b border-border bg-gradient-to-r from-red-500/10 to-orange-500/10 shrink-0">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-2xl font-black text-text-main flex items-center gap-2 truncate">
                <Wallet className="text-red-500 shrink-0" size={18} />
                <span className="truncate">{t("Petty Cash & Expenses")}</span>
              </h2>
              <p className="text-text-muted text-[11px] sm:text-xs hidden sm:block">{t("Track your daily restaurant expenses and outflows.")}</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all shadow-md shadow-red-500/20 shrink-0 text-xs sm:text-sm cursor-pointer whitespace-nowrap">
            <Plus size={16} />
            <span>{t("Add Expense")}</span>
          </button>
        </div>
      </div>

      <div className="px-2 sm:px-3.5 py-1.5 sm:py-2 border-b border-border bg-background flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="flex bg-surface-hover p-1 rounded-xl overflow-x-auto shrink-0 justify-between sm:justify-start">
          {['today', 'week', 'month', 'all'].map((filter) =>
          <button
            key={filter}
            onClick={() => setDateFilter(filter)}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm capitalize transition-colors whitespace-nowrap text-center cursor-pointer ${
            dateFilter === filter ?
            'bg-background shadow-xs text-text-main' :
            'text-text-muted hover:text-text-main'}`
            }>
              {filter === 'today' ? t('Today') : filter === 'week' ? t('7 Days') : filter === 'month' ? t('Month') : t('All')}
            </button>
          )}
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-3.5 py-2 rounded-xl flex items-center justify-between sm:justify-start gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400">
              <IndianRupee size={15} />
            </div>
            <p className="text-[11px] sm:text-xs font-bold text-red-600/80 uppercase tracking-wider">{t("Total Expenses")}</p>
          </div>
          <p className="text-base sm:text-xl font-black text-red-700 dark:text-red-400 font-mono">₹{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 sm:p-2.5 md:p-3 bg-background">
        {loading ?
        <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          </div> :
        expenses.length === 0 ?
        <div className="text-center py-12 sm:py-16 p-4 bg-surface rounded-2xl border border-dashed border-border max-w-md mx-auto my-3">
            <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Wallet size={28} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-text-main mb-1">{t("No expenses recorded")}</h3>
            <p className="text-xs sm:text-sm text-text-muted">{t("You haven't added any expenses for this time period.")}</p>
          </div> :

        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-hover border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("Date")}</th>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("Description")}</th>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("Category")}</th>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">{t("Payment Mode")}</th>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider text-right">{t("Amount")}</th>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider text-right">{t("Action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {validExpenses.map((expense) =>
                <tr key={expense._id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-text-main font-medium text-xs sm:text-sm">
                          <Calendar size={14} className="text-text-muted" />
                          {new Date(expense.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-text-main font-bold text-xs sm:text-sm">{expense.description}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-hover text-text-main border border-border">
                          <Tag size={11} />
                          {t(expense.category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs sm:text-sm font-bold text-text-muted">{t(expense.paymentMode)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-base sm:text-lg font-black text-red-600 font-mono">₹{expense.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDeleteExpense(expense._id)}
                          className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-2.5">
            {validExpenses.map((expense) => (
              <div key={expense._id} className="bg-surface rounded-xl border border-border p-3 shadow-xs">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text-main text-xs sm:text-sm truncate">{expense.description}</p>
                    <div className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                      <Calendar size={11} />
                      <span>{new Date(expense.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-red-600 font-mono">₹{expense.amount.toLocaleString()}</span>
                    <button onClick={() => handleDeleteExpense(expense._id)} className="p-1 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1.5 pt-1.5 border-t border-border">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-hover text-text-main border border-border">
                    <Tag size={10} />
                    <span>{t(expense.category)}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-text-muted">{t(expense.paymentMode)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
        }
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl border-t sm:border border-border/50 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-red-500/10 to-transparent rounded-t-3xl sm:rounded-t-2xl shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-text-main">{t("Record New Expense")}</h3>
                <p className="text-[11px] sm:text-xs text-text-muted mt-0.5">{t("Add a new outgoing cash flow record.")}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-main p-1 rounded-lg text-lg leading-none cursor-pointer">&times;</button>
            </div>
            
            {/* Scrollable Form Fields */}
            <form id="expense-form" onSubmit={handleAddExpense} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-text-main mb-1">{t("Amount (₹)")}</label>
                <input
                type="number"
                required
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 transition-all font-bold text-base sm:text-lg"
                placeholder="0.00" />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-text-main mb-1">{t("Description")}</label>
                <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 transition-all font-medium text-xs sm:text-sm" placeholder={t("e.g. Bought Tomatoes, Electric Bill")} />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-text-main mb-1">{t("Date")}</label>
                <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 transition-all font-medium text-xs sm:text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-text-main mb-1">{t("Category")}</label>
                  <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 transition-all font-medium text-xs sm:text-sm">
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{t(cat)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-text-main mb-1">{t("Paid Via")}</label>
                  <select
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 transition-all font-medium text-xs sm:text-sm">
                    {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{t(mode)}</option>)}
                  </select>
                </div>
              </div>
            </form>

            {/* Sticky Footer Buttons */}
            <div className="shrink-0 flex items-center justify-end gap-2.5 px-4 sm:px-5 py-3 border-t border-border bg-surface">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-text-muted hover:bg-surface-hover transition-colors cursor-pointer">{t("Cancel")}
              </button>
              <button
                type="submit"
                form="expense-form"
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-red-500 text-white hover:bg-red-600 hover:shadow-md hover:shadow-red-500/20 transition-all cursor-pointer">{t("Save Expense")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Expenses;