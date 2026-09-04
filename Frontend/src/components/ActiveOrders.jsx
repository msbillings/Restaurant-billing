import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import { getOpenOrders } from '../api/billing';
import { getCachedOpenOrders } from '../db/offlineDb';
import { UtensilsCrossed, Clock, ChevronRight, ArrowLeft, FileText, CheckCircle } from 'lucide-react';
import realtimeService from '../services/realtimeService';

const ActiveOrders = ({ onSelectOrder, onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All'); // 'All', 'Dine-In', 'Online'

  useEffect(() => {
    // 1. Instant Cache Load (0ms delay) for immediate UI rendering
    getCachedOpenOrders().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        const validOpen = cached.filter(o => o.status === 'Open' || o.status === 'Billed');
        if (validOpen.length > 0) {
          setOrders(validOpen);
          setLoading(false);
        }
      }
    }).catch(() => {});

    // 2. Initial Load directly from server
    fetchOrders(false);

    // 2. Background revalidation every 10s (down from 3s) — real-time socket handles instant updates
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 10000);

    // Listen for real-time events via singleton RealtimeService
    const handleRealtimeOrders = (data) => {
      if (data && data.order) {
        setOrders(prev => {
          if (data.order.status === 'Paid' || data.order.status === 'Cancelled' || data.order.status === 'Deleted') {
            return prev.filter(o => o._id !== data.order._id && o.tableNo !== data.order.tableNo);
          }
          const idx = prev.findIndex(o => o._id === data.order._id || o.tableNo === data.order.tableNo);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = data.order;
            return copy;
          }
          return [data.order, ...prev];
        });
      }
      fetchOrders(true);
    };

    const unsubOrderUpdated = realtimeService.subscribe('orderUpdated', handleRealtimeOrders);
    const unsubOrdersUpdated = realtimeService.subscribe('ordersUpdated', handleRealtimeOrders);
    const unsubBillSettled = realtimeService.subscribe('billSettled', handleRealtimeOrders);
    const unsubTableStatusChanged = realtimeService.subscribe('tableStatusChanged', handleRealtimeOrders);
    const unsubTableTransferred = realtimeService.subscribe('tableTransferred', handleRealtimeOrders);
    const unsubNewKOT = realtimeService.subscribe('newKOT', handleRealtimeOrders);
    const unsubKotUpdated = realtimeService.subscribe('kotUpdated', handleRealtimeOrders);
    const unsubFoodReady = realtimeService.subscribe('foodReady', handleRealtimeOrders);

    return () => {
      clearInterval(interval);
      unsubOrderUpdated();
      unsubOrdersUpdated();
      unsubBillSettled();
      unsubTableStatusChanged();
      unsubTableTransferred();
      unsubNewKOT();
      unsubKotUpdated();
      unsubFoodReady();
    };
  }, []);

  const fetchOrders = async (isBackground = false) => {
    if (!isBackground && orders.length === 0) {
      setLoading(true);
    }
    try {
      const data = await getOpenOrders();
      const validOpen = (data || []).filter(o => o.status === 'Open' || o.status === 'Billed');
      setOrders(validOpen);
    } catch (error) {
      console.error('Error fetching open orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 sm:p-6 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/20 rounded-lg animate-pulse"></div>
          <div className="h-6 bg-text-muted/20 rounded w-32 animate-pulse"></div>
          <div className="px-3 py-1 bg-primary/20 rounded-full animate-pulse">
            <div className="w-8 h-4 bg-primary/40 rounded"></div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {[...Array(8)].map((_, i) =>
          <div key={i} className="bg-surface rounded-2xl border border-border/50 shadow-sm animate-pulse">
              <div className="p-4 sm:p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="w-16 h-5 bg-text-muted/20 rounded mb-1"></div>
                    <div className="w-20 h-3 bg-text-muted/20 rounded"></div>
                  </div>
                  <div className="w-12 h-5 bg-text-muted/20 rounded"></div>
                </div>
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between">
                    <div className="w-8 h-3 bg-text-muted/20 rounded"></div>
                    <div className="w-6 h-3 bg-text-muted/20 rounded"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-12 h-3 bg-text-muted/20 rounded"></div>
                    <div className="w-10 h-3 bg-text-muted/20 rounded"></div>
                  </div>
                </div>
                <div className="w-full h-10 bg-primary/20 rounded-xl"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>);


  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-2 sm:p-3 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {(onGoBack || onNavigate) &&
            <BackButton onClick={onGoBack || (() => onNavigate('dashboard'))} />
            }
            <h2 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2 sm:gap-3">
              <UtensilsCrossed className="text-primary" size={20} />{t("Active Orders")}

              <span className="bg-primary/10 text-primary text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-mono">
                {orders.length}
              </span>
            </h2>
          </div>
          <div className="flex bg-surface p-1 rounded-lg border border-border self-start sm:self-auto">
            {['All', 'Dine-In', 'Online'].map((type) =>
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all ${filterType === type ?
              'bg-primary text-white shadow-sm' :
              'text-text-muted hover:text-text-main hover:bg-surface-hover'}`
              }>
              
                {t(type)}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 sm:p-2.5 md:p-3">
        {orders.filter((o) => {
            if (!o) return false;
            if (filterType === 'All') return true;
            if (filterType === 'Dine-In') return o.orderSource === 'Dine-In' || o.billType === 'Dine-In';
            if (filterType === 'Online') return ['Zomato', 'Swiggy', 'Talabat'].includes(o.orderSource);
            return true;
          }).length === 0 ?
        <div className="h-full flex flex-col items-center justify-center py-20 px-4">
            <div className="flex flex-col items-center gap-4 text-center max-w-xs mx-auto">
              {/* Icon bubble */}
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center shadow-inner">
                <UtensilsCrossed size={44} className="text-primary opacity-70" />
              </div>
              {/* Title */}
              <h2 className="text-xl sm:text-2xl font-black text-text-main">
                {t("No Active Orders")}
              </h2>
              {/* Subtitle */}
              <p className="text-sm text-text-muted leading-relaxed">
                {filterType === 'All'
                  ? t("There are no current active orders. New orders will appear here automatically.")
                  : `${t("No active")} ${t(filterType)} ${t("orders at the moment.")}`}
              </p>
              {/* Refresh hint */}
              <button
                onClick={fetchOrders}
                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl text-sm transition-all">
                <Clock size={16} />
                {t("Check Again")}
              </button>
            </div>
          </div> :

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {orders.filter((o) => {
            if (!o) return false;
            if (filterType === 'All') return true;
            if (filterType === 'Dine-In') return o.orderSource === 'Dine-In' || o.billType === 'Dine-In';
            if (filterType === 'Online') return ['Zomato', 'Swiggy', 'Talabat'].includes(o.orderSource);
            return true;
          }).map((order) => {
            if (!order) return null;
            const isOnline = ['Zomato', 'Swiggy', 'Talabat'].includes(order.orderSource);
            const getBorderColor = () => {
              if (order.orderSource === 'Zomato') return 'border-red-500/50 shadow-red-500/10';
              if (order.orderSource === 'Swiggy') return 'border-orange-500/50 shadow-orange-500/10';
              return 'border-border/50';
            };

            return (
              <div
                key={order._id}
                onClick={() => onSelectOrder(order.tableNo)}
                className={`bg-surface rounded-2xl border ${getBorderColor()} shadow-sm hover:shadow-md transition-all overflow-hidden group relative cursor-pointer`}>
                
                  {isOnline &&
                <div className={`absolute top-0 right-0 left-0 h-1.5 ${order.orderSource === 'Zomato' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                }
                  <div className="p-4 sm:p-5 pt-5 sm:pt-6">
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                      <div className="flex-1 min-w-0 mr-2">
                        <h3 className="text-base sm:text-lg font-bold text-text-main flex items-center gap-2 truncate">
                          <span className="truncate">{order.tableNo}</span>
                          {isOnline &&
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded shrink-0 ${order.orderSource === 'Zomato' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                              {order.orderSource}
                            </span>
                        }
                        </h3>
                        <p className="text-xs text-text-muted font-mono mt-1">
                          {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                      <span className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${order.status === 'Open' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`
                    }>
                        {t(order.status || 'Open')}
                      </span>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">{t("Items")}</span>
                        <span className="font-bold text-text-main">{order.items?.filter(i => !i.isCancelled).length || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">{t("Total")}</span>
                        <span className="font-bold text-primary">₹{(order.total || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <button
                    onClick={() => onSelectOrder(order.tableNo)}
                    className="w-full py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all bg-primary/5 text-primary hover:bg-primary hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20">
                    
                      {order.status === 'Open' ?
                    <>
                          <FileText size={14} />{t("MAKE BILL")}

                    </> :

                    <>
                          <CheckCircle size={14} />{t("SETTLE BILL")}

                    </>
                    }
                      <ChevronRight size={14} className="opacity-50" />
                    </button>
                  </div>
                </div>);

          })}
          </div>
        }
      </div>
    </div>);

};

export default ActiveOrders;