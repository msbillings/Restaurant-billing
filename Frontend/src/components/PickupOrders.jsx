import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { getBills, getBillById, deleteBill } from '../api/billing';
import Invoice from './Invoice';
import ConfirmationModal from './ConfirmationModal';
import {
  ShoppingBag,
  RefreshCw,
  Filter,
  Search,
  ChevronDown,
  Eye,
  CreditCard,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X
} from 'lucide-react';
import Toast from './Toast';
import BackButton from './common/BackButton';

const PickupOrders = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState('all'); // all, Cash, Card, UPI, Due / Credit, Other
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [toast, setToast] = useState(null);
  const [showPaymentFilter, setShowPaymentFilter] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, billId: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalBills: 0, totalPages: 1, currentPage: 1 });
  const itemsPerPage = 20;

  const fetchPickupOrders = async () => {
    setLoading(true);
    try {
      const data = await getBills({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        billType: 'Takeaway',
        paymentMode: paymentFilter !== 'all' ? paymentFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });

      const pickupBills = Array.isArray(data.bills) ? data.bills : [];
      setOrders(pickupBills);
      setPagination(data.pagination || {
        totalBills: pickupBills.length,
        totalPages: Math.max(1, Math.ceil(pickupBills.length / itemsPerPage)),
        currentPage: currentPage
      });
    } catch (error) {
      console.error('Error fetching pickup orders:', error);
      setToast({ message: 'Failed to load pickup orders', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPickupOrders();
  }, [currentPage, searchTerm, paymentFilter, startDate, endDate]);

  const handleStartDateChange = (val) => {
    setStartDate(val);
    setCurrentPage(1);
    if (endDate && val && val > endDate) {
      setEndDate(val);
    }
  };

  const handleEndDateChange = (val) => {
    if (startDate && val && val < startDate) {
      setToast({ message: 'End date cannot be earlier than start date', type: 'error' });
      return;
    }
    setEndDate(val);
    setCurrentPage(1);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, billId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.billId) return;

    try {
      await deleteBill(deleteModal.billId);
      setOrders(orders.filter((order) => order._id !== deleteModal.billId));
      setDeleteModal({ isOpen: false, billId: null });
      setToast({ message: 'Pickup order deleted successfully', type: 'success' });
      fetchPickupOrders();
    } catch (error) {
      console.error('Error deleting pickup order:', error);
      setToast({ message: error.response?.data?.message || 'Failed to delete order', type: 'error' });
    }
  };

  const getPaymentColor = (mode) => {
    switch (mode) {
      case 'Cash': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300';
      case 'Card': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300';
      case 'UPI': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300';
      case 'Due / Credit': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (paymentFilter === 'all') {
      return true;
    }
    return order.paymentMode === paymentFilter;
  });

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto custom-scrollbar w-full">
      {/* Header Container */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 sm:gap-3 mb-2 sm:mb-2.5 p-2 sm:p-2.5 bg-surface rounded-2xl border border-border shadow-xs shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-text-main tracking-tight flex items-center gap-2">
              <ShoppingBag className="text-primary" size={22} />
              <span>{t("Pickup Orders")}</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-text-muted font-medium">{t("View and manage pickup orders")}</p>
          </div>
        </div>
        
        {/* Same-row Controls: Search + Start/End Dates + Payment Filter + Refresh */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto lg:flex-1 lg:justify-end">
          {/* Dynamic Search Box */}
          <div className="relative flex-1 min-w-[170px] max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
            <input
              type="text"
              placeholder={t("Search Bill #, Pickup #, Customer...")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm font-medium text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>

          {/* Start and End Date Pickers */}
          <div className="flex items-center gap-1.5 bg-background p-1 rounded-xl border border-border shrink-0">
            <div className="flex items-center gap-1 px-1">
              <Calendar size={13} className="text-text-muted shrink-0" />
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("From")}</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-surface border border-border rounded-lg px-2 py-1 text-xs font-bold text-text-main focus:outline-none focus:border-primary cursor-pointer w-[115px] sm:w-[130px] shrink-0"
                title={t("Start Date")}
              />
            </div>

            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("To")}</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-surface border border-border rounded-lg px-2 py-1 text-xs font-bold text-text-main focus:outline-none focus:border-primary cursor-pointer w-[115px] sm:w-[130px] shrink-0"
                title={t("End Date")}
              />
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={clearDateFilter}
                className="p-1 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
                title={t("Clear Date Filter")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Payment Method Filter Dropdown (Replaced wrong platform filter) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowPaymentFilter(!showPaymentFilter)}
              className="flex items-center gap-2 pl-3 pr-7 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm font-bold text-text-main cursor-pointer hover:bg-surface-hover transition-colors">
              <Filter size={15} className="text-primary" />
              <span>{t(paymentFilter === 'all' ? 'All Payments' : paymentFilter)}</span>
              <ChevronDown size={14} className={`absolute right-2.5 transition-transform ${showPaymentFilter ? 'rotate-180' : ''}`} />
            </button>
            
            {showPaymentFilter && (
              <div className="absolute top-full right-0 mt-1.5 bg-surface border border-border rounded-2xl shadow-xl p-1.5 z-20 min-w-[140px]">
                {['all', 'Cash', 'Card', 'UPI', 'Due / Credit', 'Other'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setPaymentFilter(mode);
                      setCurrentPage(1);
                      setShowPaymentFilter(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      paymentFilter === mode
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-text-main hover:bg-surface-hover'
                    }`}>
                    {t(mode === 'all' ? 'All Payments' : mode)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchPickupOrders}
            className="p-2 bg-background border border-border rounded-xl hover:bg-surface-hover transition-all text-text-main shrink-0 cursor-pointer"
            title={t("Refresh")}>
            <RefreshCw size={16} className={`text-primary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden flex-1 flex flex-col shadow-xs">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-background/80 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                <th className="p-3.5 font-bold text-text-muted border-b border-border text-xs uppercase tracking-wider">{t("Pickup #")}</th>
                <th className="p-3.5 font-bold text-text-muted border-b border-border text-xs uppercase tracking-wider">{t("Bill #")}</th>
                <th className="p-3.5 font-bold text-text-muted border-b border-border text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>{t("Date & Time")}</span>
                    <span className="text-[10px] text-primary font-bold">{t("(Latest First)")}</span>
                  </div>
                </th>
                <th className="p-3.5 font-bold text-text-muted border-b border-border text-xs uppercase tracking-wider">{t("Payment Method")}</th>
                <th className="p-3.5 font-bold text-text-muted border-b border-border text-xs uppercase tracking-wider text-right">{t("Total")}</th>
                <th className="p-3.5 font-bold text-text-muted border-b border-border text-xs uppercase tracking-wider text-center">{t("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    <td className="p-3.5"><div className="w-16 h-5 bg-background rounded-lg"></div></td>
                    <td className="p-3.5"><div className="w-14 h-4 bg-background rounded"></div></td>
                    <td className="p-3.5">
                      <div className="w-20 h-4 bg-background rounded mb-1"></div>
                      <div className="w-12 h-3 bg-background rounded"></div>
                    </td>
                    <td className="p-3.5"><div className="w-18 h-5 bg-background rounded-full"></div></td>
                    <td className="p-3.5"><div className="w-14 h-4 bg-background rounded ml-auto"></div></td>
                    <td className="p-3.5"><div className="w-16 h-8 bg-background rounded-xl mx-auto"></div></td>
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-3">
                      <ShoppingBag size={44} className="text-text-muted/40" />
                      <div>
                        <h3 className="text-base font-bold text-text-main mb-1">{t("No Pickup Orders")}</h3>
                        <p className="text-xs text-text-muted">{t("No orders match your current filters")}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order._id} className="border-b border-border hover:bg-surface-hover/70 transition-colors">
                    {/* Pickup # Badge */}
                    <td className="p-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                        {order.tableNo && order.tableNo.startsWith('TAK-') ? order.tableNo : (order.tableNo || 'TAK')}
                      </span>
                    </td>
                    {/* Bill # */}
                    <td className="p-3.5 font-bold text-text-main font-mono text-sm">#{order.billNumber}</td>
                    {/* Date & Time */}
                    <td className="p-3.5 text-text-muted">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-text-main">{new Date(order.updatedAt || order.createdAt).toLocaleDateString()}</span>
                        <span className="text-[10px] text-text-muted font-mono">{new Date(order.updatedAt || order.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    {/* Payment Method Badge */}
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPaymentColor(order.paymentMode || 'Cash')}`}>
                        <CreditCard size={12} />
                        <span>{t(order.paymentMode || 'Cash')}</span>
                      </span>
                    </td>
                    {/* Total */}
                    <td className="p-3.5 font-black text-text-main text-right text-sm">₹{order.total?.toFixed(2) || '0.00'}</td>
                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={async () => {
                            setLoadingBill(true);
                            try {
                              const fullBill = await getBillById(order._id);
                              setSelectedBill(fullBill);
                            } catch (error) {
                              console.error('Error fetching bill details:', error);
                              setToast({ message: 'Failed to load bill details', type: 'error' });
                            } finally {
                              setLoadingBill(false);
                            }
                          }}
                          disabled={loadingBill}
                          className="p-2 hover:bg-surface-hover rounded-xl text-primary transition-colors cursor-pointer"
                          title={t("View Invoice")}>
                          <Eye size={17} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(order._id)}
                          className="p-2 hover:bg-red-500/10 rounded-xl text-red-500 transition-colors cursor-pointer"
                          title={t("Delete Order")}>
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Stacked Card View */}
        <div className="md:hidden overflow-y-auto flex-1 p-2.5 space-y-2.5 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 p-4">
              <ShoppingBag size={40} className="mx-auto text-text-muted/40 mb-2" />
              <h3 className="text-base font-bold text-text-main mb-1">{t("No Pickup Orders")}</h3>
              <p className="text-xs text-text-muted">{t("No orders match your current filters")}</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order._id} className="bg-surface border border-border rounded-xl p-3 shadow-xs space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                        {order.tableNo && order.tableNo.startsWith('TAK-') ? order.tableNo : (order.tableNo || 'TAK')}
                      </span>
                      <span className="font-mono font-bold text-text-main text-sm">#{order.billNumber}</span>
                    </div>
                    <p className="text-[10px] text-text-muted font-medium mt-1">
                      {new Date(order.updatedAt || order.createdAt).toLocaleDateString()} • {new Date(order.updatedAt || order.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPaymentColor(order.paymentMode || 'Cash')}`}>
                    <CreditCard size={11} />
                    <span>{t(order.paymentMode || 'Cash')}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                  <span className="text-text-muted font-medium">{t("Order Total")}</span>
                  <span className="font-black text-text-main text-sm">₹{order.total?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <button
                    onClick={async () => {
                      setLoadingBill(true);
                      try {
                        const fullBill = await getBillById(order._id);
                        setSelectedBill(fullBill);
                      } catch (error) {
                        console.error('Error fetching bill details:', error);
                        setToast({ message: 'Failed to load bill details', type: 'error' });
                      } finally {
                        setLoadingBill(false);
                      }
                    }}
                    disabled={loadingBill}
                    className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                    <Eye size={15} />
                    <span>{t("Invoice")}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(order._id)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors cursor-pointer"
                    title={t("Delete Order")}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-3 sm:p-4 border-t border-border flex items-center justify-between bg-surface shrink-0">
            <div className="text-xs sm:text-sm text-text-muted">
              {t("Showing")} {(currentPage - 1) * itemsPerPage + 1} {t("to")} {Math.min(currentPage * itemsPerPage, pagination.totalBills)} {t("of")} {pagination.totalBills} {t("orders")}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
                className="p-1.5 sm:p-2 rounded-lg border border-border bg-background text-text-main disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors cursor-pointer">
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(pagination.totalPages)].map((_, i) => {
                  const page = i + 1;
                  if (
                    page === 1 ||
                    page === pagination.totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        disabled={loading}
                        className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          currentPage === page
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-background text-text-muted hover:bg-surface-hover hover:text-text-main border border-border'
                        }`}>
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-1 text-xs text-text-muted">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage === pagination.totalPages || loading}
                className="p-1.5 sm:p-2 rounded-lg border border-border bg-background text-text-main disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors cursor-pointer">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedBill && (
        <Invoice
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
        />
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, billId: null })}
        onConfirm={confirmDelete}
        title={t("Delete Pickup Order")}
        message={t("Are you sure you want to delete this pickup order? This action cannot be undone.")}
        confirmText={t("Delete")}
        isDanger={true}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default PickupOrders;