import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChefHat, CheckCircle, Clock, Timer, Ban } from 'lucide-react';
import api from '../api/axios';
import BackButton from './common/BackButton';
import Toast from './Toast';
import { getCachedKdsActiveKots, cacheKdsActiveKots, removeCachedKotItem } from '../db/offlineDb';
import realtimeService from '../services/realtimeService';

const KDS = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customPrepInputs, setCustomPrepInputs] = useState({});
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getPrepCountdown = (item) => {
    if (!item.prepTimeMinutes) return null;
    const startMs = item.prepStartTime ? new Date(item.prepStartTime).getTime() : now;
    const totalMs = item.prepTimeMinutes * 60 * 1000;
    const elapsedMs = now - startMs;
    const remainingMs = totalMs - elapsedMs;

    if (remainingMs <= 0) {
      const overdueMins = Math.abs(Math.floor(remainingMs / 60000));
      return { remainingMins: 0, remainingSecs: 0, overdueMins, isOverdue: true, percent: 100 };
    }

    const remainingMins = Math.floor(remainingMs / 60000);
    const remainingSecs = Math.floor((remainingMs % 60000) / 1000);
    const percent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
    return { remainingMins, remainingSecs, overdueMins: 0, isOverdue: false, percent };
  };

  const fetchKOTs = useCallback(async () => {
    if (fetchingRef.current) return; // Prevent concurrent fetches
    fetchingRef.current = true;
    try {
      const response = await api.get('/bills/kots/active');
      const data = response.data || [];
      setKots(data);
      // Cache in isolated KDS store for instant load next time
      cacheKdsActiveKots(data).catch(() => {});
    } catch (error) {
      console.error('Error fetching KDS KOTs:', error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // 1. INSTANT 0ms cache load from isolated KDS store
    getCachedKdsActiveKots().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        const activeCached = cached.filter(kot =>
          (kot.items || []).some(i => (i.status === 'Pending' || i.status === 'Preparing') && !i.isCancelled)
        );
        if (activeCached.length > 0) {
          setKots(activeCached);
        }
      }
      setLoading(false);
    }).catch(() => { setLoading(false); });


    // 2. Background network fetch to confirm freshness
    fetchKOTs();

    // 3. 3-Second real-time auto-polling for guaranteed freshness
    const pollTimer = setInterval(() => {
      fetchKOTs();
    }, 3000);

    // 4. Connect to singleton RealtimeService
    const handleNewKOT = (data) => {
      if (data && data.kot) {
        const targetKotId = String(data.kot._id || data.kot.kotId || '');
        setKots(prev => {
          if (targetKotId) {
            const exists = prev.some(k => String(k.kotId || k._id || '') === targetKotId);
            if (exists) return prev;
          }
          const newEntry = {
            kotId: data.kot._id || data.kot.kotId,
            kotNumber: data.kot.kotNumber,
            tableNo: data.tableNo || data.kot.tableNo,
            billType: data.billType || data.kot.billType || 'Dine-In',
            orderId: data.orderId || data.kot.orderId,
            createdAt: data.kot.createdAt || new Date().toISOString(),
            items: (data.kot.items || []).map(i => ({ ...i, status: i.status || 'Pending' }))
          };
          return [...prev, newEntry];
        });
      }
      fetchKOTs();
    };

    const handleKotUpdated = (data) => {
      if (data && (data.itemId || data.itemName) && data.status) {
        setKots(prev => prev.map(kot => {
          if (
            (data.kotId && kot.kotId?.toString() === data.kotId?.toString()) ||
            (data.orderId && kot.orderId?.toString() === data.orderId?.toString()) ||
            (data.tableNo && kot.tableNo === data.tableNo)
          ) {
            return {
              ...kot,
              items: (kot.items || []).map(item => {
                if (
                  (data.itemId && item._id?.toString() === data.itemId?.toString()) ||
                  (data.itemName && item.name === data.itemName)
                ) {
                  return { ...item, status: data.status };
                }
                return item;
              })
            };
          }
          return kot;
        }));
      }
      fetchKOTs();
    };

    const unsubNewKOT = realtimeService.subscribe('newKOT', handleNewKOT);
    const unsubKotUpdated = realtimeService.subscribe('kotUpdated', handleKotUpdated);
    const unsubOrderUpdated = realtimeService.subscribe('orderUpdated', fetchKOTs);

    return () => {
      clearInterval(pollTimer);
      unsubNewKOT();
      unsubKotUpdated();
      unsubOrderUpdated();
    };
  }, [fetchKOTs]);

  const updateItemStatus = async (orderId, kotId, itemId, newStatus, itemName = '', tableNo = '') => {
    // 1. Instant 0ms Local State Update
    setKots((prevKots) =>
      prevKots.map((kot) => {
        if (kot.kotId?.toString() === kotId?.toString() || kot.orderId?.toString() === orderId?.toString()) {
          const updatedItems = (kot.items || []).map((item) => {
            if (item._id?.toString() === itemId?.toString() || item.name === itemId) {
              return { ...item, status: newStatus };
            }
            return item;
          });
          return { ...kot, items: updatedItems };
        }
        return kot;
      })
    );

    // 2. If marked as Ready: auto-remove after 1.5 seconds and conditionally show prepared toast
    if (newStatus === 'Ready') {
      const notifPermission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      const hasActiveNotifications = notifPermission === 'granted' && localStorage.getItem('realtime_notifications');

      // Only show popup toast if no push notification system is active/handled
      if (!hasActiveNotifications || notifPermission !== 'granted') {
        const displayName = itemName || 'Item';
        const displayTable = tableNo ? ` for ${tableNo}` : '';
        setToast({ message: `✅ ${displayName}${displayTable} is prepared & ready!`, type: 'success' });
      }

      setTimeout(() => {
        setKots((prevKots) =>
          prevKots.map((kot) => {
            if (kot.kotId?.toString() === kotId?.toString() || kot.orderId?.toString() === orderId?.toString()) {
              const remaining = (kot.items || []).filter(item =>
                item._id?.toString() !== itemId?.toString() && item.name !== itemId
              );
              return { ...kot, items: remaining };
            }
            return kot;
          }).filter(kot => (kot.items || []).some(i => (i.status === 'Pending' || i.status === 'Preparing') && !i.isCancelled))
        );
        removeCachedKotItem(kotId, itemId).catch(() => {});
      }, 1500);
    }

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
      fetchKOTs();
    }
  };

  const updateItemPrepTime = async (orderId, kotId, itemId, prepTimeMinutes, itemName) => {
    try {
      await api.post('/bills/kot/item/prep-time', {
        orderId,
        kotId,
        itemId,
        prepTimeMinutes: Number(prepTimeMinutes),
        itemName
      });
      fetchKOTs();
    } catch (error) {
      console.error('Error setting prep time:', error);
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
          createdAt: kot.createdAt,
          items: []
        };
      }

      if (new Date(kot.createdAt) < new Date(groups[groupId].createdAt)) {
        groups[groupId].createdAt = kot.createdAt;
      }

      kot.items.forEach(item => {
        const isCancelled = item.status === 'Cancelled' || item.isCancelled === true;
        groups[groupId].items.push({
          ...item,
          isCancelled,
          kotId: kot.kotId,
          kotNumber: kot.kotNumber,
          originalOrderId: kot.orderId,
          itemCreatedAt: kot.createdAt
        });
      });
    });

    Object.values(groups).forEach(g => {
      g.items.sort((a, b) => {
        if (!a.isCancelled && b.isCancelled) return -1;
        if (a.isCancelled && !b.isCancelled) return 1;
        if (a.status === 'Preparing' && b.status !== 'Preparing') return -1;
        if (b.status === 'Preparing' && a.status !== 'Preparing') return 1;
        return new Date(a.itemCreatedAt) - new Date(b.itemCreatedAt);
      });
    });

    // Only render table cards with active items needing kitchen preparation
    return Object.values(groups).filter(g =>
      g.items.some(item => (item.status === 'Pending' || item.status === 'Preparing') && !item.isCancelled)
    );
  }, [kots]);

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-amber-500 font-bold p-8">
      <ChefHat className="animate-bounce mb-3" size={40} />
      <span>{t("Loading KDS...")}</span>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 p-3 sm:p-4 overflow-hidden w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 border-b border-slate-800 pb-3 gap-2.5 sm:gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <h1 className="text-xl sm:text-2xl font-black text-amber-500 flex items-center gap-2 tracking-tight">
            <ChefHat className="text-amber-500 shrink-0" size={24} />
            <span>{t("KITCHEN DISPLAY SYSTEM")}</span>
          </h1>
        </div>
        <div className="text-slate-400 font-mono text-xs sm:text-sm bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl self-end sm:self-auto font-bold">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory scroll-smooth custom-scrollbar">
        <div className="flex gap-3.5 sm:gap-4 h-full">
          {groupedKOTs.length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center text-slate-500 font-bold text-lg sm:text-xl p-8">
              <ChefHat size={48} className="mb-3 opacity-30 text-amber-500" />
              <span>{t("No Active Tickets")}</span>
            </div>
          ) : (
            groupedKOTs.map((group) => {
              const tableMinutesOld = Math.floor((new Date() - new Date(group.createdAt)) / 60000);
              let cardColor = 'bg-slate-900 border-slate-800';
              if (tableMinutesOld > 15) cardColor = 'bg-red-950/40 border-red-900/60';
              else if (tableMinutesOld > 10) cardColor = 'bg-amber-950/40 border-amber-900/60';

              return (
                <div key={group.tableNo} className={`w-[88vw] sm:w-80 md:w-88 shrink-0 rounded-2xl border-2 flex flex-col overflow-hidden shadow-2xl snap-center ${cardColor}`}>
                  <div className="bg-slate-900/90 p-3 flex justify-between items-center border-b border-inherit backdrop-blur-md">
                    <div>
                      <h3 className="font-bold text-base sm:text-lg text-white tracking-wide">{group.tableNo}</h3>
                      <p className="text-xs text-slate-400 font-medium">{t(group.billType)}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-400 bg-slate-950/80 px-2 py-1 rounded-md border border-slate-800 flex items-center gap-1">
                      <Clock size={12} /> {tableMinutesOld}m
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {group.items.map((item) => {
                      const itemMinutesOld = Math.floor((new Date() - new Date(item.itemCreatedAt)) / 60000);
                      const isCancelled = item.isCancelled || item.status === 'Cancelled';
                      const prepKey = `${item.kotId}-${item._id}`;

                      return (
                        <div
                          key={prepKey}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                            isCancelled
                              ? 'bg-red-950/30 border-red-800/50 text-red-300 opacity-75'
                              : item.status === 'Preparing'
                              ? 'bg-amber-950/30 border-amber-500/60 text-amber-100 shadow-md'
                              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className={`font-black text-sm sm:text-base leading-snug ${isCancelled ? 'line-through text-red-400' : 'text-white'}`}>
                                {isCancelled ? 0 : Math.max(0, (item.quantity || 0) - (item.cancelledQuantity || 0))}x {item.name}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                                  <Clock size={10} /> {itemMinutesOld}{t("m")}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">{item.kotNumber}</span>
                                {isCancelled ? (
                                  <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/40 uppercase tracking-wider flex items-center gap-1">
                                    <Ban size={10} /> {t("Cancelled")}
                                  </span>
                                ) : (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                    item.status === 'Preparing'
                                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                      : item.status === 'Ready'
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}>
                                    {t(item.status)}
                                  </span>
                                )}
                              </div>
                              {item.specialNote && (
                                <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-start gap-1.5 text-amber-300 text-xs font-bold">
                                  <span className="shrink-0 text-amber-400">📝</span>
                                  <span className="break-words leading-tight">{item.specialNote}</span>
                                </div>
                              )}
                            </div>

                            {!isCancelled && (
                              <button
                                onClick={() => updateItemStatus(item.originalOrderId, item.kotId, item._id, item.status === 'Pending' ? 'Preparing' : 'Ready', item.name, group.tableNo)}
                                className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-lg touch-target ${
                                  item.status === 'Pending'
                                    ? 'bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white border border-slate-700'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                                }`}
                                title={t(item.status === 'Pending' ? 'Start Preparing' : 'Mark Ready')}
                              >
                                {item.status === 'Pending' ? <ChefHat size={20} /> : <CheckCircle size={20} />}
                              </button>
                            )}
                          </div>

                          {!isCancelled && (
                            <div className="pt-2 border-t border-slate-800/80 mt-1 flex flex-col gap-1.5">
                              {(() => {
                                const cd = getPrepCountdown(item);
                                return (
                                  <>
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                                        <Timer size={12} /> {t("Prep Time")}:
                                      </span>
                                      {cd ? (
                                        <span className={`font-bold text-xs px-2 py-0.5 rounded border flex items-center gap-1 ${
                                          cd.isOverdue
                                            ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                        }`}>
                                          ⏱️ {item.prepTimeMinutes}m • {cd.isOverdue ? `Overdue ${cd.overdueMins}m` : `${cd.remainingMins}m ${cd.remainingSecs}s left`}
                                        </span>
                                      ) : (
                                        <span className="text-slate-500 text-[10px]">{t("Not set")}</span>
                                      )}
                                    </div>

                                    {cd && (
                                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                        <div
                                          className={`h-full transition-all duration-1000 ${cd.isOverdue ? 'bg-red-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}
                                          style={{ width: `${cd.percent}%` }}
                                        />
                                      </div>
                                    )}
                                  </>
                                );
                              })()}

                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {[5, 10, 15, 20].map(mins => {
                                  const isSelected = Number(item.prepTimeMinutes) === mins;
                                  return (
                                    <button
                                      key={mins}
                                      onClick={() => updateItemPrepTime(item.originalOrderId, item.kotId, item._id, mins, item.name)}
                                      className={`px-2.5 py-1.5 text-[11px] sm:text-xs font-black rounded-lg border transition-all touch-target ${
                                        isSelected
                                          ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-lg shadow-amber-500/50 scale-105 ring-2 ring-amber-400'
                                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                                      }`}
                                    >
                                      {mins}m
                                    </button>
                                  );
                                })}
                                <div className="flex items-center gap-1 ml-auto">
                                  {(() => {
                                    const isCustomSelected = item.prepTimeMinutes > 0 && ![5, 10, 15, 20].includes(Number(item.prepTimeMinutes));
                                    return (
                                      <>
                                        <input
                                          type="number"
                                          placeholder={isCustomSelected ? item.prepTimeMinutes : "13"}
                                          value={customPrepInputs[prepKey] || ''}
                                          onChange={(e) => setCustomPrepInputs({ ...customPrepInputs, [prepKey]: e.target.value })}
                                          className={`w-12 px-1.5 py-1 text-[11px] border rounded-lg font-mono text-center focus:outline-none ${
                                            isCustomSelected
                                              ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black ring-2 ring-amber-400'
                                              : 'bg-slate-950 text-amber-300 border-slate-700 focus:border-amber-500'
                                          }`}
                                        />
                                        <button
                                          onClick={() => {
                                            const val = parseInt(customPrepInputs[prepKey]);
                                            if (val && val > 0) {
                                              updateItemPrepTime(item.originalOrderId, item.kotId, item._id, val, item.name);
                                              setCustomPrepInputs({ ...customPrepInputs, [prepKey]: '' });
                                            }
                                          }}
                                          className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all touch-target ${
                                            isCustomSelected
                                              ? 'bg-amber-500 text-slate-950 font-black shadow-lg ring-2 ring-amber-400'
                                              : 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                                          }`}
                                        >
                                          {isCustomSelected ? `${item.prepTimeMinutes}m` : 'Set'}
                                        </button>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default KDS;