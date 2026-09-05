import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import Invoice from './Invoice';
import { Search, Eye, EyeOff, CreditCard, Filter, Trash2, ChevronLeft, ChevronRight, RefreshCcw, ArrowLeft, Loader2, ChevronDown, Receipt, Info } from 'lucide-react';
import { getBills, deleteBill, getBillById, apiRefundOrder } from '../api/billing';
import { getCachedBillHistory, cacheBillHistory } from '../db/offlineDb';
import useDebounce from '../hooks/useDebounce';
import ConfirmationModal from './ConfirmationModal';
import Toast from './Toast';
import BackButton from './common/BackButton';
import realtimeService from '../services/realtimeService';

const BillHistory = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBillId, setLoadingBillId] = useState(null);
  const [billCache, setBillCache] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, billId: null, password: '', error: '', loading: false, showPassword: false });
  const [refundModal, setRefundModal] = useState({ isOpen: false, billId: null, reason: '' });
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalBills: 0, totalPages: 1, currentPage: 1 });
  const [expandedRows, setExpandedRows] = useState({});
  const [loadingRowItems, setLoadingRowItems] = useState({});
  const [mixedModalBill, setMixedModalBill] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 20; // Server-side pagination - Show 20 bills per page (latest first)

  const handleViewBill = async (billId) => {
    if (billCache[billId]) {
      setSelectedBill(billCache[billId]);
      return;
    }
    setLoadingBillId(billId);
    try {
      const fullBill = await getBillById(billId);
      setBillCache(prev => ({ ...prev, [billId]: fullBill }));
      setSelectedBill(fullBill);
    } catch (error) {
      console.error('Error fetching bill details:', error);
      setToast({ message: 'Failed to load bill details', type: 'error' });
    } finally {
      setLoadingBillId(null);
    }
  };

  const toggleRow = async (id) => {
    const isExpanding = !expandedRows[id];
    setExpandedRows(prev => ({ ...prev, [id]: isExpanding }));

    if (isExpanding) {
      const targetBill = bills.find(b => b._id === id);
      const hasItems = targetBill && Array.isArray(targetBill.items) && targetBill.items.length > 0;

      if (!hasItems) {
        if (billCache[id] && Array.isArray(billCache[id].items) && billCache[id].items.length > 0) {
          setBills(prev => prev.map(b => b._id === id ? { ...b, items: billCache[id].items } : b));
        } else {
          setLoadingRowItems(prev => ({ ...prev, [id]: true }));
          try {
            const fullBill = await getBillById(id);
            if (fullBill && fullBill.items) {
              setBillCache(prev => ({ ...prev, [id]: fullBill }));
              setBills(prev => prev.map(b => b._id === id ? { ...b, ...fullBill } : b));
            }
          } catch (err) {
            console.error('Error fetching items for bill:', err);
          } finally {
            setLoadingRowItems(prev => ({ ...prev, [id]: false }));
          }
        }
      }
    }
  };

  const renderPaymentCell = (bill) => {
    const mode = bill.paymentMode || bill.paymentMethod || '-';
    if (mode === 'Mixed' || mode === 'Split') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMixedModalBill(bill);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-all font-bold text-xs cursor-pointer shadow-2xs group shrink-0"
          title={t("Click to view Mixed payment breakdown")}
        >
          <CreditCard size={13} className="text-orange-600 shrink-0" />
          <span>{t("Mixed")}</span>
          <Info size={12} className="text-orange-500 group-hover:scale-110 transition-transform ml-0.5 shrink-0" />
        </button>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-text-main font-medium">
        <CreditCard size={14} className="text-text-muted shrink-0" />
        <span>{t(mode)}</span>
      </div>
    );
  };

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchBills();
  }, [currentPage, debouncedSearchTerm, typeFilter, paymentFilter]);

  // Refresh bills when component mounts to show latest bills first
  useEffect(() => {
    // 1. Instant Cache Load (0ms delay)
    getCachedBillHistory().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setBills(cached);
        setLoading(false);
      }
    }).catch(() => { });

    // Reset to page 1 when component mounts (effect on [currentPage] will handle fetching)
    setCurrentPage(1);

    // Listen for real-time settlement and refund events
    const handleBillSettled = (data) => {
      if (data && (data.bill || data.order)) {
        const newBill = data.bill || data.order;
        if (newBill.billType !== 'Delivery') {
          setBills(prev => {
            const exists = prev.some(b => b._id === newBill._id || b.billNumber === newBill.billNumber);
            if (exists) return prev;
            return [newBill, ...prev];
          });
        }
      }
      fetchBills(true);
    };

    const unsubSettled = realtimeService.subscribe('billSettled', handleBillSettled);
    const unsubOrderUpdated = realtimeService.subscribe('orderUpdated', () => fetchBills(true));

    return () => {
      unsubSettled();
      unsubOrderUpdated();
    };
  }, []);

  const fetchBills = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    try {
      const searchForBackend = debouncedSearchTerm.trim().replace(/^#/, '');
      const data = await getBills({
        page: currentPage,
        limit: itemsPerPage,
        search: searchForBackend,
        excludeBillType: 'Delivery',
        billType: typeFilter !== 'All' ? typeFilter : undefined,
        paymentMode: paymentFilter !== 'All' ? paymentFilter : undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined
      });

      let billsData = [];
      if (Array.isArray(data)) {
        billsData = data;
        setPagination({ totalBills: billsData.length, totalPages: 1, currentPage: 1 });
      } else {
        billsData = data.bills || [];
        setPagination(data.pagination || {
          totalBills: billsData.length,
          totalPages: Math.max(1, Math.ceil(billsData.length / itemsPerPage)),
          currentPage: currentPage
        });

        if (data.pagination?.totalBills === 0 && /^MS\d+$/i.test(searchForBackend)) {
          setToast({ message: 'This bill is missing or deleted', type: 'error' });
        }
      }

      setBills(billsData);
      cacheBillHistory(billsData).catch(() => { });
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
      setBills((prev) => prev.map((bill) =>
        bill._id === deleteModal.billId
          ? { ...bill, status: 'Deleted', cancelReason: 'Manually deleted from History' }
          : bill
      ));
      setDeleteModal({ isOpen: false, billId: null, password: '', error: '', loading: false, showPassword: false });
      setToast({ message: 'Bill deleted successfully', type: 'success' });
      fetchBills(true);
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
    if (typeFilter !== 'All') {
      if (bill.billType !== typeFilter) return false;
    }
    if (paymentFilter !== 'All') {
      if (bill.paymentMode !== paymentFilter) return false;
    }

    const dateStr = bill.createdAt || bill.updatedAt;
    if (dateStr) {
      const bDate = new Date(dateStr);
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (bDate < sDate) return false;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (bDate > eDate) return false;
      }
    }

    return true;
  });

  // Reset to first page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, typeFilter, paymentFilter, startDate, endDate]);

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

  const activeFilterCount = [
    startDate ? 1 : 0,
    endDate ? 1 : 0,
    typeFilter !== 'All' ? 1 : 0,
    paymentFilter !== 'All' ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-hidden w-full">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between mb-2 sm:mb-2.5 gap-2 shrink-0 bg-surface p-2 sm:p-2.5 border border-border rounded-2xl shadow-xs">
        {/* Header + Filters Container */}
        <div className="flex flex-col sm:flex-row flex-wrap xl:flex-nowrap items-stretch sm:items-center justify-between gap-2 w-full xl:w-auto shrink-0">
          {/* Row 1 on Mobile: Back + Title + Filter Toggle */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <BackButton onClick={onGoBack} className="shrink-0" />
              <div>
                <h1 className="text-sm sm:text-lg font-black text-text-main leading-tight whitespace-nowrap">{t("Bill History")}</h1>
                <p className="text-[10px] sm:text-xs text-text-muted font-medium leading-tight hidden xs:block">{t("View and manage past transactions")}</p>
              </div>
            </div>

            {/* Filter On/Off Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0 ml-1 ${showFilters || activeFilterCount > 0
                ? 'bg-primary/10 border-primary text-primary shadow-xs'
                : 'bg-background border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              title={t("Toggle Filters")}
            >
              <Filter size={13} />
              <span className="text-xs font-semibold">{showFilters ? t("Hide Filters") : t("Filters")}</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] font-extrabold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Collapsible Date Range Picker + Remaining Filters */}
          {(showFilters || activeFilterCount > 0) && (
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-1.5 shrink-0 animate-in fade-in duration-200 w-full sm:w-auto">
              {/* Row 1 of Filters on Mobile / Inline on Desktop: Date Range Picker (ONE ROW) */}
              <div className="flex items-center justify-between sm:justify-start gap-1 bg-background px-2 py-0.5 sm:py-1 rounded-xl border border-border text-xs shadow-2xs shrink-0 w-full sm:w-auto">
                <input
                  type="date"
                  max={endDate || undefined}
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-transparent text-[10px] sm:text-xs font-semibold text-text-main outline-none cursor-pointer flex-1 sm:w-[85px] md:w-[100px] px-0 border-none min-w-0 [&::-webkit-calendar-picker-indicator]:scale-[0.7] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:p-0"
                  style={{ colorScheme: 'light' }}
                  title={t("Start Date")}
                />
                <span className="text-text-muted font-bold text-[10px] sm:text-xs px-0.5">-</span>
                <input
                  type="date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="bg-transparent text-[10px] sm:text-xs font-semibold text-text-main outline-none cursor-pointer flex-1 sm:w-[85px] md:w-[100px] px-0 border-none min-w-0 [&::-webkit-calendar-picker-indicator]:scale-[0.7] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:p-0"
                  style={{ colorScheme: 'light' }}
                  title={t("End Date")}
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-[9px] font-bold bg-surface-hover text-text-muted hover:text-text-main px-1 py-0.5 rounded transition-colors ml-0.5 shrink-0"
                    title={t("Reset Dates")}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Row 2 of Filters on Mobile / Inline on Desktop: Remaining Filters (ONE ROW ONLY) */}
              <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                {/* Order Type Filter (Dine-In / Takeaway) */}
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full pl-2.5 pr-5 py-0.5 sm:py-1 bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-[10px] sm:text-xs text-text-main appearance-none cursor-pointer font-semibold shadow-2xs truncate"
                  >
                    <option value="All">{t("All Types")}</option>
                    <option value="Dine-In">{t("Dine-In")}</option>
                    <option value="Takeaway">{t("Takeaway")}</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={12} />
                </div>

                {/* Payment Method Filter (Cash / UPI / Card / Mixed) */}
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <CreditCard className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none hidden xs:block" size={12} />
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="w-full pl-2.5 xs:pl-6 pr-5 py-0.5 sm:py-1 bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-[10px] sm:text-xs text-text-main appearance-none cursor-pointer font-semibold shadow-2xs truncate"
                  >
                    <option value="All">{t("All Payments")}</option>
                    <option value="Cash">{t("Cash")}</option>
                    <option value="UPI">{t("UPI")}</option>
                    <option value="Card">{t("Card")}</option>
                    <option value="Mixed">{t("Mixed")}</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={12} />
                </div>

                {/* Reset All Filters button */}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setTypeFilter('All');
                      setPaymentFilter('All');
                    }}
                    className="px-2 py-0.5 sm:py-1 bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 rounded-xl text-[10px] sm:text-xs font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    title={t("Reset All Filters")}
                  >
                    {t("Reset")} ✕
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search Bar + Total Bills Badge + Top Pagination */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 w-full xl:w-auto flex-1 min-w-0">
          {/* Search Input: Dynamic width taking all available remaining space on desktop, full width on mobile */}
          <div className="relative w-full sm:flex-1 sm:min-w-[160px] min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={13} />
            <input
              id="search_bill_history_input"
              type="search"
              name="search_bill_history_no_autofill"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              aria-autocomplete="none"
              readOnly
              onFocus={(e) => e.target.removeAttribute('readOnly')}
              placeholder={t("Search Bill #, Customer, Type, Status...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 sm:py-1.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-xs text-text-main w-full font-medium shadow-2xs" />
          </div>

          {/* Badge & Pagination Row on Mobile / Inline on Desktop */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto">
            {/* Total Bills Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-orange-50 text-orange-800 border border-orange-200 text-xs font-bold shrink-0 shadow-2xs">
              <Receipt size={13} className="text-orange-600" />
              <span>{pagination.totalBills || 0} {t("Total Bills")}</span>
            </div>

            {/* Top Pagination Controls */}
            {pagination.totalPages >= 1 && (
              <div className="flex items-center gap-0.5 bg-background border border-border rounded-xl px-1.5 py-0.5 shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                  className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title={t("Previous Page")}
                >
                  <ChevronLeft size={13} />
                </button>

                <span className="text-[10px] sm:text-[11px] font-bold text-text-main px-1 select-none whitespace-nowrap">
                  {currentPage} / {pagination.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage >= pagination.totalPages || loading}
                  className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title={t("Next Page")}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden flex-1 flex flex-col shadow-xs">
        {/* Desktop Wide Table (Visible on md and larger) */}
        <div className="hidden md:block overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-background sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Bill #")}</th>
                <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">
                  <div className="flex items-center gap-1.5">
                    {t("Date & Time")}
                    <span className="text-[10px] text-primary font-normal">{t("(Latest First)")}</span>
                  </div>
                </th>
                <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Customer")}</th>
                <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Type")}</th>
                <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Status")}</th>
                <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border">{t("Payment")}</th>
                <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border text-right">{t("Total")}</th>
                <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider border-b border-border text-center">{t("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-border/50 animate-pulse">
                    <td className="px-3 py-3"><div className="h-4 w-20 bg-surface-hover rounded-md"></div></td>
                    <td className="px-3 py-3"><div className="h-4 w-24 bg-surface-hover rounded-md"></div></td>
                    <td className="px-3 py-3"><div className="h-4 w-28 bg-surface-hover rounded-md"></div></td>
                    <td className="px-3 py-3"><div className="h-4 w-16 bg-surface-hover rounded-full"></div></td>
                    <td className="px-3 py-3"><div className="h-4 w-16 bg-surface-hover rounded-full"></div></td>
                    <td className="px-3 py-3"><div className="h-4 w-16 bg-surface-hover rounded-md"></div></td>
                    <td className="px-3 py-3 text-right"><div className="h-4 w-16 bg-surface-hover rounded-md ml-auto"></div></td>
                    <td className="px-3 py-3"><div className="h-6 w-16 bg-surface-hover rounded-md mx-auto"></div></td>
                  </tr>
                ))
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-text-muted font-medium">{t("No transactions found")}</td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <React.Fragment key={bill._id}>
                    <tr className={`border-b border-border hover:bg-surface-hover transition-colors group ${bill.status === 'Cancelled' ? 'opacity-75 bg-danger/5' : ''}`}>
                      <td className="px-3 py-2.5 font-bold text-text-main font-mono text-xs sm:text-sm whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleRow(bill._id)} className="p-1 hover:bg-surface rounded-md text-text-muted cursor-pointer transition-transform duration-200" style={{ transform: expandedRows[bill._id] ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            <ChevronDown size={14} />
                          </button>
                          <div>
                            #{bill.billNumber || 'CANCELLED'}
                            {bill.status === 'Cancelled' && bill.cancelReason && (
                              <div className="text-[10px] text-danger mt-0.5">{t("Reason:")} {bill.cancelReason}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">
                        <div className="flex flex-col text-xs">
                          <span className="font-semibold text-text-main">{new Date(bill.updatedAt || bill.createdAt).toLocaleDateString('en-GB').replace(/\//g, '/')}</span>
                          <span className="font-mono text-text-muted text-[11px]">{new Date(bill.updatedAt || bill.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col text-xs">
                          <span className="font-semibold text-text-main">{bill.customerName || '-'}</span>
                          {bill.customerPhone && <span className="font-mono text-text-muted text-[11px]">{bill.customerPhone}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${bill.billType === 'Dine-In' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                          {t(bill.billType)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                          {t(bill.status || 'Paid')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {renderPaymentCell(bill)}
                      </td>
                      <td className="px-3 py-2.5 font-black text-text-main text-right text-xs sm:text-sm whitespace-nowrap">
                        <span className={bill.status === 'Cancelled' ? 'line-through text-text-muted' : ''}>
                          ₹{(bill.total || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <div className="flex justify-center items-center gap-1">
                          <button
                            onClick={() => handleViewBill(bill._id)}
                            disabled={loadingBillId === bill._id}
                            className="p-2 hover:bg-background rounded-lg text-primary transition-colors inline-flex items-center justify-center gap-1 touch-target disabled:opacity-75 cursor-pointer"
                            title={t("View Invoice")}>
                            {loadingBillId === bill._id ? (
                              <Loader2 size={18} className="animate-spin text-orange-600" />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                          {bill.status === 'Paid' && (
                            <button
                              onClick={() => setRefundModal({ isOpen: true, billId: bill._id, reason: '' })}
                              className="p-2 hover:bg-background rounded-lg text-amber-500 transition-colors inline-flex items-center justify-center gap-1 touch-target cursor-pointer"
                              title={t("Refund Bill")}>
                              <RefreshCcw size={18} />
                            </button>
                          )}
                          {bill.status !== 'Deleted' && (
                            <button
                              onClick={() => handleDeleteClick(bill._id)}
                              className="p-2 hover:bg-background rounded-lg text-danger transition-colors inline-flex items-center justify-center gap-1 touch-target cursor-pointer"
                              title={t("Delete Bill (Requires Password)")}>
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRows[bill._id] && (
                      <tr className="bg-surface/50 border-b border-border animate-fade-in">
                        <td colSpan="8" className="p-0">
                          <div className="p-4 border-l-4 border-primary ml-10 my-1 bg-surface/80 rounded-r-lg shadow-2xs">
                            <div className="text-xs font-bold text-text-muted mb-2 uppercase tracking-wider">{t("Order Items")}</div>
                            {loadingRowItems[bill._id] ? (
                              <div className="flex items-center gap-2 py-2 text-xs font-bold text-primary animate-pulse">
                                <Loader2 size={16} className="animate-spin text-primary shrink-0" />
                                <span>{t("Loading order items...")}</span>
                              </div>
                            ) : bill.items && bill.items.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 max-w-4xl">
                                {bill.items.map((item, idx) => {
                                  if (item.isCancelled && item.quantity === item.cancelledQuantity) return null;
                                  const qty = (item.quantity || 0) - (item.cancelledQuantity || 0);
                                  return (
                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-border/40 pb-1 last:border-0">
                                      <span className="text-text-main font-medium truncate pr-2">{item.name} <span className="text-text-muted text-xs ml-1">x{qty}</span></span>
                                      <span className="font-mono text-text-muted shrink-0">₹{((item.price || 0) * qty).toFixed(2)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-sm text-text-muted italic">{t("No items data available")}</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Stacked Card List (Visible on screens < 768px) */}
        <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`mob-skeleton-${i}`} className="bg-background rounded-xl p-3.5 border border-border space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-surface-hover rounded-md"></div>
                  <div className="h-4 w-14 bg-surface-hover rounded-full"></div>
                </div>
                <div className="h-3 w-36 bg-surface-hover rounded-md"></div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="h-5 w-20 bg-surface-hover rounded-md"></div>
                  <div className="h-7 w-24 bg-surface-hover rounded-lg"></div>
                </div>
              </div>
            ))
          ) : filteredBills.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm font-medium">{t("No transactions found")}</div>
          ) : (
            filteredBills.map((bill) => (
              <div key={bill._id} className={`bg-background rounded-xl p-3.5 border border-border space-y-2.5 ${bill.status === 'Cancelled' ? 'opacity-75 bg-danger/5' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRow(bill._id)}
                      className="p-1 hover:bg-surface rounded-lg text-text-muted transition-transform duration-200 cursor-pointer"
                      style={{ transform: expandedRows[bill._id] ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      title={t("Toggle order items")}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <span className="font-bold font-mono text-sm text-text-main">#{bill.billNumber || 'CANCELLED'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${bill.billType === 'Dine-In' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                      {t(bill.billType)}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {t(bill.status || 'Paid')}
                  </span>
                </div>

                {/* Mobile Customer Info */}
                {(bill.customerName || bill.customerPhone) && (
                  <div className="flex flex-col text-xs bg-surface-hover/50 p-2 rounded-lg border border-border/50">
                    <div className="text-[10px] uppercase font-bold text-text-muted mb-0.5">{t("Customer Details")}</div>
                    {bill.customerName && <div className="font-semibold text-text-main">{bill.customerName}</div>}
                    {bill.customerPhone && <div className="font-mono text-text-muted">{bill.customerPhone}</div>}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="font-mono">
                    {new Date(bill.updatedAt || bill.createdAt).toLocaleDateString()} {new Date(bill.updatedAt || bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div>
                    {renderPaymentCell(bill)}
                  </div>
                </div>

                {/* Mobile Expanded Items View */}
                {expandedRows[bill._id] && (
                  <div className="mt-2 pt-2 border-t border-border/60 bg-surface/50 p-2.5 rounded-xl space-y-1.5 animate-fade-in">
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("Order Items")}</div>
                    {loadingRowItems[bill._id] ? (
                      <div className="flex items-center gap-2 py-1 text-xs font-bold text-primary animate-pulse">
                        <Loader2 size={14} className="animate-spin text-primary shrink-0" />
                        <span>{t("Loading order items...")}</span>
                      </div>
                    ) : bill.items && bill.items.length > 0 ? (
                      <div className="space-y-1">
                        {bill.items.map((item, idx) => {
                          if (item.isCancelled && item.quantity === item.cancelledQuantity) return null;
                          const qty = (item.quantity || 0) - (item.cancelledQuantity || 0);
                          return (
                            <div key={idx} className="flex justify-between items-center text-xs border-b border-border/40 pb-1 last:border-0">
                              <span className="text-text-main font-medium truncate pr-2">{item.name} <span className="text-text-muted text-[10px]">x{qty}</span></span>
                              <span className="font-mono text-text-muted shrink-0">₹{((item.price || 0) * qty).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted italic">{t("No items data available")}</div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className={`text-base font-black text-text-main ${bill.status === 'Cancelled' ? 'line-through text-text-muted' : ''}`}>
                    ₹{(bill.total || 0).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewBill(bill._id)}
                      disabled={loadingBillId === bill._id}
                      className="px-3 py-1.5 bg-surface text-primary border border-border rounded-lg text-xs font-bold flex items-center gap-1.5 touch-target cursor-pointer disabled:opacity-75"
                      title={t("View Invoice")}>
                      {loadingBillId === bill._id ? (
                        <Loader2 size={15} className="animate-spin text-orange-600" />
                      ) : (
                        <Eye size={15} />
                      )}
                      <span>{t("Invoice")}</span>
                    </button>
                    {bill.status === 'Paid' && (
                      <button
                        onClick={() => setRefundModal({ isOpen: true, billId: bill._id, reason: '' })}
                        className="w-8 h-8 flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs font-bold touch-target cursor-pointer shrink-0"
                        title={t("Refund Bill")}>
                        <RefreshCcw size={15} />
                      </button>
                    )}
                    {bill.status !== 'Deleted' && (
                      <button
                        onClick={() => handleDeleteClick(bill._id)}
                        className="w-8 h-8 flex items-center justify-center bg-red-50 text-danger border border-red-200 rounded-lg text-xs font-bold touch-target cursor-pointer shrink-0"
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
      </div>

      {selectedBill && (
        <Invoice
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
        />
      )}

      {mixedModalBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[65] animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="text-primary" size={20} />
                <h3 className="text-sm sm:text-base font-bold text-text-main">
                  {t("Mixed Payment Breakdown")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMixedModalBill(null)}
                className="text-text-muted hover:text-text-main p-1 rounded-lg hover:bg-surface-hover text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              {t("Bill")} #{mixedModalBill.billNumber || 'DETAILS'}
            </div>

            <div className="space-y-2 bg-background p-3 rounded-xl border border-border">
              {(() => {
                const pb = mixedModalBill.paymentBreakdown || mixedModalBill.splitPayments || {};
                const parts = [];
                if (pb.cash > 0) parts.push({ mode: 'Cash', amount: pb.cash });
                if (pb.upi > 0) parts.push({ mode: 'UPI', amount: pb.upi });
                if (pb.card > 0) parts.push({ mode: 'Card', amount: pb.card });

                if (parts.length === 0) {
                  return <div className="text-xs text-text-muted italic">{t("No payment breakdown available")}</div>;
                }

                return parts.map((part, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-bold text-text-main border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                      {t(part.mode)}
                    </span>
                    <span className="font-mono text-xs sm:text-sm text-primary">₹{Number(part.amount).toFixed(2)}</span>
                  </div>
                ));
              })()}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setMixedModalBill(null)}
                className="w-full py-2.5 bg-primary text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
              >
                {t("Close")}
              </button>
            </div>
          </div>
        </div>
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
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 mb-5 text-xs sm:text-sm focus:outline-none focus:border-primary text-text-main font-medium"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setRefundModal({ isOpen: false, billId: null, reason: '' })}
                className="flex-1 py-2.5 rounded-xl font-bold border border-border text-text-main hover:bg-surface-hover transition-colors touch-target text-xs sm:text-sm"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={confirmRefund}
                className="flex-1 py-2.5 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors touch-target text-xs sm:text-sm shadow-xs"
              >
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
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">{t("OWNER / ADMIN PIN")}</label>
              <div className="relative">
                <input
                  type={deleteModal.showPassword ? "text" : "password"}
                  value={deleteModal.password}
                  maxLength={4}
                  onChange={(e) => setDeleteModal((prev) => ({ ...prev, password: e.target.value.replace(/\D/g, '').slice(0, 4), error: '' }))}
                  onKeyDown={(e) => e.key === 'Enter' && confirmDelete()}
                  placeholder={t("Enter 4-digit PIN")}
                  autoFocus
                  className="w-full bg-background border border-border rounded-xl pl-4 pr-11 py-2.5 text-center text-sm font-mono tracking-widest font-bold focus:outline-none focus:border-danger text-text-main"
                />

                <button
                  type="button"
                  onClick={() => setDeleteModal((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors p-1"
                  title={deleteModal.showPassword ? "Hide password" : "Show password"}
                >
                  {deleteModal.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, billId: null, password: '', error: '', loading: false, showPassword: false })}
                disabled={deleteModal.loading}
                className="flex-1 py-2.5 rounded-xl font-bold border border-border text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors disabled:opacity-50 touch-target text-xs sm:text-sm"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteModal.loading}
                className="flex-1 py-2.5 rounded-xl font-bold bg-danger text-white hover:bg-red-600 shadow-md shadow-danger/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 touch-target text-xs sm:text-sm"
              >
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
    </div>
  );
};

export default BillHistory;