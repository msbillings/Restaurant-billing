import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import { getOpenOrders } from '../api/billing';
import { getCachedOpenOrders } from '../db/offlineDb';
import { UtensilsCrossed, Clock, ChevronRight, FileText, CheckCircle, ShoppingBag, Truck, Utensils } from 'lucide-react';
import realtimeService from '../services/realtimeService';

const getOrderCategory = (order) => {
  if (!order) return 'Dine-In';
  const billType = (order.billType || '').toLowerCase();
  const source = (order.orderSource || '').toLowerCase();
  const table = (order.tableNo || '').toUpperCase();

  if (billType === 'takeaway' || billType === 'pickup' || source === 'takeaway' || source === 'pickup' || table.startsWith('TAK')) {
    return 'Takeaway';
  }
  if (billType === 'delivery' || source === 'delivery' || source === 'zomato' || source === 'swiggy' || source === 'talabat' || table.startsWith('DEL')) {
    return 'Delivery';
  }
  return 'Dine-In';
};

const CATEGORY_STYLES = {
  'Dine-In': {
    cardBg: 'bg-amber-50/75 border-amber-200/90 hover:border-amber-400 hover:bg-amber-100/60 shadow-amber-500/5',
    topBar: 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500',
    badge: 'bg-amber-100 text-amber-900 border border-amber-300/80 font-bold',
    button: 'bg-amber-600/10 text-amber-900 hover:bg-amber-600 hover:text-white',
    icon: Utensils,
    label: 'Dine-In'
  },
  'Takeaway': {
    cardBg: 'bg-emerald-50/75 border-emerald-200/90 hover:border-emerald-400 hover:bg-emerald-100/60 shadow-emerald-500/5',
    topBar: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400',
    badge: 'bg-emerald-100 text-emerald-900 border border-emerald-300/80 font-bold',
    button: 'bg-emerald-600/10 text-emerald-900 hover:bg-emerald-600 hover:text-white',
    icon: ShoppingBag,
    label: 'Takeaway'
  },
  'Delivery': {
    cardBg: 'bg-sky-50/75 border-sky-200/90 hover:border-sky-400 hover:bg-sky-100/60 shadow-sky-500/5',
    topBar: 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500',
    badge: 'bg-sky-100 text-sky-900 border border-sky-300/80 font-bold',
    button: 'bg-sky-600/10 text-sky-900 hover:bg-sky-600 hover:text-white',
    icon: Truck,
    label: 'Delivery'
  }
};

const formatOrderDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dateFormatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dateFormatted}, ${timeFormatted}`;
};

const ActiveOrders = ({ onSelectOrder, onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All'); // 'All', 'Dine-In', 'Takeaway', 'Delivery'

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


  const filteredOrders = orders.filter((o) => {
    if (!o) return false;
    if (filterType === 'All') return true;
    return getOrderCategory(o) === filterType;
  });

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-2 sm:p-3 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {(onGoBack || onNavigate) &&
            <BackButton onClick={onGoBack || (() => onNavigate('dashboard'))} />
            }
            <h2 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2 sm:gap-3 shrink-0">
              <UtensilsCrossed className="text-primary" size={20} />{t("Active Orders")}

              <span className="bg-primary/10 text-primary text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-mono font-bold">
                {orders.length}
              </span>
            </h2>

            {/* Inline Color Legend Bar (Same Row as Active Orders) */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-1 sm:ml-2 flex-wrap text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/90 text-amber-900 border border-amber-300/80 shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-2xs"></span>
                {t("Dine-In")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/90 text-emerald-900 border border-emerald-300/80 shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs"></span>
                {t("Takeaway")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100/90 text-sky-900 border border-sky-300/80 shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-2xs"></span>
                {t("Delivery")}
              </span>
            </div>
          </div>

          <div className="flex bg-surface p-1 rounded-lg border border-border self-start lg:self-auto gap-1">
            {['All', 'Dine-In', 'Takeaway', 'Delivery'].map((type) =>
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

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
        {filteredOrders.length === 0 ?
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
            {filteredOrders.map((order) => {
            if (!order) return null;
            const category = getOrderCategory(order);
            const style = CATEGORY_STYLES[category] || CATEGORY_STYLES['Dine-In'];
            const CategoryIcon = style.icon;

            return (
              <div
                key={order._id}
                onClick={() => onSelectOrder(order.tableNo)}
                className={`rounded-2xl border ${style.cardBg} shadow-sm hover:shadow-md transition-all overflow-hidden group relative cursor-pointer flex flex-col justify-between`}>
                
                {/* Top Colored Category Indicator Line */}
                <div className={`h-2 ${style.topBar} w-full`}></div>

                <div className="p-4 sm:p-5">
                  {/* Category Badge & Table Title */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${style.badge}`}>
                          <CategoryIcon size={11} />
                          {t(style.label)}
                        </span>
                        {order.orderSource && !['Dine-In', 'Takeaway', 'Delivery'].includes(order.orderSource) && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-200/80 text-gray-800 border border-gray-300">
                            {order.orderSource}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-text-main leading-tight truncate">
                        {order.tableNo}
                      </h3>
                      <p className="text-[11px] text-text-muted font-mono font-medium mt-1 flex items-center gap-1 truncate">
                        <Clock size={11} className="shrink-0 opacity-70" />
                        <span>{formatOrderDateTime(order.createdAt)}</span>
                      </p>
                    </div>
                    <span className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs ${order.status === 'Open' ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'}`}>
                      {t(order.status || 'Open')}
                    </span>
                  </div>

                  {/* Item Count & Total */}
                  <div className="space-y-1.5 sm:space-y-2 my-4 bg-white/70 backdrop-blur-xs p-3 rounded-xl border border-black/5 shadow-2xs">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-text-muted font-medium">{t("Items")}</span>
                      <span className="font-bold text-text-main">{order.items?.filter(i => !i.isCancelled).length || 0}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm pt-1 border-t border-gray-200/50">
                      <span className="text-text-muted font-medium">{t("Total")}</span>
                      <span className="font-black text-primary text-sm sm:text-base">₹{(order.total || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => onSelectOrder(order.tableNo)}
                    className={`w-full py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${style.button} shadow-2xs group-hover:shadow-md`}>
                    {order.status === 'Open' ? (
                      <>
                        <FileText size={15} />
                        <span>{t("MAKE BILL")}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={15} />
                        <span>{t("SETTLE BILL")}</span>
                      </>
                    )}
                    <ChevronRight size={14} className="opacity-60" />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        }
      </div>
    </div>);

};

export default ActiveOrders;