import React, { useState, useEffect } from 'react';
import Invoice from './Invoice';
import { Search, Eye, CreditCard, Filter, Trash2, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';
import { getBills, deleteBill, getBillById, apiRefundOrder } from '../api/billing';
import useDebounce from '../hooks/useDebounce';
import ConfirmationModal from './ConfirmationModal';
import Toast from './Toast';

const BillHistory = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, billId: null });
  const [refundModal, setRefundModal] = useState({ isOpen: false, billId: null, reason: '' });
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalBills: 0, totalPages: 1, currentPage: 1 });
  const itemsPerPage = 20; // Server-side pagination - Show 20 bills per page (latest first)
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchBills();
  }, [currentPage, debouncedSearchTerm, filterType]);

  // Refresh bills when component mounts to show latest bills first
  useEffect(() => {
    // Reset to page 1 and fetch latest bills when component mounts
    setCurrentPage(1);
    fetchBills();
  }, []);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const data = await getBills(currentPage, itemsPerPage, debouncedSearchTerm);

      // Handle both old format (array) and new format (object with pagination)
      let billsData = [];
      if (Array.isArray(data)) {
        billsData = data;
      } else {
        billsData = data.bills || [];
      }

      // Filter out delivery orders - only show dine-in and takeaway
      // Only filter by billType, not orderSource
      const filteredBills = billsData.filter(bill => {
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
    setDeleteModal({ isOpen: true, billId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.billId) return;
    
    try {
      await deleteBill(deleteModal.billId);
      setBills(bills.filter(bill => bill._id !== deleteModal.billId));
      setDeleteModal({ isOpen: false, billId: null });
      setToast({ message: 'Bill deleted successfully', type: 'success' });
    } catch (error) {
      console.error('Error deleting bill:', error);
      setToast({ message: error.response?.data?.message || 'Failed to delete bill', type: 'error' });
    }
  };

  const confirmRefund = async () => {
    if (!refundModal.billId) return;
    try {
      await apiRefundOrder(refundModal.billId, refundModal.reason);
      setBills(bills.map(bill => bill._id === refundModal.billId ? { ...bill, status: 'Refunded', cancelReason: refundModal.reason || 'Customer requested refund' } : bill));
      setRefundModal({ isOpen: false, billId: null, reason: '' });
      setToast({ message: 'Bill refunded successfully', type: 'success' });
    } catch (error) {
      console.error('Error refunding bill:', error);
      setToast({ message: error.response?.data?.message || 'Failed to refund bill', type: 'error' });
    }
  };

  // Client-side filtering for bill type and payment mode (server handles search)
  // Bills are already sorted by newest first from backend (updatedAt: -1)
  // This ensures recently paid bills appear at the top
  // We maintain this order - no re-sorting needed
  const filteredBills = bills.filter(bill => {
    if (filterType === 'All') {
      return true;
    } else if (filterType === 'Dine-In' || filterType === 'Takeaway') {
      return bill.billType === filterType;
    } else if (filterType === 'Cash' || filterType === 'UPI' || filterType === 'Card') {
      return bill.paymentMode === filterType;
    }
    return true;
  });
  
  // Ensure bills remain sorted by newest first (backend already does this, but double-check)
  // filteredBills are already in correct order from backend, no need to sort again

  // Reset to first page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterType]);

  if (loading) return (
    <div className="h-full flex flex-col bg-background p-6">
      <div className="flex justify-between items-center mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-border/50">
        <div className="animate-pulse">
          <div className="w-40 h-6 bg-text-muted/20 rounded mb-2"></div>
          <div className="w-48 h-4 bg-text-muted/20 rounded"></div>
        </div>
        <div className="flex gap-4 animate-pulse">
          <div className="w-64 h-10 bg-surface-hover rounded-xl"></div>
          <div className="w-32 h-10 bg-surface-hover rounded-xl"></div>
        </div>
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-background">
              <tr>
                <th className="p-4"><div className="w-12 h-4 bg-text-muted/20 rounded animate-pulse"></div></th>
                <th className="p-4"><div className="w-20 h-4 bg-text-muted/20 rounded animate-pulse"></div></th>
                <th className="p-4"><div className="w-12 h-4 bg-text-muted/20 rounded animate-pulse"></div></th>
                <th className="p-4"><div className="w-16 h-4 bg-text-muted/20 rounded animate-pulse"></div></th>
                <th className="p-4"><div className="w-12 h-4 bg-text-muted/20 rounded animate-pulse"></div></th>
                <th className="p-4"><div className="w-16 h-4 bg-text-muted/20 rounded animate-pulse"></div></th>
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  <td className="p-4"><div className="w-8 h-4 bg-text-muted/20 rounded"></div></td>
                  <td className="p-4">
                    <div className="w-16 h-4 bg-text-muted/20 rounded mb-1"></div>
                    <div className="w-12 h-3 bg-text-muted/20 rounded"></div>
                  </td>
                  <td className="p-4"><div className="w-12 h-5 bg-text-muted/20 rounded"></div></td>
                  <td className="p-4"><div className="w-16 h-4 bg-text-muted/20 rounded"></div></td>
                  <td className="p-4"><div className="w-10 h-4 bg-text-muted/20 rounded"></div></td>
                  <td className="p-4"><div className="flex justify-end gap-2">
                    <div className="w-8 h-8 bg-text-muted/20 rounded"></div>
                    <div className="w-8 h-8 bg-text-muted/20 rounded"></div>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-border/50">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main">Transaction History</h1>
          <p className="text-xs sm:text-sm text-text-muted">View and manage past transactions</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Search Bill #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary text-text-main w-full"
            />
          </div>

          <div className="relative w-full sm:w-auto">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full sm:w-auto pl-10 pr-8 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary text-text-main appearance-none cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Dine-In">Dine-In</option>
              <option value="Takeaway">Takeaway</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-background sticky top-0 z-10">
              <tr>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Bill #</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border">
                  <div className="flex items-center gap-2">
                    Date & Time
                    <span className="text-xs text-primary font-normal">(Latest First)</span>
                  </div>
                </th>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Type</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Status</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Payment</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border text-right">Total</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-text-muted">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => (
                  <tr key={bill._id} className={`border-b border-border hover:bg-surface-hover transition-colors group ${bill.status === 'Cancelled' ? 'opacity-75 bg-danger/5' : ''}`}>
                    <td className="p-4 font-medium text-text-main">
                      #{bill.billNumber || 'CANCELLED'}
                      {bill.status === 'Cancelled' && bill.cancelReason && (
                        <div className="text-[10px] text-danger mt-1">Reason: {bill.cancelReason}</div>
                      )}
                    </td>
                    <td className="p-4 text-text-muted">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-text-main">{new Date(bill.updatedAt || bill.createdAt).toLocaleDateString()}</span>
                        <span className="text-xs">{new Date(bill.updatedAt || bill.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${
                        bill.billType === 'Dine-In' 
                          ? 'bg-primary/10 text-primary border-primary/20' 
                          : 'bg-accent/10 text-accent-dark border-accent/20'
                      }`}>
                        {bill.billType}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${
                        bill.status === 'Paid' 
                          ? 'bg-success/10 text-success border-success/20' 
                          : 'bg-danger/10 text-danger border-danger/20'
                      }`}>
                        {bill.status || 'Paid'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-text-main">
                        <CreditCard size={16} className="text-text-muted" />
                        <span>{bill.paymentMode || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-text-main text-right">
                      <span className={bill.status === 'Cancelled' ? 'line-through text-text-muted' : ''}>
                        ₹{(bill.total || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={async () => {
                            setLoadingBill(true);
                            try {
                              // Fetch full bill details with all items
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
                          className="p-2 hover:bg-background rounded-lg text-primary transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="View Invoice"
                        >
                          <Eye size={18} />
                        </button>
                        {bill.status === 'Paid' && (
                          <button 
                            onClick={() => setRefundModal({ isOpen: true, billId: bill._id, reason: '' })}
                            className="p-2 hover:bg-background rounded-lg text-amber-500 transition-colors inline-flex items-center gap-2"
                            title="Refund Bill"
                          >
                            <RefreshCcw size={18} />
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
        
        {/* Pagination Controls - Same style as MenuManagement */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-background">
            <div className="text-sm text-text-muted">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, pagination.totalBills)} of{' '}
              {pagination.totalBills} bills
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
                className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors"
              >
                <ChevronLeft size={18} />
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
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-white'
                            : 'bg-surface text-text-muted hover:bg-surface-hover hover:text-text-main border border-border'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-2 text-text-muted">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage === pagination.totalPages || loading}
                className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors"
              >
                <ChevronRight size={18} />
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

      {refundModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-lg font-bold text-text-main mb-2">Refund Order</h3>
            <p className="text-text-muted text-sm mb-4">Please provide a reason for the refund.</p>
            <input
              type="text"
              value={refundModal.reason}
              onChange={(e) => setRefundModal({ ...refundModal, reason: e.target.value })}
              placeholder="e.g. Customer unhappy, wrong item"
              className="w-full bg-background border border-border rounded-xl px-4 py-2 mb-6 text-sm focus:outline-none focus:border-primary text-text-main"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setRefundModal({ isOpen: false, billId: null, reason: '' })}
                className="flex-1 py-2 rounded-xl font-bold border border-border text-text-main hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmRefund}
                className="flex-1 py-2 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}

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

export default BillHistory;
