import React, { useState, useEffect } from 'react';
import { ChefHat, CheckCircle, Clock } from 'lucide-react';
import { io } from 'socket.io-client';

const KDS = () => {
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchKOTs = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
      const response = await fetch(`${API_BASE_URL}/bills/kots/active`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setKots(data);
      }
    } catch (error) {
      console.error('Error fetching KDS KOTs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKOTs();

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

    socket.on('newKOT', fetchKOTs);
    socket.on('kotUpdated', fetchKOTs);
    socket.on('orderUpdated', fetchKOTs);

    return () => {
      socket.disconnect();
    };
  }, []);

  const updateItemStatus = async (orderId, kotId, itemId, newStatus) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
      await fetch(`${API_BASE_URL}/bills/kot/item/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        },
        body: JSON.stringify({ orderId, kotId, itemId, status: newStatus })
      });
      fetchKOTs();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading KDS...</div>;

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2 shrink-0">
        <h1 className="text-2xl font-black text-amber-500 flex items-center gap-2">
          <ChefHat /> KITCHEN DISPLAY SYSTEM
        </h1>
        <div className="text-slate-400 font-mono text-sm">
          {new Date().toLocaleTimeString()}
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 h-full">
          {kots.length === 0 ? (
            <div className="w-full flex items-center justify-center text-slate-500 font-bold text-xl">
              No Active Tickets
            </div>
          ) : (
            kots.map(kot => {
              const pendingItems = kot.items.filter(i => i.status === 'Pending' || i.status === 'Preparing');
              if (pendingItems.length === 0) return null; // Skip if all items ready

              const minutesOld = Math.floor((new Date() - new Date(kot.createdAt)) / 60000);
              let cardColor = 'bg-slate-800 border-slate-700';
              if (minutesOld > 15) cardColor = 'bg-red-950/50 border-red-800';
              else if (minutesOld > 10) cardColor = 'bg-amber-950/50 border-amber-800';

              return (
                <div key={kot.kotId} className={`w-80 shrink-0 rounded-xl border-2 flex flex-col overflow-hidden ${cardColor}`}>
                  <div className="bg-slate-950/50 p-3 flex justify-between items-center border-b border-inherit">
                    <div>
                      <h3 className="font-bold text-lg text-white">{kot.tableNo}</h3>
                      <p className="text-xs text-slate-400">{kot.kotNumber} • {kot.billType}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-mono font-bold text-slate-300">
                      <Clock size={16} /> {minutesOld}m
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {pendingItems.map(item => (
                      <div key={item._id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-base text-white">{item.quantity} x {item.name}</p>
                          <p className="text-xs text-amber-500 uppercase tracking-widest">{item.status}</p>
                        </div>
                        <button 
                          onClick={() => updateItemStatus(kot.orderId, kot.kotId, item._id, item.status === 'Pending' ? 'Preparing' : 'Ready')}
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                            item.status === 'Pending' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {item.status === 'Pending' ? <ChefHat size={20} /> : <CheckCircle size={20} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default KDS;
