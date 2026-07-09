import React, { useState, useEffect } from 'react';
import { getBills, getBillById, deleteBill } from '../api/billing';
import Invoice from './Invoice';
import ConfirmationModal from './ConfirmationModal';
import {
  Truck,
  RefreshCw,
  Filter,
  Search,
  ChevronDown,
  Eye,
  CreditCard,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Toast from './Toast';

const DeliveryOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all'); // all, Swiggy, Zomato, Direct, Other
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState(null);
  const [showPlatformFilter, setShowPlatformFilter] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, billId: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalBills: 0, totalPages: 1, currentPage: 1 });
  const itemsPerPage = 20;

  useEffect(() => {
    fetchDeliveryOrders();
  }, [currentPage, searchTerm]);

  // Reset to first page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, platformFilter]);

  const fetchDeliveryOrders = async () => {
    setLoading(true);
    try {
      // Get only paid delivery orders from bill history with pagination
      // getBills already returns only 'Paid' bills (status: 'Paid')
      const paidBills = await getBills(currentPage, itemsPerPage, searchTerm);
      
      // Filter for delivery orders
      // Only show orders with billType === 'Delivery'
      const paidDeliveryOrders = (paidBills.bills || []).filter(bill => {
        return bill.billType === 'Delivery';
      });
      
      // Sort by date (newest first) - backend already sorts, but ensure it
      const allDeliveryOrders = paidDeliveryOrders.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt);
        const dateB = new Date(b.updatedAt || b.createdAt);
        return dateB - dateA;
      });
      
      setOrders(allDeliveryOrders);
      
      // Calculate pagination for delivery orders
      // We need to get total count of delivery orders
      if (currentPage === 1) {
        const allBills = await getBills(1, 1000, searchTerm);
        const allDeliveryCount = (allBills.bills || []).filter(bill => {
          return bill.billType === 'Delivery';
        }).length;
        
        setPagination({
          totalBills: allDeliveryCount,
          totalPages: Math.ceil(allDeliveryCount / itemsPerPage),
          currentPage: currentPage
        });
      } else {
        setPagination(paidBills.pagination || { totalBills: allDeliveryOrders.length, totalPages: 1, currentPage: 1 });
      }
    } catch (error) {
      console.error('Error fetching delivery orders:', error);
      setToast({ message: 'Failed to load delivery orders', type: 'error' });
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
      setOrders(orders.filter(order => order._id !== deleteModal.billId));
      setDeleteModal({ isOpen: false, billId: null });
      setToast({ message: 'Delivery order deleted successfully', type: 'success' });
      // Refresh to update pagination
      fetchDeliveryOrders();
    } catch (error) {
      console.error('Error deleting delivery order:', error);
      setToast({ message: error.response?.data?.message || 'Failed to delete order', type: 'error' });
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'Swiggy': return 'bg-orange-100 text-orange-800';
      case 'Zomato': return 'bg-red-100 text-red-800';
      case 'Other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (platformFilter === 'all') {
      return true;
    }
    if (platformFilter === 'Other') {
      // Other includes anything that's not Swiggy, Zomato, or Direct
      return order.orderSource && 
             order.orderSource !== 'Swiggy' && 
             order.orderSource !== 'Zomato' && 
             order.orderSource !== 'Direct';
    }
    return order.orderSource === platformFilter;
  });

  if (loading) {
    return (
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
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background p-6">
      <div className="flex justify-between items-center mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-border/50">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Delivery Orders</h1>
          <p className="text-text-muted">View and manage delivery orders</p>
        </div>
        
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Search Bill #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary text-text-main w-64"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowPlatformFilter(!showPlatformFilter)}
              className="flex items-center gap-2 pl-3 pr-8 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary text-text-main"
            >
              <Filter size={18} className="text-text-muted" />
              <span>{platformFilter === 'all' ? 'All ' : platformFilter}</span>
              <ChevronDown size={16} className={`absolute right-3 transition-transform ${showPlatformFilter ? 'rotate-180' : ''}`} />
            </button>
            
            {showPlatformFilter && (
              <div className="absolute top-full right-0 mt-2 bg-surface border border-border rounded-xl shadow-lg p-2 z-20 min-w-[140px]">
                {['all', 'Swiggy', 'Zomato', 'Direct', 'Other'].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => {
                      setPlatformFilter(platform);
                      setShowPlatformFilter(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg font-medium transition-all ${
                      platformFilter === platform
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                    }`}
                  >
                    {platform === 'all' ? 'All ' : platform}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={fetchDeliveryOrders}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-all text-text-main"
          >
            <RefreshCw size={18} />
          </button>
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
                <th className="p-4 font-semibold text-text-muted border-b border-border">Platform</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border">Payment</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border text-right">Total</th>
                <th className="p-4 font-semibold text-text-muted border-b border-border text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-4">
                      <Truck size={48} className="text-text-muted" />
                      <div>
                        <h3 className="text-lg font-bold text-text-main mb-2">No Delivery Orders</h3>
                        <p className="text-text-muted">No orders match your current filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order._id} className="border-b border-border hover:bg-surface-hover transition-colors group">
                    <td className="p-4 font-medium text-text-main">#{order.billNumber}</td>
                    <td className="p-4 text-text-muted">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-text-main">{new Date(order.updatedAt || order.createdAt).toLocaleDateString()}</span>
                        <span className="text-xs">{new Date(order.updatedAt || order.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${getPlatformColor(order.orderSource || 'Other')}`}>
                        {order.orderSource || 'Other'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-text-main">
                        <CreditCard size={16} className="text-text-muted" />
                        <span>{order.paymentMode}</span>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-text-main text-right">₹{order.total?.toFixed(2) || '0.00'}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={async () => {
                            setLoadingBill(true);
                            try {
                              // Fetch full bill details with all items
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
                          className="p-2 hover:bg-background rounded-lg text-primary transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="View Invoice"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(order._id)}
                          className="p-2 hover:bg-danger/10 rounded-lg text-danger transition-colors inline-flex items-center gap-2"
                          title="Delete Order"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-background">
            <div className="text-sm text-text-muted">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, pagination.totalBills)} of{' '}
              {pagination.totalBills} orders
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

      <ConfirmationModal 
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, billId: null })}
        onConfirm={confirmDelete}
        title="Delete Delivery Order"
        message="Are you sure you want to delete this delivery order? This action cannot be undone."
        confirmText="Delete"
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

export default DeliveryOrders;