import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { ChefHat, CheckCircle, Clock } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import BackButton from './common/BackButton';

const KDS = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchKOTs = async () => {
    try {
      const response = await api.get('/bills/kots/active');
      setKots(response.data || []);
    } catch (error) {
      console.error('Error fetching KDS KOTs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKOTs();

    const API_BASE_URL = getApiUrl();
    const socketUrl = API_BASE_URL.replace('/api', '');
    const socket = io(socketUrl);

    socket.on('connect', () => {
      const tenantDb = localStorage.getItem('resto_db_name');
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
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
      await api.post('/bills/kot/item/status', {
        orderId,
        kotId,
        itemId,
        status: newStatus
      });
      fetchKOTs();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const groupedKOTs = React.useMemo(() => {
    const groups = {};
    kots.forEach(kot => {
      const groupId = kot.tableNo;
      if (!groups[groupId]) {
        groups[groupId] = {
          tableNo: kot.tableNo,
          billType: kot.billType,
          createdAt: kot.createdAt, // Track oldest KOT time
          items: []
        };
      }
      
      // Update oldest time for the card color
      if (new Date(kot.createdAt) < new Date(groups[groupId].createdAt)) {
        groups[groupId].createdAt = kot.createdAt;
      }

      // Add pending/preparing items with their specific time
      kot.items.forEach(item => {
        if (item.status === 'Pending' || item.status === 'Preparing') {
          groups[groupId].items.push({
            ...item,
            kotId: kot.kotId,
            kotNumber: kot.kotNumber,
            originalOrderId: kot.orderId,
            itemCreatedAt: kot.createdAt
          });
        }
      });
    });

    // Sort items: Preparing first, then Pending. Then by oldest time.
    Object.values(groups).forEach(g => {
      g.items.sort((a, b) => {
        if (a.status === 'Preparing' && b.status !== 'Preparing') return -1;
        if (b.status === 'Preparing' && a.status !== 'Preparing') return 1;
        return new Date(a.itemCreatedAt) - new Date(b.itemCreatedAt);
      });
    });

    return Object.values(groups).filter(g => g.items.length > 0);
  }, [kots]);

  if (loading) return <div className="p-8 text-center">{t("Loading KDS...")}</div>;

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <h1 className="text-2xl font-black text-amber-500 flex items-center gap-2">
            <ChefHat />{t("KITCHEN DISPLAY SYSTEM")}
          </h1>
        </div>
        <div className="text-slate-400 font-mono text-sm">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 h-full">
          {groupedKOTs.length === 0 ? (
            <div className="w-full flex items-center justify-center text-slate-500 font-bold text-xl">
              {t("No Active Tickets")}
            </div>
          ) : (
            groupedKOTs.map((group) => {
              const tableMinutesOld = Math.floor((new Date() - new Date(group.createdAt)) / 60000);
              let cardColor = 'bg-slate-800 border-slate-700';
              if (tableMinutesOld > 15) cardColor = 'bg-red-950/50 border-red-800';
              else if (tableMinutesOld > 10) cardColor = 'bg-amber-950/50 border-amber-800';

              return (
                <div key={group.tableNo} className={`w-80 shrink-0 rounded-xl border-2 flex flex-col overflow-hidden ${cardColor}`}>
                  <div className="bg-slate-950/50 p-3 flex justify-between items-center border-b border-inherit">
                    <div>
                      <h3 className="font-bold text-lg text-white">{group.tableNo}</h3>
                      <p className="text-xs text-slate-400">{t(group.billType)}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {group.items.map((item) => {
                      const itemMinutesOld = Math.floor((new Date() - new Date(item.itemCreatedAt)) / 60000);
                      return (
                        <div key={`${item.kotId}-${item._id}`} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-base text-white">{item.quantity} x {item.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                                <Clock size={10} /> {itemMinutesOld}{t("m")}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">{item.kotNumber}</span>
                              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{t(item.status)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => updateItemStatus(item.originalOrderId, item.kotId, item._id, item.status === 'Pending' ? 'Preparing' : 'Ready')}
                            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ml-2 ${item.status === 'Pending' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                          >
                            {item.status === 'Pending' ? <ChefHat size={18} /> : <CheckCircle size={18} />}
                          </button>
                        </div>
                      );
                    })}
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