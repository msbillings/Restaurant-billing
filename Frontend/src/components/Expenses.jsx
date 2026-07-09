import React, { useState, useEffect } from 'react';
import { getExpenses, addExpense, deleteExpense } from '../api/expenses';
import { Wallet, Plus, Trash2, Calendar, IndianRupee, Tag, Clock, CreditCard } from 'lucide-react';
import Toast from './Toast';

const CATEGORIES = ['Ingredients', 'Utility Bills', 'Staff Salary', 'Maintenance', 'Miscellaneous'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

const Expenses = () => {
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
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border bg-gradient-to-r from-red-500/10 to-orange-500/10 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-text-main flex items-center gap-3">
            <Wallet className="text-red-500" />
            Petty Cash & Expenses
          </h2>
          <p className="text-text-muted mt-1 text-sm">Track your daily restaurant expenses and outflows.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/25"
        >
          <Plus size={20} /> Record Expense
        </button>
      </div>

      <div className="px-6 py-4 border-b border-border bg-background flex items-center justify-between">
        <div className="flex bg-surface-hover p-1 rounded-xl">
          {['today', 'week', 'month', 'all'].map(filter => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`px-4 py-2 rounded-lg font-bold text-sm capitalize transition-colors ${
                dateFilter === filter 
                  ? 'bg-background shadow-sm text-text-main' 
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {filter === 'today' ? 'Today' : filter === 'week' ? 'Last 7 Days' : filter === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>

        <div className="bg-red-50 border border-red-100 px-6 py-3 rounded-xl flex items-center gap-4">
          <div className="p-2 bg-red-100 rounded-lg text-red-600">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-red-600/80 uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-black text-red-700">₹{totalAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-20 bg-surface rounded-2xl border-2 border-dashed border-border">
            <Wallet className="mx-auto h-16 w-16 text-text-muted/30 mb-4" />
            <h3 className="text-xl font-bold text-text-main mb-2">No expenses recorded</h3>
            <p className="text-text-muted">You haven't added any expenses for this time period.</p>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-surface-hover border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider">Payment Mode</th>
                  <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider text-right">Amount</th>
                  <th className="px-6 py-4 text-sm font-bold text-text-muted uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {validExpenses.map(expense => (
                  <tr key={expense._id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-text-main font-medium">
                        <Calendar size={16} className="text-text-muted" />
                        {new Date(expense.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-text-main font-bold">{expense.description}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-hover text-text-main border border-border">
                        <Tag size={12} />
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-text-muted">{expense.paymentMode}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-lg font-black text-red-600">₹{expense.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => handleDeleteExpense(expense._id)}
                        className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-border/50">
            <div className="p-6 border-b border-border bg-gradient-to-r from-red-500/10 to-transparent">
              <h3 className="text-xl font-bold text-text-main">Record New Expense</h3>
              <p className="text-sm text-text-muted mt-1">Add a new outgoing cash flow record.</p>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-text-main mb-2">Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-bold text-lg"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-text-main mb-2">Description</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-medium"
                  placeholder="e.g. Bought Tomatoes, Electric Bill"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-text-main mb-2">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-text-main mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-medium appearance-none"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-main mb-2">Paid Via</label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({...formData, paymentMode: e.target.value})}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-medium appearance-none"
                  >
                    {PAYMENT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-border">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-text-muted hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30 transition-all"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Expenses;
