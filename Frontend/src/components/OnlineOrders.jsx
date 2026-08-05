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
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t("Direct Online Orders")}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500">{t("Manage orders placed through your own website")}</p>
              {config?.domainName &&
              <a
                href={`https://${config.domainName.replace(/^https?:\/\//, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors">
                
                  {config.domainName} <ExternalLink size={12} />
                </a>
              }
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md font-medium transition-colors shadow-sm">
            
            <RefreshCw size={18} />{t("Refresh")}

          </button>
          <button
            onClick={simulateIncomingOrder}
            className="flex items-center gap-2 bg-[#000000] hover:bg-gray-800 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm">
            
            <ShoppingBag size={18} />{t("Simulate Website Order")}

          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
        {/* Filters */}
        <div className="flex border-b border-gray-100 overflow-x-auto bg-gray-50/50">
          {['all', 'new', 'accepted', 'preparing', 'ready', 'dispatched'].map((status) =>
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap capitalize transition-colors ${
            filter === status ?
            'text-primary border-b-2 border-primary bg-primary/5' :
            'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`
            }>
            
              {status === 'all' ? t('All Active Orders') : t(status.charAt(0).toUpperCase() + status.slice(1))}
            </button>
          )}
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          {loading ?
          <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :
          orders.length === 0 ?
          <div className="text-center py-20">
              <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">{t("No orders found")}</h3>
              <p className="text-gray-500">{t("There are no")}{filter !== 'all' ? filter : ''}{t("direct online orders right now.")}</p>
            </div> :

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {orders.map((order) =>
            <div key={order._id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex justify-between items-start p-4 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="bg-black text-white px-2 py-1 rounded text-xs font-bold tracking-wider">{t("DIRECT WEB")}</div>
                      <div>
                        <span className="font-bold text-gray-800">{order.platformOrderId}</span>
                        <p className="text-xs text-gray-500 mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">{t("Customer")}</h4>
                        <p className="font-medium text-gray-800">{order.customerDetails?.name || 'Unknown'}</p>
                        <p className="text-sm text-gray-600">{order.customerDetails?.phone || 'N/A'}</p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{order.customerDetails?.address || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">{t("Payment")}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${order.paymentStatus === 'paid_online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {order.paymentStatus === 'paid_online' ? 'Paid Online' : 'Cash on Delivery'}
                          </span>
                          <span className="font-bold text-gray-800">₹{order.totalAmount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">{t("Order Items")}</h4>
                      <ul className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                        {order.items.map((item, idx) =>
                    <li key={idx} className="flex justify-between items-start text-sm">
                            <span className="text-gray-800"><span className="font-medium">{item.quantity}x</span> {item.name}</span>
                            <span className="font-medium text-gray-600">₹{item.price * item.quantity}</span>
                          </li>
                    )}
                      </ul>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {order.status === 'new' &&
                <>
                        <button onClick={() => updateOrderStatus(order._id, 'accepted')} className="col-span-2 sm:col-span-2 bg-primary hover:bg-primary-hover text-white py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2">
                          <CheckCircle size={16} />{t("Accept Order")}
                  </button>
                        <button onClick={() => updateOrderStatus(order._id, 'cancelled')} className="col-span-2 sm:col-span-2 bg-white hover:bg-red-50 text-red-600 border border-gray-300 hover:border-red-200 py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2">
                          <XCircle size={16} />{t("Reject")}
                  </button>
                      </>
                }
                    {order.status === 'accepted' &&
                <button onClick={() => updateOrderStatus(order._id, 'preparing')} className="col-span-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2">
                        <Clock size={16} />{t("Start Preparing (Send to KDS)")}
                </button>
                }
                    {order.status === 'preparing' &&
                <button onClick={() => updateOrderStatus(order._id, 'ready')} className="col-span-full bg-green-500 hover:bg-green-600 text-white py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2">
                        <CheckCircle size={16} />{t("Mark as Ready")}
                </button>
                }
                    {order.status === 'ready' &&
                <button onClick={() => updateOrderStatus(order._id, 'dispatched')} className="col-span-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2">
                        <Truck size={16} />{t("Dispatch / Hand over to Rider")}
                </button>
                }
                    {order.status === 'dispatched' &&
                <button onClick={() => updateOrderStatus(order._id, 'delivered')} className="col-span-full bg-gray-800 hover:bg-gray-900 text-white py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2">
                        <CheckCircle size={16} />{t("Mark as Delivered")}
                </button>
                }
                  </div>
                </div>
            )}
            </div>
          }
        </div>
      </div>
    </div>);

};

export default OnlineOrders;