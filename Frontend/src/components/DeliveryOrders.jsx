import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
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
  ChevronRight } from
'lucide-react';
import Toast from './Toast';
import BackButton from './common/BackButton';

const DeliveryOrders = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
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

  const fetchDeliveryOrders = async () => {
    setLoading(true);
    try {
      // Get only paid delivery orders from bill history with pagination
      // getBills already returns only 'Paid' bills (status: 'Paid')
      const paidBills = await getBills(currentPage, itemsPerPage, searchTerm);

      // Filter for delivery orders
      // Only show orders with billType === 'Delivery'
      const paidDeliveryOrders = (paidBills.bills || []).filter((bill) => {
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
        const allDeliveryCount = (allBills.bills || []).filter((bill) => {
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

  useEffect(() => {
    // eslint-disable-next-line
    fetchDeliveryOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm]);

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, billId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.billId) return;

    try {
      await deleteBill(deleteModal.billId);
      setOrders(orders.filter((order) => order._id !== deleteModal.billId));
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
      case 'Swiggy':return 'bg-orange-100 text-orange-800';
      case 'Zomato':return 'bg-red-100 text-red-800';
      case 'Other':return 'bg-gray-100 text-gray-800';
      default:return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = orders.filter((order) => {
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

  return (
    <div className="h-full flex flex-col bg-slate-50 p-3 sm:p-6 overflow-y-auto custom-scrollbar w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{t("Delivery Orders")}</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">{t("View and manage delivery orders")}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={t("Search Bill #...")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-64 pl-9 pr-3.5 py-2.5 bg-slate-100 border-none rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all" />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowPlatformFilter(!showPlatformFilter)}
              className="flex items-center gap-2 pl-3 pr-8 py-2.5 bg-slate-100 border-none rounded-xl text-xs sm:text-sm font-bold text-slate-700 touch-target">
              <Filter size={16} className="text-slate-400" />
              <span>{t(platformFilter === 'all' ? 'All' : platformFilter)}</span>
              <ChevronDown size={14} className={`absolute right-3 transition-transform ${showPlatformFilter ? 'rotate-180' : ''}`} />
            </button>
            
            {showPlatformFilter &&
              <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-20 min-w-[140px]">
                {['all', 'Swiggy', 'Zomato', 'Direct', 'Other'].map((platform) =>
                  <button
                    key={platform}
                    onClick={() => {
                      setPlatformFilter(platform);
                      setCurrentPage(1);
                      setShowPlatformFilter(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      platformFilter === platform ?
                      'bg-primary text-white' :
                      'text-slate-600 hover:bg-slate-100'
                    }`}>
                    {t(platform === 'all' ? 'All' : platform)}
                  </button>
                )}
              </div>
            }
          </div>

          <button
            onClick={fetchDeliveryOrders}
            className="p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all text-slate-600 touch-target"
            title={t("Refresh")}>
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex-1 flex flex-col shadow-xs">
        {/* Desktop Table View (Hidden on mobile <768px) */}
        <div className="hidden md:block overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-bold text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider">{t("Bill #")}</th>
                <th className="p-4 font-bold text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>{t("Date & Time")}</span>
                    <span className="text-[10px] text-primary font-normal">{t("(Latest First)")}</span>
                  </div>
                </th>
                <th className="p-4 font-bold text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider">{t("Platform")}</th>
                <th className="p-4 font-bold text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider">{t("Payment")}</th>
                <th className="p-4 font-bold text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider text-right">{t("Total")}</th>
                <th className="p-4 font-bold text-slate-500 border-b border-slate-100 text-xs uppercase tracking-wider text-center">{t("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ?
                [...Array(8)].map((_, i) =>
                  <tr key={i} className="border-b border-slate-100 animate-pulse">
                    <td className="p-4"><div className="w-12 h-4 bg-slate-100 rounded"></div></td>
                    <td className="p-4">
                      <div className="w-20 h-4 bg-slate-100 rounded mb-1"></div>
                      <div className="w-12 h-3 bg-slate-100 rounded"></div>
                    </td>
                    <td className="p-4"><div className="w-16 h-5 bg-slate-100 rounded"></div></td>
                    <td className="p-4"><div className="w-20 h-4 bg-slate-100 rounded"></div></td>
                    <td className="p-4"><div className="w-14 h-4 bg-slate-100 rounded ml-auto"></div></td>
                    <td className="p-4"><div className="w-16 h-8 bg-slate-100 rounded mx-auto"></div></td>
                  </tr>
                ) :
                filteredOrders.length === 0 ?
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <Truck size={48} className="text-slate-300" />
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">{t("No Delivery Orders")}</h3>
                        <p className="text-xs text-slate-500">{t("No orders match your current filters")}</p>
                      </div>
                    </div>
                  </td>
                </tr> :

                filteredOrders.map((order) =>
                  <tr key={order._id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-800 font-mono text-sm">#{order.billNumber}</td>
                    <td className="p-4 text-slate-500">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{new Date(order.updatedAt || order.createdAt).toLocaleDateString()}</span>
                        <span className="text-[10px]">{new Date(order.updatedAt || order.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPlatformColor(order.orderSource || 'Other')}`}>
                        {t(order.orderSource || 'Other')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <CreditCard size={14} className="text-slate-400" />
                        <span>{t(order.paymentMode)}</span>
                      </div>
                    </td>
                    <td className="p-4 font-black text-slate-800 text-right text-sm">₹{order.total?.toFixed(2) || '0.00'}</td>
                    <td className="p-4 text-center">
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
                          className="p-2 hover:bg-slate-100 rounded-xl text-primary transition-colors touch-target" title={t("View Invoice")}>
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(order._id)}
                          className="p-2 hover:bg-red-50 rounded-xl text-red-500 transition-colors touch-target" title={t("Delete Order")}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Stacked Card View (Visible on screens <768px) */}
        <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 p-4">
              <Truck size={40} className="mx-auto text-slate-300 mb-2" />
              <h3 className="text-base font-bold text-slate-800 mb-1">{t("No Delivery Orders")}</h3>
              <p className="text-xs text-slate-500">{t("No orders match your current filters")}</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order._id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono font-bold text-slate-800 text-base">#{order.billNumber}</span>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {new Date(order.updatedAt || order.createdAt).toLocaleDateString()} • {new Date(order.updatedAt || order.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPlatformColor(order.orderSource || 'Other')}`}>
                    {t(order.orderSource || 'Other')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <CreditCard size={14} className="text-slate-400" />
                    <span>{t(order.paymentMode)}</span>
                  </div>
                  <span className="font-black text-slate-900 text-base">₹{order.total?.toFixed(2) || '0.00'}</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
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
                    className="flex-1 py-2.5 bg-primary/10 text-primary font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 touch-target">
                    <Eye size={16} />
                    <span>{t("Invoice")}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(order._id)}
                    className="p-2.5 bg-red-50 text-red-500 rounded-xl touch-target"
                    title={t("Delete Order")}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination Controls */}
        {pagination.totalPages > 1 &&
        <div className="p-4 border-t border-border flex items-center justify-between bg-background">
            <div className="text-sm text-text-muted">{t("Showing")} {(currentPage - 1) * itemsPerPage + 1} {t("to")} {Math.min(currentPage * itemsPerPage, pagination.totalBills)} {t("of")} {pagination.totalBills} {t("orders")}
          </div>
            <div className="flex items-center gap-2">
              <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors">
              
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(pagination.totalPages)].map((_, i) => {
                const page = i + 1;
                if (
                page === 1 ||
                page === pagination.totalPages ||
                page >= currentPage - 1 && page <= currentPage + 1)
                {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      disabled={loading}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page ?
                      'bg-primary text-white' :
                      'bg-surface text-text-muted hover:bg-surface-hover hover:text-text-main border border-border'}`
                      }>
                      
                        {page}
                      </button>);

                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 text-text-muted">...</span>;
                }
                return null;
              })}
              </div>
              <button
              onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage === pagination.totalPages || loading}
              className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors">
              
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        }
      </div>

      {selectedBill &&
      <Invoice
        bill={selectedBill}
        onClose={() => setSelectedBill(null)} />

      }

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, billId: null })}
        onConfirm={confirmDelete} title={t("Delete Delivery Order")}

        message={t("Are you sure you want to delete this delivery order? This action cannot be undone.")}
        confirmText={t("Delete")}
        isDanger={true} />
      

      {toast &&
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)} />

      }
    </div>);

};

export default DeliveryOrders;