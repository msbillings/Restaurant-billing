import React, { useState, useEffect } from 'react';
import { getOpenOrders } from '../api/billing';
import { UtensilsCrossed, Clock, ChevronRight, FileText, CheckCircle } from 'lucide-react';
import { io } from 'socket.io-client';

const ActiveOrders = ({ onSelectOrder }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All'); // 'All', 'Dine-In', 'Online'

  useEffect(() => {
    fetchOrders();

    // Set up Real-Time WebSocket connection
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
    const socketUrl = API_BASE_URL.replace('/api', '');
    const socket = io(socketUrl);

    socket.on('connect', () => {
      const tenantDb = localStorage.getItem('resto_db_name');
      const token = localStorage.getItem('accessToken');
      if (tenantDb) {
        socket.emit('joinTenant', { tenantDb, token });
      }
    });

    // Listen for real-time events that affect active orders
    socket.on('orderUpdated', fetchOrders);
    socket.on('billSettled', fetchOrders);
    socket.on('tableStatusChanged', fetchOrders);
    socket.on('newKOT', fetchOrders);

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await getOpenOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching open orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/20 rounded-lg animate-pulse"></div>
          <div className="h-6 bg-text-muted/20 rounded w-32 animate-pulse"></div>
          <div className="px-3 py-1 bg-primary/20 rounded-full animate-pulse">
            <div className="w-8 h-4 bg-primary/40 rounded"></div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border/50 shadow-sm animate-pulse">
              <div className="p-5">
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
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-text-main flex items-center gap-3">
            <UtensilsCrossed className="text-primary" />
            Active Orders
            <span className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-mono">
              {orders.length}
            </span>
          </h2>
          <div className="flex bg-surface p-1 rounded-lg border border-border">
            {['All', 'Dine-In', 'Online'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${filterType === type
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-60">
            <UtensilsCrossed size={64} className="mb-4" />
            <p className="text-xl font-medium">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orders.filter(o => {
              if (filterType === 'All') return true;
              if (filterType === 'Dine-In') return o.orderSource === 'Dine-In' || o.billType === 'Dine-In';
              if (filterType === 'Online') return ['Zomato', 'Swiggy', 'Talabat'].includes(o.orderSource);
              return true;
            }).map(order => {
              const isOnline = ['Zomato', 'Swiggy', 'Talabat'].includes(order.orderSource);
              const getBorderColor = () => {
                if (order.orderSource === 'Zomato') return 'border-red-500/50 shadow-red-500/10';
                if (order.orderSource === 'Swiggy') return 'border-orange-500/50 shadow-orange-500/10';
                return 'border-border/50';
              };

              return (
                <div
                  key={order._id}
                  className={`bg-surface rounded-2xl border ${getBorderColor()} shadow-sm hover:shadow-md transition-all overflow-hidden group relative`}
                >
                  {isOnline && (
                    <div className={`absolute top-0 right-0 left-0 h-1.5 ${order.orderSource === 'Zomato' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                  )}
                  <div className="p-5 pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                          {order.tableNo}
                          {isOnline && (
                            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${order.orderSource === 'Zomato' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                              {order.orderSource}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-text-muted font-mono mt-1">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${order.status === 'Open' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Items</span>
                        <span className="font-bold text-text-main">{order.items.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Total</span>
                        <span className="font-bold text-primary">₹{order.total.toLocaleString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectOrder(order.tableNo)}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-primary/5 text-primary hover:bg-primary hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20"
                    >
                      {order.status === 'Open' ? (
                        <>
                          <FileText size={16} />
                          MAKE BILL
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          SETTLE BILL
                        </>
                      )}
                      <ChevronRight size={16} className="opacity-50" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveOrders;
