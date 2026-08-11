import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import Invoice from './Invoice';
import { Search, Eye, EyeOff, CreditCard, Filter, Trash2, ChevronLeft, ChevronRight, RefreshCcw, ArrowLeft } from 'lucide-react';
import { getBills, deleteBill, getBillById, apiRefundOrder } from '../api/billing';
import { getCachedBillHistory, cacheBillHistory } from '../db/offlineDb';
import useDebounce from '../hooks/useDebounce';
import ConfirmationModal from './ConfirmationModal';
import Toast from './Toast';
import BackButton from './common/BackButton';

const BillHistory = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, billId: null, password: '', error: '', loading: false, showPassword: false });
  const [refundModal, setRefundModal] = useState({ isOpen: false, billId: null, reason: '' });
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalBills: 0, totalPages: 1, currentPage: 1 });
  const itemsPerPage = 20; // Server-side pagination - Show 20 bills per page (latest first)

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, filterType]);

  // Refresh bills when component mounts to show latest bills first
  useEffect(() => {
    // 1. Instant Cache Load (0ms delay)
    getCachedBillHistory().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setBills(cached);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // Reset to page 1 and fetch latest bills when component mounts
    setCurrentPage(1);
    fetchBills(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBills = async (isBackground = false) => {
    if (!isBackground && bills.length === 0) {
      setLoading(true);
    }
    try {
      const searchForBackend = debouncedSearchTerm.trim().replace(/^#/, '');
      const data = await getBills(currentPage, itemsPerPage, searchForBackend);

      // Handle both old format (array) and new format (object with pagination)
      let billsData = [];
      if (Array.isArray(data)) {
        billsData = data;
      } else {
        billsData = data.bills || [];

        if (data.totalBills === 0 && /^MS\d+$/i.test(searchForBackend)) {
          setToast({ message: 'This bill is missing or deleted', type: 'error' });
        }
      }

      cacheBillHistory(billsData).catch(() => {});

      // Filter out delivery orders - only show dine-in and takeaway
      // Only filter by billType, not orderSource
      const filteredBills = billsData.filter((bill) => {
        return bill.billType !== 'Delivery';
      });

      setBills(filteredBills);

      // Adjust pagination for filtered results
      if (Array.isArray(data)) {
        setPagination({ totalBills: filteredBills.length, totalPages: 1, currentPage: 1 });
      } else {
        // For server-side pagination, we need to estimate the filtered count
        // This is approximate since we don't know the exact count without additional query
        const originalPagination = data.pagination || { totalBills: 0, totalPages: 1, currentPage: 1 };
        // Assume roughly 30% are delivery orders for estimation
        const estimatedFilteredTotal = Math.floor(originalPagination.totalBills * 0.7);
        setPagination({
          ...originalPagination,
          totalBills: estimatedFilteredTotal,
          totalPages: Math.max(1, Math.ceil(estimatedFilteredTotal / itemsPerPage))
        });
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      setToast({ message: 'Failed to load bills', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, billId: id, password: '', error: '', loading: false, showPassword: false });
  };

  const confirmDelete = async () => {
    if (!deleteModal.billId) return;
    if (!deleteModal.password) {
      setDeleteModal((prev) => ({ ...prev, error: 'Please enter password to confirm deletion' }));
      return;
    }

    setDeleteModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      await deleteBill(deleteModal.billId, deleteModal.password);
      setBills(bills.filter((bill) => bill._id !== deleteModal.billId));
      setDeleteModal({ isOpen: false, billId: null, password: '', error: '', loading: false, showPassword: false });
      setToast({ message: 'Bill deleted successfully', type: 'success' });
    } catch (error) {
      console.error('Error deleting bill:', error);
      setDeleteModal((prev) => ({ ...prev, loading: false, error: error.response?.data?.message || 'Incorrect password or failed to delete bill' }));
    }
  };

  const confirmRefund = async () => {
    if (!refundModal.billId) return;
    try {
      await apiRefundOrder(refundModal.billId, refundModal.reason);
      setBills(bills.map((bill) => bill._id === refundModal.billId ? { ...bill, status: 'Refunded', cancelReason: refundModal.reason || 'Customer requested refund' } : bill));
      setRefundModal({ isOpen: false, billId: null, reason: '' });
      setToast({ message: 'Bill refunded successfully', type: 'success' });
    } catch (error) {
      console.error('Error refunding bill:', error);
      setToast({ message: error.response?.data?.message || 'Failed to refund bill', type: 'error' });
    }
  };

  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (endDate && val && val > endDate) setEndDate(val);
  };

  const handleEndDateChange = (val) => {
    if (startDate && val && val < startDate) setEndDate(startDate);
    else setEndDate(val);
  };

  // Client-side filtering for bill type, payment mode and date range
  const filteredBills = bills.filter((bill) => {
    if (filterType !== 'All') {
      if (filterType === 'Dine-In' || filterType === 'Takeaway') {
        if (bill.billType !== filterType) return false;
      } else if (filterType === 'Cash' || filterType === 'UPI' || filterType === 'Card') {
        if (bill.paymentMode !== filterType) return false;
      }
    }

    const dateStr = bill.createdAt || bill.updatedAt;
    if (dateStr) {
      const bDate = new Date(dateStr);
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0,0,0,0);
        if (bDate < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23,59,59,999);
        if (bDate > eDate) return false;
      }
    }

    return true;
  });

  // Reset to first page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterType, startDate, endDate]);

  // Listen for global searches from the Top Nav Bar
  useEffect(() => {
    const handleBillSearch = (e) => {
      if (e.detail) {
        let formattedSearch = e.detail.trim();
        if (/^\d+$/.test(formattedSearch)) {
          formattedSearch = `MS${formattedSearch.padStart(4, '0')}`;
        } else if (/^#?MS\d+$/i.test(formattedSearch)) {
          formattedSearch = formattedSearch.replace(/^#/, '').toUpperCase();
        }

        setSearchTerm(formattedSearch);
      }
    };

    window.addEventListener('executeBillSearch', handleBillSearch);
    return () => window.removeEventListener('executeBillSearch', handleBillSearch);
  }, []);


  return (
    <div className="h-full flex flex-col bg-background p-3 sm:p-4 lg:p-6 overflow-hidden w-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4 shrink-0 bg-surface p-4 sm:p-6 border border-border rounded-2xl shadow-xs">
        <div className="flex items-start gap-3">
          <BackButton onClick={onGoBack} className="mt-0.5 shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-text-main">{t("Bill History")}</h1>
            <p className="text-xs sm:text-sm text-text-muted font-medium">{t("View and manage past transactions")}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          {/* Date Range Picker */}
          <div className="flex items-center gap-1 bg-background px-2.5 py-1.5 rounded-xl border border-border text-xs shrink-0 shadow-2xs">
            <input
              type="date"
              max={endDate || undefined}
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-text-main outline-none cursor-pointer w-[122px] sm:w-[132px] px-0.5 border-none"
              style={{ colorScheme: 'light' }}
              title={t("Start Date")}
            />
            <span className="text-text-muted font-bold text-xs">-</span>
            <input
              type="date"
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-text-main outline-none cursor-pointer w-[122px] sm:w-[132px] px-0.5 border-none"
              style={{ colorScheme: 'light' }}
              title={t("End Date")}
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-[10px] font-bold bg-surface-hover text-text-muted hover:text-text-main px-1.5 py-0.5 rounded-md transition-colors ml-0.5"
                title={t("Reset Dates")}
              >
                ✕
              </button>
            )}
          </div>

          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text" 
              placeholder={t("Search Bill #...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-xs sm:text-sm text-text-main w-full font-medium" />
          </div>

          <div className="relative w-auto">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-auto pl-10 pr-8 py-2 bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-xs sm:text-sm text-text-main appearance-none cursor-pointer font-medium">
              <option value="All">{t("All")}</option>
              <option value="Dine-In">{t("Dine-In")}</option>
              <option value="Takeaway">{t("Takeaway")}</option>
              <option value="Cash">{t("Cash")}</option>
              <option value="UPI">{t("UPI")}</option>
              <option value="Card">{t("Card")}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden flex-1 flex flex-col shadow-xs">
        {/* Desktop Wide Table (Visible on md and larger) */}
        <div className="hidden md:block overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-background sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Bill #")}</th>
                <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">
                  <div className="flex items-center gap-2">
                    {t("Date & Time")}
                    <span className="text-[10px] text-primary font-normal">{t("(Latest First)")}</span>
                  </div>
                </th>
                <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Type")}</th>
                <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Status")}</th>
                <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Payment")}</th>
                <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border text-right">{t("Total")}</th>
                <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border text-center">{t("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    <td className="p-4"><div className="w-8 h-4 bg-text-muted/20 rounded"></div></td>
                    <td className="p-4">
                      <div className="w-16 h-4 bg-text-muted/20 rounded mb-1"></div>
                      <div className="w-12 h-3 bg-text-muted/20 rounded"></div>
                    </td>
                    <td className="p-4"><div className="w-12 h-5 bg-text-muted/20 rounded"></div></td>
                    <td className="p-4"><div className="w-16 h-4 bg-text-muted/20 rounded"></div></td>
                    <td className="p-4"><div className="w-10 h-4 bg-text-muted/20 rounded"></div></td>
                    <td className="p-4"><div className="w-10 h-4 bg-text-muted/20 rounded"></div></td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <div className="w-8 h-8 bg-text-muted/20 rounded"></div>
                        <div className="w-8 h-8 bg-text-muted/20 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-text-muted font-medium">{t("No transactions found")}</td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill._id} className={`border-b border-border hover:bg-surface-hover transition-colors group ${bill.status === 'Cancelled' ? 'opacity-75 bg-danger/5' : ''}`}>
                    <td className="p-4 font-bold text-text-main font-mono text-sm">
                      #{bill.billNumber || 'CANCELLED'}
                      {bill.status === 'Cancelled' && bill.cancelReason && (
                        <div className="text-[10px] text-danger mt-0.5">{t("Reason:")} {bill.cancelReason}</div>
                      )}
                    </td>
                    <td className="p-4 text-text-muted">
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-text-main">{new Date(bill.updatedAt || bill.createdAt).toLocaleDateString()}</span>
                        <span className="font-mono text-text-muted">{new Date(bill.updatedAt || bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        bill.billType === 'Dine-In' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {t(bill.billType)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {t(bill.status || 'Paid')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs text-text-main font-medium">
                        <CreditCard size={15} className="text-text-muted shrink-0" />
                        <span>{bill.paymentMode ? t(bill.paymentMode) : '-'}</span>
                      </div>
                    </td>
                    <td className="p-4 font-black text-text-main text-right text-sm">
                      <span className={bill.status === 'Cancelled' ? 'line-through text-text-muted' : ''}>
                        ₹{(bill.total || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={async () => {
                            setLoadingBill(true);
                            try {
                              const fullBill = await getBillById(bill._id);
                              setSelectedBill(fullBill);
                            } catch (error) {
                              console.error('Error fetching bill details:', error);
                              setToast({ message: 'Failed to load bill details', type: 'error' });
                            } finally {
                              setLoadingBill(false);
                            }
                          }}
                          disabled={loadingBill}
                          className="p-2 hover:bg-background rounded-lg text-primary transition-colors inline-flex items-center gap-1 touch-target disabled:opacity-50" 
                          title={t("View Invoice")}>
                          <Eye size={18} />
                        </button>
                        {bill.status === 'Paid' && (
                          <button
                            onClick={() => setRefundModal({ isOpen: true, billId: bill._id, reason: '' })}
                            className="p-2 hover:bg-background rounded-lg text-amber-500 transition-colors inline-flex items-center gap-1 touch-target" 
                            title={t("Refund Bill")}>
                            <RefreshCcw size={18} />
                          </button>
                        )}
                        {bill.status !== 'Deleted' && (
                          <button
                            onClick={() => handleDeleteClick(bill._id)}
                            className="p-2 hover:bg-background rounded-lg text-danger transition-colors inline-flex items-center gap-1 touch-target" 
                            title={t("Delete Bill (Requires Password)")}>
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Stacked Card List (Visible on screens < 768px) */}
        <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="bg-background rounded-xl p-3.5 border border-border h-24 animate-pulse"></div>
            ))
          ) : filteredBills.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm font-medium">{t("No transactions found")}</div>
          ) : (
            filteredBills.map((bill) => (
              <div key={bill._id} className={`bg-background rounded-xl p-3.5 border border-border space-y-2.5 ${bill.status === 'Cancelled' ? 'opacity-75 bg-danger/5' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-sm text-text-main">#{bill.billNumber || 'CANCELLED'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      bill.billType === 'Dine-In' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {t(bill.billType)}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {t(bill.status || 'Paid')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="font-mono">
                    {new Date(bill.updatedAt || bill.createdAt).toLocaleDateString()} {new Date(bill.updatedAt || bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-1 font-medium text-text-main">
                    <CreditCard size={13} className="text-text-muted" />
                    <span>{bill.paymentMode ? t(bill.paymentMode) : '-'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className={`text-base font-black text-text-main ${bill.status === 'Cancelled' ? 'line-through text-text-muted' : ''}`}>
                    ₹{(bill.total || 0).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setLoadingBill(true);
                        try {
                          const fullBill = await getBillById(bill._id);
                          setSelectedBill(fullBill);
                        } catch (error) {
                          console.error('Error fetching bill details:', error);
                          setToast({ message: 'Failed to load bill details', type: 'error' });
                        } finally {
                          setLoadingBill(false);
                        }
                      }}
                      disabled={loadingBill}
                      className="px-3 py-1.5 bg-surface text-primary border border-border rounded-lg text-xs font-bold flex items-center gap-1 touch-target"
                      title={t("View Invoice")}>
                      <Eye size={15} />
                      <span>{t("Invoice")}</span>
                    </button>
                    {bill.status === 'Paid' && (
                      <button
                        onClick={() => setRefundModal({ isOpen: true, billId: bill._id, reason: '' })}
                        className="p-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs font-bold touch-target"
                        title={t("Refund Bill")}>
                        <RefreshCcw size={15} />
                      </button>
                    )}
                    {bill.status !== 'Deleted' && (
                      <button
                        onClick={() => handleDeleteClick(bill._id)}
                        className="p-2 bg-red-50 text-danger border border-red-200 rounded-lg text-xs font-bold touch-target"
                        title={t("Delete Bill")}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-3 sm:p-4 border-t border-border flex flex-col sm:flex-row gap-2 items-center justify-between bg-background shrink-0 text-xs sm:text-sm">
            <div className="text-text-muted font-medium">
              {t("Showing")} {(currentPage - 1) * itemsPerPage + 1} {t("to")} {Math.min(currentPage * itemsPerPage, pagination.totalBills)} {t("of")} {pagination.totalBills} {t("bills")}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
                className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors touch-target">
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
                        className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface text-text-muted hover:bg-surface-hover hover:text-text-main border border-border'
                        }`}>
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-1 text-text-muted">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage === pagination.totalPages || loading}
                className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors touch-target">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedBill && (
        <Invoice
          bill={selectedBill}
          onClose={() => setSelectedBill(null)} />
      )}

      {refundModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-surface rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text-main mb-2">{t("Refund Order")}</h3>
            <p className="text-text-muted text-xs sm:text-sm mb-4">{t("Please provide a reason for the refund.")}</p>
            <input
              type="text"
              value={refundModal.reason}
              onChange={(e) => setRefundModal({ ...refundModal, reason: e.target.value })} 
              placeholder={t("e.g. Customer unhappy, wrong item")}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 mb-5 text-xs sm:text-sm focus:outline-none focus:border-primary text-text-main font-medium" />
          
            <div className="flex gap-3">
              <button
                onClick={() => setRefundModal({ isOpen: false, billId: null, reason: '' })}
                className="flex-1 py-2.5 rounded-xl font-bold border border-border text-text-main hover:bg-surface-hover transition-colors touch-target text-xs sm:text-sm">
                {t("Cancel")}
              </button>
              <button
                onClick={confirmRefund}
                className="flex-1 py-2.5 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors touch-target text-xs sm:text-sm shadow-xs">
                {t("Confirm Refund")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-border animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <div className="p-3 rounded-2xl shrink-0 bg-danger/10 text-danger">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-text-main mb-1">{t("Security Verification Required")}</h3>
                <p className="text-text-muted text-xs sm:text-sm leading-relaxed">
                  {t("Deleting a bill cannot be undone and will update daily sales reports. Please enter your Admin/User password to authorize this action:")}
                </p>
              </div>
            </div>

            {deleteModal.error && (
              <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs sm:text-sm font-medium">
                {deleteModal.error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">{t("Password")}</label>
              <div className="relative">
                <input
                  type={deleteModal.showPassword ? "text" : "password"}
                  value={deleteModal.password}
                  onChange={(e) => setDeleteModal((prev) => ({ ...prev, password: e.target.value, error: '' }))}
                  onKeyDown={(e) => e.key === 'Enter' && confirmDelete()} 
                  placeholder={t("Enter password...")}
                  autoFocus
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-11 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-danger text-text-main font-medium" />
              
                <button
                  type="button"
                  onClick={() => setDeleteModal((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors p-1"
                  title={deleteModal.showPassword ? "Hide password" : "Show password"}>
                  {deleteModal.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, billId: null, password: '', error: '', loading: false, showPassword: false })}
                disabled={deleteModal.loading}
                className="flex-1 py-2.5 rounded-xl font-bold border border-border text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors disabled:opacity-50 touch-target text-xs sm:text-sm">
                {t("Cancel")}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteModal.loading}
                className="flex-1 py-2.5 rounded-xl font-bold bg-danger text-white hover:bg-red-600 shadow-md shadow-danger/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 touch-target text-xs sm:text-sm">
                {deleteModal.loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <Trash2 size={16} />
                )}
                <span>{t("Confirm Delete")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast &&
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)} />

      }
    </div>);

};

export default BillHistory;