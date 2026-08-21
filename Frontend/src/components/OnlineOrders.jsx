import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { ArrowLeft, RefreshCw, CheckCircle, Clock, Truck, FileText, ShoppingBag, XCircle, ExternalLink } from 'lucide-react';

const OnlineOrders = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = getApiUrl();
      // Direct platform means they ordered directly from the restaurant's website
      let url = `${API_BASE_URL}/push-orders?platform=Direct`;
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }
      const headers = { 
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
      };
      const response = await axios.get(url, { headers });
      setOrders(response.data);

      // Also fetch config to get the domain link
      const configRes = await axios.get(`${API_BASE_URL}/online-configs`, { headers });
      setConfig(configRes.data);
    } catch (error) {
      console.error('Error fetching online orders', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (id, newStatus) => {
    try {
      const API_BASE_URL = getApiUrl();
      await axios.put(`${API_BASE_URL}/push-orders/${id}/status`, { status: newStatus }, {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        }
      });
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status', error);
      alert('Failed to update status');
    }
  };

  const simulateIncomingOrder = async () => {
    try {
      const mockOrder = {
        platform: 'Direct',
        platformOrderId: `WEB-${Math.floor(100000 + Math.random() * 900000)}`,
        customerDetails: {
          name: 'Jane Smith',
          phone: '+91 9876543210',
          address: '456 Web Avenue, Tech Park'
        },
        items: [
        { name: 'Margherita Pizza', quantity: 2, price: 250 },
        { name: 'Garlic Bread', quantity: 1, price: 120 }],

        totalAmount: 620,
        paymentStatus: 'paid_online'
      };

      const API_BASE_URL = getApiUrl();
      await axios.post(`${API_BASE_URL}/push-orders`, mockOrder, {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        }
      });
      fetchOrders();
      alert(t('A new online order just arrived from your website!'));
    } catch (error) {
      console.error('Error simulating order', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'accepted':return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'preparing':return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'ready':return 'bg-green-100 text-green-800 border-green-200';
      case 'dispatched':return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered':return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled':return 'bg-red-100 text-red-800 border-red-200';
      default:return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 p-2.5 sm:p-6 overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-5 gap-2.5 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">{t("Direct Online Orders")}</h1>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">{t("Manage orders placed through your own website")}</p>
              {config?.domainName &&
                <a
                  href={`https://${config.domainName.replace(/^https?:\/\//, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors">
                  {config.domainName} <ExternalLink size={11} />
                </a>
              }
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={fetchOrders}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl font-bold transition-colors shadow-xs text-xs sm:text-sm shrink-0 whitespace-nowrap cursor-pointer">
            <RefreshCw size={15} />
            <span>{t("Refresh")}</span>
          </button>
          <button
            onClick={simulateIncomingOrder}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl font-bold transition-colors shadow-xs text-xs sm:text-sm shrink-0 whitespace-nowrap cursor-pointer">
            <ShoppingBag size={15} />
            <span>{t("Simulate Order")}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col flex-1">
        {/* Filters - Smooth scroll, no tab overlapping */}
        <div className="flex border-b border-slate-100 overflow-x-auto bg-slate-50/50 flex-nowrap shrink-0">
          {['all', 'new', 'accepted', 'preparing', 'ready', 'dispatched'].map((status) =>
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold whitespace-nowrap capitalize transition-colors shrink-0 cursor-pointer ${
                filter === status ?
                'text-primary border-b-2 border-primary bg-primary/5' :
                'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}>
              {status === 'all' ? t('All Active Orders') : t(status.charAt(0).toUpperCase() + status.slice(1))}
            </button>
          )}
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-5 bg-slate-50/30">
          {loading ?
            <div className="flex justify-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div> :
            orders.length === 0 ?
            <div className="text-center py-12 p-4 max-w-sm mx-auto">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-2.5">
                <ShoppingBag size={28} className="text-slate-400" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-1">{t("No orders found")}</h3>
              <p className="text-xs text-slate-500">{t("There are no")} {filter !== 'all' ? filter : ''} {t("direct online orders right now.")}</p>
            </div> :

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
              {orders.map((order) =>
                <div key={order._id} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col hover:shadow-sm transition-shadow">
                  {/* Header */}
                  <div className="flex justify-between items-center p-3 sm:p-3.5 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono">{t("DIRECT WEB")}</div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm font-mono">{order.platformOrderId}</span>
                        <p className="text-[10px] text-slate-400 font-medium">{new Date(order.createdAt).toLocaleString('en-IN', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                        })}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col md:flex-row gap-3 sm:gap-4">
                    <div className="flex-1 space-y-2.5">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("Customer")}</h4>
                        <p className="font-bold text-slate-800 text-xs sm:text-sm">{order.customerDetails?.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-600 font-mono">{order.customerDetails?.phone || 'N/A'}</p>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2">{order.customerDetails?.address || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("Payment")}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${order.paymentStatus === 'paid_online' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {order.paymentStatus === 'paid_online' ? 'Paid Online' : 'Cash on Delivery'}
                          </span>
                          <span className="font-black text-slate-800 text-xs sm:text-sm">₹{order.totalAmount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-100">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t("Order Items")}</h4>
                      <ul className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {order.items.map((item, idx) =>
                          <li key={idx} className="flex justify-between items-start text-xs">
                            <span className="text-slate-700"><span className="font-bold text-slate-900 font-mono">{item.quantity}x</span> {item.name}</span>
                            <span className="font-bold text-slate-800 font-mono">₹{item.price * item.quantity}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-2.5 sm:p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {order.status === 'new' &&
                      <>
                        <button onClick={() => updateOrderStatus(order._id, 'accepted')} className="col-span-1 sm:col-span-2 bg-primary hover:bg-primary-hover text-white py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
                          <CheckCircle size={15} /><span>{t("Accept Order")}</span>
                        </button>
                        <button onClick={() => updateOrderStatus(order._id, 'cancelled')} className="col-span-1 sm:col-span-2 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
                          <XCircle size={15} /><span>{t("Reject")}</span>
                        </button>
                      </>
                    }
                    {order.status === 'accepted' &&
                      <button onClick={() => updateOrderStatus(order._id, 'preparing')} className="col-span-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
                        <Clock size={15} /><span>{t("Start Preparing (Send to KDS)")}</span>
                      </button>
                    }
                    {order.status === 'preparing' &&
                      <button onClick={() => updateOrderStatus(order._id, 'ready')} className="col-span-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
                        <CheckCircle size={15} /><span>{t("Mark as Ready")}</span>
                      </button>
                    }
                    {order.status === 'ready' &&
                      <button onClick={() => updateOrderStatus(order._id, 'dispatched')} className="col-span-full bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
                        <Truck size={15} /><span>{t("Dispatch / Hand over to Rider")}</span>
                      </button>
                    }
                    {order.status === 'dispatched' &&
                      <button onClick={() => updateOrderStatus(order._id, 'delivered')} className="col-span-full bg-slate-800 hover:bg-slate-900 text-white py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
                        <CheckCircle size={15} /><span>{t("Mark as Delivered")}</span>
                      </button>
                    }
                  </div>
                </div>
              )}
            </div>
          }
        </div>
      </div>
    </div>
  );

};

export default OnlineOrders;