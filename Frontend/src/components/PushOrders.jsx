import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { ArrowLeft, ExternalLink, Clock, Package, CheckCircle, Truck, PlayCircle } from 'lucide-react';

const PushOrders = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/push-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching push orders', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // In a real app, you would set up a Socket.io listener here to auto-refresh when new orders arrive
    const interval = setInterval(fetchOrders, 15000); // Polling as a fallback for now
    return () => clearInterval(interval);
  }, []);

  const simulateOrder = async () => {
    const platforms = ['Zomato', 'Swiggy', 'UberEats'];
    const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
    const mockOrder = {
      platform: randomPlatform,
      platformOrderId: `${randomPlatform.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 1000000)}`,
      customerDetails: {
        name: 'Mock Customer',
        phone: '9999999999',
        address: '123 Fake Street, City'
      },
      items: [
      { name: 'Paneer Butter Masala', quantity: 2, price: 250 },
      { name: 'Garlic Naan', quantity: 4, price: 40 }],

      totalAmount: 660,
      paymentStatus: 'paid_online'
    };

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      await axios.post(`${getApiUrl()}/push-orders`, mockOrder, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOrders();
    } catch (error) {
      console.error('Error simulating order', error);
      alert('Error creating mock order');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      await axios.put(`${getApiUrl()}/push-orders/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOrders();
    } catch (error) {
      console.error('Error updating status', error);
      alert('Error updating status');
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'Zomato':return 'bg-red-100 text-red-700 border-red-200';
      case 'Swiggy':return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'UberEats':return 'bg-green-100 text-green-700 border-green-200';
      default:return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider animate-pulse"><Clock size={14} />{t("New Request")}</span>;
      case 'accepted':return <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"><CheckCircle size={14} />{t("Accepted")}</span>;
      case 'preparing':return <span className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"><Package size={14} />{t("Preparing")}</span>;
      case 'ready':return <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"><Package size={14} />{t("Ready for Pickup")}</span>;
      case 'dispatched':return <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"><Truck size={14} />{t("Dispatched")}</span>;
      case 'delivered':return <span className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">{t("Delivered")}</span>;
      case 'cancelled':return <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">{t("Cancelled")}</span>;
      default:return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-2.5 gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-black text-text-main tracking-tight truncate">{t("Aggregator Push Orders")}</h1>
            <p className="text-[11px] sm:text-xs text-text-muted truncate">{t("Manage incoming orders from Zomato, Swiggy, etc.")}</p>
          </div>
        </div>
        
        <button
          onClick={simulateOrder}
          className="flex items-center justify-center gap-1.5 bg-surface border border-border hover:bg-surface-hover text-text-main px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all font-bold text-xs sm:text-sm shadow-xs shrink-0 cursor-pointer self-start sm:self-auto whitespace-nowrap">
          <PlayCircle size={16} className="text-blue-500 shrink-0" />
          <span>{t("Simulate Incoming Order")}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
          {orders.length === 0 ? (
            <div className="col-span-full text-center py-12 text-text-muted bg-surface rounded-2xl border border-border text-xs sm:text-sm">
              {t("Waiting for incoming orders...")}
            </div>
          ) : (
            orders.map((order) => (
              <div key={order._id} className="bg-surface rounded-2xl shadow-xs border border-border flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className={`px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-border flex justify-between items-center ${getPlatformColor(order.platform)} bg-opacity-20`}>
                  <div className="font-black text-sm sm:text-base tracking-wide uppercase">
                    {order.platform}
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold font-mono bg-surface/80 px-2 py-0.5 rounded-md border border-border/50">
                    {t("ID:")} {order.platformOrderId}
                  </div>
                </div>

                {/* Body */}
                <div className="p-3.5 sm:p-5 flex-1 flex flex-col space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-text-main text-xs sm:text-sm truncate">{order.customerDetails?.name || 'Customer'}</h3>
                      <p className="text-[11px] text-text-muted mt-0.5">{t("Ordered at:")} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="shrink-0">
                      {getStatusBadge(order.status)}
                    </div>
                  </div>

                  <div className="bg-background rounded-xl p-2.5 sm:p-3 border border-border flex-1">
                    <div className="text-[10px] sm:text-xs font-bold text-text-muted mb-1.5 uppercase tracking-wider border-b border-border pb-1">{t("Order Items")}</div>
                    <ul className="space-y-1.5">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between text-xs sm:text-sm">
                          <span className="text-text-main"><span className="font-bold text-text-muted mr-1">{item.quantity}x</span> {item.name}</span>
                          <span className="font-bold text-text-main font-mono">₹{item.price * item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] sm:text-xs font-bold text-text-muted uppercase">{t("Total Amount")}</span>
                    <span className="text-base sm:text-xl font-black text-text-main font-mono">₹{order.totalAmount}</span>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1 mt-auto">
                    {order.status === 'new' && (
                      <>
                        <button onClick={() => updateStatus(order._id, 'cancelled')} className="py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-xl transition-all border border-red-100 dark:border-red-900/40 cursor-pointer">{t("Reject")}</button>
                        <button onClick={() => updateStatus(order._id, 'accepted')} className="py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer">{t("Accept Order")}</button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <button onClick={() => updateStatus(order._id, 'preparing')} className="col-span-2 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-xs cursor-pointer">{t("Start Preparing")}</button>
                    )}
                    {order.status === 'preparing' && (
                      <button onClick={() => updateStatus(order._id, 'ready')} className="col-span-2 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-all shadow-xs cursor-pointer">{t("Mark Ready (Food Cooked)")}</button>
                    )}
                    {order.status === 'ready' && (
                      <button onClick={() => updateStatus(order._id, 'dispatched')} className="col-span-2 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-xs cursor-pointer">{t("Handover to Rider")}</button>
                    )}
                    {(order.status === 'dispatched' || order.status === 'delivered' || order.status === 'cancelled') && (
                      <div className="col-span-2 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-text-muted text-center bg-surface-hover rounded-xl border border-border">{t("No further action needed")}</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

};

export default PushOrders;