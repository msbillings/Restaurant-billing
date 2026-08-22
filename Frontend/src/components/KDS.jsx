import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from "../context/LanguageContext";
import { ChefHat, CheckCircle, Clock, Timer, Ban, Printer, Loader2 } from 'lucide-react';
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
  const [settingPrepKey, setSettingPrepKey] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [activeTableIndex, setActiveTableIndex] = useState(0);
  const scrollContainerRef = useRef(null);
  const fetchingRef = useRef(false);
  const observerRef = useRef(null);
  
  // Track active mutations to prevent polling from reverting optimistic UI
  const activeActionCount = useRef(0);
  const [processingActions, setProcessingActions] = useState({});

  const scrollToTable = (tableNo, index) => {
    setActiveTableIndex(index);
    const element = document.getElementById(`kds-table-${tableNo}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  // Sync active pill when user manually swipes the scroll container
  const setupScrollSync = useCallback((groups) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!scrollContainerRef.current || groups.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const tableNo = entry.target.dataset.tableNo;
            const idx = groups.findIndex(g => g.tableNo === tableNo);
            if (idx !== -1) setActiveTableIndex(idx);
          }
        });
      },
      { root: scrollContainerRef.current, threshold: 0.5 }
    );

    groups.forEach((g) => {
      const el = document.getElementById(`kds-table-${g.tableNo}`);
      if (el) {
        el.dataset.tableNo = g.tableNo;
        observerRef.current.observe(el);
      }
    });

    return () => observerRef.current && observerRef.current.disconnect();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getPrepCountdown = (item) => {
    if (!item.prepTimeMinutes) return null;
    const isPrepared = item.status === 'Ready' || item.status === 'Prepared' || (Array.isArray(item.unitStatuses) && item.unitStatuses.length > 0 && item.unitStatuses.every(s => s === 'Ready' || s === 'Prepared'));
    if (isPrepared) return null;

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
    // Prevent concurrent fetches AND prevent fetching while mutations are in-flight (avoids glitching)
    if (fetchingRef.current || activeActionCount.current > 0) return; 
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
          setLoading(false);
        }
      }
    }).catch(() => {});

    // 2. Background network fetch to confirm freshness
    fetchKOTs();

    // 3. Fast 1.5-Second real-time auto-polling for high-speed kitchen updates
    const pollTimer = setInterval(() => {
      fetchKOTs();
    }, 1500);

    const playKitchenAlertSound = () => {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.8;
        audio.play().catch(() => {
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(587.33, ctx.currentTime);
              osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.35);
            }
          } catch (e) {}
        });
      } catch (e) {}
    };

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

        playKitchenAlertSound();
        if (data.isUpdate) {
          setToast({ message: `🔔 Table ${data.tableNo || ''}: KOT item quantity updated!`, type: 'warning' });
        } else {
          setToast({ message: `🍳 New KOT fired for Table ${data.tableNo || ''} (${data.kot?.kotNumber || ''})`, type: 'info' });
        }
      }
      fetchKOTs();
    };

    const handleKotQuantityUpdated = (data) => {
      if (data && data.tableNo) {
        playKitchenAlertSound();
        const msg = data.isReduction
          ? `⚠️ Table ${data.tableNo}: Item quantity reduced by Admin!`
          : `🔔 Table ${data.tableNo}: KOT item quantity updated in Kitchen!`;
        setToast({ message: msg, type: 'warning' });
      }
      fetchKOTs();
    };

    const handleKotUpdated = (data) => {
      if (data && (data.itemId || data.itemName)) {
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
                  return { 
                    ...item, 
                    status: data.status || item.status,
                    unitStatuses: data.unitStatuses || item.unitStatuses,
                    preparedQuantity: data.preparedQuantity !== undefined ? data.preparedQuantity : item.preparedQuantity,
                    preparingQuantity: data.preparingQuantity !== undefined ? data.preparingQuantity : item.preparingQuantity,
                    pendingQuantity: data.pendingQuantity !== undefined ? data.pendingQuantity : item.pendingQuantity
                  };
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
    const unsubKotQuantityUpdated = realtimeService.subscribe('kotQuantityUpdated', handleKotQuantityUpdated);
    const unsubKotUpdated = realtimeService.subscribe('kotUpdated', handleKotUpdated);
    const unsubOrderUpdated = realtimeService.subscribe('orderUpdated', fetchKOTs);

    return () => {
      clearInterval(pollTimer);
      unsubNewKOT();
      unsubKotQuantityUpdated();
      unsubKotUpdated();
      unsubOrderUpdated();
    };
  }, [fetchKOTs]);

  const updateUnitStatus = async (orderId, kotId, itemId, unitIndex, newStatus, itemName = '', tableNo = '') => {
    const actionKey = `unit-${kotId}-${itemId}-${unitIndex}`;
    activeActionCount.current += 1;
    setProcessingActions(prev => ({ ...prev, [actionKey]: true }));

    // 1. Instant 0ms Local State Update
    setKots((prevKots) =>
      prevKots.map((kot) => {
        if (kot.kotId?.toString() === kotId?.toString() || kot.orderId?.toString() === orderId?.toString()) {
          const updatedItems = (kot.items || []).map((item) => {
            if (item._id?.toString() === itemId?.toString() || item.name === itemId) {
              const qty = Math.max(0, parseInt(item.quantity || 0, 10));
              let currentUnits = item.unitStatuses && Array.isArray(item.unitStatuses) && item.unitStatuses.length === qty && qty > 0
                ? [...item.unitStatuses]
                : Array.from({ length: qty }, () => item.status || 'Pending');
              
              if (unitIndex >= 0 && unitIndex < currentUnits.length) {
                currentUnits[unitIndex] = newStatus;
              }
              
              const prepCount = currentUnits.filter(s => s === 'Ready' || s === 'Prepared').length;
              const cookCount = currentUnits.filter(s => s === 'Preparing').length;
              const computedStatus = (qty > 0 && prepCount === qty) ? 'Ready' : (cookCount > 0 || prepCount > 0 ? 'Preparing' : 'Pending');
              
              return { 
                ...item, 
                status: computedStatus,
                unitStatuses: currentUnits,
                preparedQuantity: prepCount,
                preparingQuantity: cookCount,
                pendingQuantity: Math.max(0, currentUnits.length - prepCount - cookCount)
              };
            }
            return item;
          });
          return { ...kot, items: updatedItems };
        }
        return kot;
      })
    );

    if (newStatus === 'Ready') {
      const displayName = itemName || 'Portion';
      const displayTable = tableNo ? ` for ${tableNo}` : '';
      setToast({ message: `✅ ${displayName} (#${unitIndex + 1})${displayTable} is prepared & ready!`, type: 'success' });
    }

    try {
      await api.post('/bills/kot/item/status', {
        orderId,
        kotId,
        itemId,
        unitIndex,
        status: newStatus
      });
      await fetchKOTs();
    } catch (error) {
      console.error('Error updating unit status:', error);
      await fetchKOTs();
    } finally {
      activeActionCount.current = Math.max(0, activeActionCount.current - 1);
      setProcessingActions(prev => { const next = {...prev}; delete next[actionKey]; return next; });
    }
  };

  const updateItemStatus = async (orderId, kotId, itemId, newStatus, itemName = '', tableNo = '') => {
    const actionKey = `item-${kotId}-${itemId}`;
    activeActionCount.current += 1;
    setProcessingActions(prev => ({ ...prev, [actionKey]: true }));

    // 1. Instant 0ms Local State Update
    setKots((prevKots) =>
      prevKots.map((kot) => {
        if (kot.kotId?.toString() === kotId?.toString() || kot.orderId?.toString() === orderId?.toString()) {
          const updatedItems = (kot.items || []).map((item) => {
            if (item._id?.toString() === itemId?.toString() || item.name === itemId) {
              const qty = Math.max(0, parseInt(item.quantity || 0, 10));
              const currentUnits = Array.from({ length: qty }, () => newStatus);
              return { 
                ...item, 
                status: newStatus,
                unitStatuses: currentUnits,
                preparedQuantity: newStatus === 'Ready' ? qty : 0,
                preparingQuantity: newStatus === 'Preparing' ? qty : 0,
                pendingQuantity: newStatus === 'Pending' ? qty : 0
              };
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
      await fetchKOTs();
    } catch (error) {
      console.error('Error updating status:', error);
      await fetchKOTs();
    } finally {
      activeActionCount.current = Math.max(0, activeActionCount.current - 1);
      setProcessingActions(prev => { const next = {...prev}; delete next[actionKey]; return next; });
    }
  };

  const updateItemPrepTime = async (orderId, kotId, itemId, prepTimeMinutes, itemName, keySuffix = '') => {
    const activeKey = `${itemId}-${keySuffix || prepTimeMinutes}`;
    setSettingPrepKey(activeKey);

    const numMins = Number(prepTimeMinutes);
    const nowIso = new Date().toISOString();

    // 1. Instant 0ms Local State Optimistic Update
    setKots((prevKots) =>
      prevKots.map((kot) => {
        if (kot.kotId?.toString() === kotId?.toString() || kot.orderId?.toString() === orderId?.toString()) {
          const updatedItems = (kot.items || []).map((item) => {
            if (item._id?.toString() === itemId?.toString() || item.name === itemId) {
              return {
                ...item,
                prepTimeMinutes: numMins,
                prepStartTime: nowIso
              };
            }
            return item;
          });
          return { ...kot, items: updatedItems };
        }
        return kot;
      })
    );

    // 2. Instant Toast Feedback
    const displayName = itemName || 'Dish';
    setToast({ message: `⏱️ ${displayName} timer set to ${numMins}m!`, type: 'success' });

    try {
      await api.post('/bills/kot/item/prep-time', {
        orderId,
        kotId,
        itemId,
        prepTimeMinutes: numMins,
        itemName
      });
    } catch (error) {
      console.error('Error setting prep time:', error);
      fetchKOTs();
    } finally {
      setTimeout(() => setSettingPrepKey(null), 500);
    }
  };

  const updateAggregatedItemStatus = async (item, newStatus, tableNo) => {
    const actionKey = `agg-${item.kotNumbers.join('-')}-${item.name}`;
    activeActionCount.current += 1;
    setProcessingActions(prev => ({ ...prev, [actionKey]: true }));

    // 1. Instant 0ms Local State Optimistic Update across all subKots in this item
    setKots((prevKots) =>
      prevKots.map((kot) => {
        const hasMatch = (item.subKots || []).some(sub => 
          (kot.kotId?.toString() === sub.kotId?.toString() || kot.orderId?.toString() === sub.originalOrderId?.toString())
        );
        if (hasMatch) {
          const updatedItems = (kot.items || []).map((kItem) => {
            const isMatchingItem = (item.subKots || []).some(sub =>
              (sub.itemId?.toString() === kItem._id?.toString() || sub.itemId === kItem.name || kItem.name === item.name)
            );
            if (isMatchingItem) {
              const qty = Math.max(0, parseInt(kItem.quantity || 0, 10));
              const currentUnits = Array.from({ length: qty }, () => newStatus);
              return { 
                ...kItem, 
                status: newStatus,
                unitStatuses: currentUnits,
                preparedQuantity: newStatus === 'Ready' ? qty : 0,
                preparingQuantity: newStatus === 'Preparing' ? qty : 0,
                pendingQuantity: newStatus === 'Pending' ? qty : 0
              };
            }
            return kItem;
          });
          return { ...kot, items: updatedItems };
        }
        return kot;
      })
    );

    if (newStatus === 'Ready') {
      const displayName = item.name || 'Item';
      const displayTable = tableNo ? ` for ${tableNo}` : '';
      setToast({ message: `✅ ${displayName}${displayTable} is prepared & ready!`, type: 'success' });

      setTimeout(() => {
        setKots((prevKots) =>
          prevKots.map((kot) => {
            const remaining = (kot.items || []).filter(kItem =>
              kItem.name !== item.name && !(item.subKots || []).some(sub => sub.itemId?.toString() === kItem._id?.toString())
            );
            return { ...kot, items: remaining };
          }).filter(kot => (kot.items || []).some(i => (i.status === 'Pending' || i.status === 'Preparing') && !i.isCancelled))
        );
      }, 1500);
    }

    try {
      await Promise.all(
        (item.subKots || []).map(subKot => 
          api.post('/bills/kot/item/status', {
            orderId: subKot.originalOrderId,
            kotId: subKot.kotId,
            itemId: subKot.itemId,
            status: newStatus
          })
        )
      );
      await fetchKOTs();
    } catch (error) {
      console.error('Error updating aggregated item status:', error);
      await fetchKOTs();
    } finally {
      activeActionCount.current = Math.max(0, activeActionCount.current - 1);
      setProcessingActions(prev => { const next = {...prev}; delete next[actionKey]; return next; });
    }
  };

  const updateAggregatedUnitStatus = async (item, globalIdx, nextStatus, tableNo) => {
    let runningCount = 0;
    let targetSub = null;
    let localUnitIdx = 0;

    for (const sub of (item.subKots || [])) {
      const subQty = sub.quantity || 0;
      if (globalIdx < runningCount + subQty) {
        targetSub = sub;
        localUnitIdx = globalIdx - runningCount;
        break;
      }
      runningCount += subQty;
    }

    if (!targetSub) return;

    updateUnitStatus(
      targetSub.originalOrderId,
      targetSub.kotId,
      targetSub.itemId,
      localUnitIdx,
      nextStatus,
      item.name,
      tableNo
    );
  };

  const updateAggregatedPrepTime = async (item, prepTimeMinutes, keySuffix = '') => {
    if (!item.subKots || item.subKots.length === 0) return;
    const primarySub = item.subKots[0];
    updateItemPrepTime(
      primarySub.originalOrderId,
      primarySub.kotId,
      primarySub.itemId,
      prepTimeMinutes,
      item.name,
      keySuffix
    );
  };

  const groupedKOTs = React.useMemo(() => {
    const tableGroups = {};

    kots.forEach(kot => {
      const tableKey = kot.tableNo;
      if (!tableGroups[tableKey]) {
        tableGroups[tableKey] = {
          tableNo: kot.tableNo,
          billType: kot.billType,
          createdAt: kot.createdAt,
          itemsMap: {}
        };
      }

      if (new Date(kot.createdAt) < new Date(tableGroups[tableKey].createdAt)) {
        tableGroups[tableKey].createdAt = kot.createdAt;
      }

      (kot.items || []).forEach(item => {
        const isCancelled = item.status === 'Cancelled' || item.isCancelled === true;
        const qty = Math.max(0, parseInt(item.quantity || 0, 10));
        if (qty <= 0 && !isCancelled) return; // Skip 0x items

        const itemKey = (item.name || '').trim().toLowerCase();
        if (!tableGroups[tableKey].itemsMap[itemKey]) {
          tableGroups[tableKey].itemsMap[itemKey] = {
            _id: item._id,
            name: item.name,
            quantity: 0,
            reducedQuantity: 0,
            specialNote: item.specialNote || '',
            isCancelled: false,
            status: item.status || 'Pending',
            itemCreatedAt: kot.createdAt,
            prepTimeMinutes: item.prepTimeMinutes,
            prepStartTime: item.prepStartTime,
            kotNumbers: [],
            unitStatuses: [],
            subKots: []
          };
        }

        const aggItem = tableGroups[tableKey].itemsMap[itemKey];

        if (isCancelled) {
          aggItem.isCancelled = true;
        } else {
          aggItem.quantity += qty;
          const itemReduced = Math.max(0, parseInt(item.reducedQuantity || item.cancelledQuantity || 0, 10));
          if (itemReduced > 0) {
            aggItem.reducedQuantity = (aggItem.reducedQuantity || 0) + itemReduced;
          }
          if (item.specialNote) {
            aggItem.specialNote = item.specialNote;
          }
          if (kot.kotNumber && !aggItem.kotNumbers.includes(kot.kotNumber)) {
            aggItem.kotNumbers.push(kot.kotNumber);
          }
          if (item.prepTimeMinutes) {
            aggItem.prepTimeMinutes = item.prepTimeMinutes;
            aggItem.prepStartTime = item.prepStartTime;
          }

          const units = item.unitStatuses && Array.isArray(item.unitStatuses) && item.unitStatuses.length === qty
            ? item.unitStatuses
            : Array.from({ length: qty }, () => item.status || 'Pending');
          
          aggItem.unitStatuses.push(...units);

          aggItem.subKots.push({
            originalOrderId: kot.orderId,
            kotId: kot.kotId,
            itemId: item._id || item.name,
            kotNumber: kot.kotNumber,
            quantity: qty,
            unitStatuses: units,
            status: item.status || 'Pending',
            specialNote: item.specialNote
          });
        }
      });
    });

    const result = Object.values(tableGroups).map(group => {
      const items = Object.values(group.itemsMap)
        .filter(item => item.quantity > 0 && !item.isCancelled)
        .map(item => {
          const qty = item.quantity;
          const units = item.unitStatuses;
          const preparedCount = units.filter(s => s === 'Ready' || s === 'Prepared').length;
          const preparingCount = units.filter(s => s === 'Preparing').length;
          
          let overallStatus = 'Pending';
          if (preparedCount === qty && qty > 0) {
            overallStatus = 'Ready';
          } else if (preparingCount > 0 || preparedCount > 0) {
            overallStatus = 'Preparing';
          }

          return {
            ...item,
            status: overallStatus,
            preparedQuantity: preparedCount,
            preparingQuantity: preparingCount,
            pendingQuantity: Math.max(0, qty - preparedCount - preparingCount),
            kotNumber: item.kotNumbers.join(', ')
          };
        });

      items.sort((a, b) => {
        if (a.status === 'Preparing' && b.status !== 'Preparing') return -1;
        if (b.status === 'Preparing' && a.status !== 'Preparing') return 1;
        return new Date(a.itemCreatedAt) - new Date(b.itemCreatedAt);
      });

      return {
        tableNo: group.tableNo,
        billType: group.billType,
        createdAt: group.createdAt,
        items
      };
    }).filter(g => g.items.some(item => item.status === 'Pending' || item.status === 'Preparing'));

    result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return result;
  }, [kots]);

  // Apply scroll sync when groupedKOTs changes
  useEffect(() => {
    const cleanup = setupScrollSync(groupedKOTs);
    return cleanup;
  }, [groupedKOTs, setupScrollSync]);

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
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onNavigate && (
            <button
              onClick={() => onNavigate('kothistory')}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              title={t("Open KOT Page / History")}
            >
              <Printer size={15} />
              <span>{t("KOT Page / History")}</span>
            </button>
          )}
          <div className="text-slate-400 font-mono text-xs sm:text-sm bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-bold">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Mobile Swipe Guidance Banner & Table Quick-Select */}
      {groupedKOTs.length > 1 && (
        <div className="flex flex-col sm:hidden gap-2 mb-3 shrink-0">
          {/* Swipe hint banner */}
          <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/15 via-orange-500/20 to-amber-500/15 border border-amber-500/40 rounded-2xl px-3.5 py-2 shadow-lg shadow-amber-950/40 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              {/* Right-pointing swipe arrow */}
              <span className="text-lg animate-[nudge_1.5s_ease-in-out_infinite]">👉</span>
              <span className="text-xs font-black text-amber-300 tracking-wide">
                {t("Swipe left / right to switch tables")}
              </span>
            </div>
            <span className="text-[10px] font-mono font-black bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full border border-amber-400/40">
              {groupedKOTs.length} {t("Tables")}
            </span>
          </div>

          {/* Quick Table Switch Pills — highlight follows swipe automatically */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {groupedKOTs.map((group, idx) => {
              const pendingCount = group.items.filter(i => !i.isCancelled && (i.status === 'Pending' || i.status === 'Preparing')).length;
              const isSelected = activeTableIndex === idx;
              return (
                <button
                  key={`pill-${group.tableNo}`}
                  onClick={() => scrollToTable(group.tableNo, idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md font-black ring-2 ring-amber-400/50'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{group.tableNo}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isSelected ? 'bg-slate-950 text-amber-400 font-black' : 'bg-slate-800 text-slate-400 font-bold'
                  }`}>
                    {pendingCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory scroll-smooth custom-scrollbar">
        <div className="flex gap-3.5 sm:gap-4 h-full">
          {loading ? (
            <div className="w-full flex flex-col items-center justify-center p-16 text-slate-400 gap-4">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
                <ChefHat className="absolute text-amber-500 animate-pulse" size={26} />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="font-black text-white text-base tracking-wide flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-amber-400" />
                  {t("Loading Kitchen Orders...")}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {t("Fetching active table tickets & live cooking queue...")}
                </span>
              </div>
            </div>
          ) : groupedKOTs.length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center text-slate-500 font-bold text-lg sm:text-xl p-8">
              <ChefHat size={48} className="mb-3 opacity-30 text-amber-500" />
              <span>{t("No Active Tickets")}</span>
            </div>
          ) : (
            groupedKOTs.map((group, idx) => {
              const tableMinutesOld = Math.floor((new Date() - new Date(group.createdAt)) / 60000);
              let cardColor = 'bg-slate-900 border-slate-800';
              if (tableMinutesOld > 15) cardColor = 'bg-red-950/40 border-red-900/60';
              else if (tableMinutesOld > 10) cardColor = 'bg-amber-950/40 border-amber-900/60';

              return (
                <div key={group.tableNo} id={`kds-table-${group.tableNo}`} className={`w-[88vw] sm:w-80 md:w-88 shrink-0 rounded-2xl border-2 flex flex-col overflow-hidden shadow-2xl snap-center ${cardColor}`}>
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
                      const prepKey = `${group.tableNo}-${item.name}`;

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
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-black text-sm sm:text-base leading-snug ${isCancelled ? 'line-through text-red-400' : 'text-white'}`}>
                                  {item.quantity}x {item.name}
                                </p>
                                {item.reducedQuantity > 0 && !isCancelled && (
                                  <span className="text-[11px] font-black bg-red-500/25 text-red-300 border border-red-500/50 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-sm animate-pulse">
                                    <span>🔻</span>
                                    <span>-{item.reducedQuantity}x {t("Reduced")}</span>
                                  </span>
                                )}
                              </div>
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
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider inline-flex items-center gap-1 ${
                                    item.status === 'Preparing'
                                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                      : item.status === 'Ready'
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}>
                                    {item.status === 'Preparing' && <Loader2 size={10} className="animate-spin text-amber-400" />}
                                    {item.status === 'Ready' && <CheckCircle size={10} className="text-emerald-400" />}
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
                                onClick={() => updateAggregatedItemStatus(item, item.status === 'Pending' ? 'Preparing' : 'Ready', group.tableNo)}
                                className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-lg touch-target cursor-pointer ${
                                  item.status === 'Pending'
                                    ? 'bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white border border-slate-700'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                                }`}
                                title={t(item.status === 'Pending' ? 'Start Preparing All' : 'Mark All Ready')}
                              >
                                {item.status === 'Pending' ? <ChefHat size={20} /> : <CheckCircle size={20} />}
                              </button>
                            )}
                          </div>

                          {/* Individual Quantity / Portion Status Chips for items with Qty > 1 */}
                          {!isCancelled && Number(item.quantity || 1) > 1 && (
                            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                                <span>{t("Portion Breakdown")} ({item.quantity})</span>
                                <span className="text-[9px] text-slate-500 font-normal">{t("Tap portion to change")}</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {(() => {
                                  const qty = item.quantity;
                                  const units = item.unitStatuses && Array.isArray(item.unitStatuses) && item.unitStatuses.length === qty && qty > 0
                                    ? item.unitStatuses
                                    : Array.from({ length: qty }, () => item.status || 'Pending');
                                  return units.map((uStatus, uIdx) => {
                                    const nextStatus = uStatus === 'Pending' ? 'Preparing' : uStatus === 'Preparing' ? 'Ready' : 'Pending';
                                    const isReady = uStatus === 'Ready' || uStatus === 'Prepared';
                                    const isPrep = uStatus === 'Preparing';
                                    return (
                                      <button
                                        key={`unit-${prepKey}-${uIdx}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateAggregatedUnitStatus(item, uIdx, nextStatus, group.tableNo);
                                        }}
                                        className={`px-2 py-1.5 rounded-lg text-[10px] font-black border transition-all flex items-center justify-between gap-1 shadow-xs active:scale-95 cursor-pointer ${
                                          isReady
                                            ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/40'
                                            : isPrep
                                            ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 hover:bg-amber-500/35'
                                            : 'bg-slate-800/90 text-blue-300 border-blue-500/30 hover:bg-slate-800'
                                        }`}
                                        title={`Portion #${uIdx + 1}: ${uStatus} (Click to set ${nextStatus})`}
                                      >
                                        <span className="opacity-75 font-mono">#{uIdx + 1}</span>
                                        <span className="inline-flex items-center gap-1 truncate">
                                          {isReady ? (
                                            <>
                                              <CheckCircle size={10} className="text-emerald-400" />
                                              <span>{t("Prepared")}</span>
                                            </>
                                          ) : isPrep ? (
                                            <>
                                              <Loader2 size={10} className="animate-spin text-amber-400" />
                                              <span>{t("Cooking")}</span>
                                            </>
                                          ) : (
                                            <>
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                                              <span>{t("Pending")}</span>
                                            </>
                                          )}
                                        </span>
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          )}

                          {!isCancelled && (
                            <div className="pt-2 border-t border-slate-800/80 mt-1 flex flex-col gap-1.5">
                              {(() => {
                                const cd = getPrepCountdown(item);
                                const isReady = item.status === 'Ready' || item.status === 'Prepared' || (Array.isArray(item.unitStatuses) && item.unitStatuses.length > 0 && item.unitStatuses.every(s => s === 'Ready' || s === 'Prepared'));
                                return (
                                  <>
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                                        <Timer size={12} /> {t("Prep Time")}:
                                      </span>
                                      {isReady ? (
                                        <span className="font-bold text-xs px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1">
                                          ✅ {t("Prepared & Ready")}
                                        </span>
                                      ) : cd ? (
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
                                  const isSettingThis = settingPrepKey === `${item._id}-${mins}`;
                                  return (
                                    <button
                                      key={mins}
                                      onClick={() => updateAggregatedPrepTime(item, mins, String(mins))}
                                      disabled={isSettingThis}
                                      className={`px-2.5 py-1.5 text-[11px] sm:text-xs font-black rounded-lg border transition-all duration-150 touch-target cursor-pointer flex items-center justify-center gap-1 active:scale-90 ${
                                        isSettingThis
                                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/50 scale-105 ring-2 ring-amber-400 animate-pulse'
                                          : isSelected
                                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border-amber-300 font-black shadow-md shadow-amber-500/40 scale-105 ring-2 ring-amber-400'
                                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                                      }`}
                                    >
                                      {isSettingThis ? (
                                        <Loader2 size={11} className="animate-spin text-slate-950" />
                                      ) : null}
                                      <span>{mins}m</span>
                                    </button>
                                  );
                                })}
                                <div className="flex items-center gap-1 ml-auto">
                                  {(() => {
                                    const isCustomSelected = item.prepTimeMinutes > 0 && ![5, 10, 15, 20].includes(Number(item.prepTimeMinutes));
                                    const isSettingCustom = settingPrepKey === `${item._id}-custom`;
                                    return (
                                      <>
                                        <input
                                          type="number"
                                          placeholder={isCustomSelected ? item.prepTimeMinutes : "13"}
                                          value={customPrepInputs[prepKey] || ''}
                                          onChange={(e) => setCustomPrepInputs({ ...customPrepInputs, [prepKey]: e.target.value })}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              const val = parseInt(customPrepInputs[prepKey]);
                                              if (val && val > 0) {
                                                updateAggregatedPrepTime(item, val, 'custom');
                                                setCustomPrepInputs({ ...customPrepInputs, [prepKey]: '' });
                                              }
                                            }
                                          }}
                                          className={`w-12 px-1.5 py-1 text-[11px] border rounded-lg font-mono text-center focus:outline-none transition-all ${
                                            isCustomSelected
                                              ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-black ring-2 ring-amber-400'
                                              : 'bg-slate-950 text-amber-300 border-slate-700 focus:border-amber-500'
                                          }`}
                                        />
                                        <button
                                          onClick={() => {
                                            const val = parseInt(customPrepInputs[prepKey]);
                                            if (val && val > 0) {
                                              updateAggregatedPrepTime(item, val, 'custom');
                                              setCustomPrepInputs({ ...customPrepInputs, [prepKey]: '' });
                                            }
                                          }}
                                          disabled={isSettingCustom}
                                          className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all duration-150 touch-target cursor-pointer flex items-center justify-center gap-1 active:scale-90 ${
                                            isSettingCustom
                                              ? 'bg-amber-400 text-slate-950 font-black shadow-lg ring-2 ring-amber-400 animate-pulse'
                                              : isCustomSelected
                                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-400'
                                              : 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                                          }`}
                                        >
                                          {isSettingCustom ? (
                                            <Loader2 size={11} className="animate-spin text-slate-950" />
                                          ) : null}
                                          <span>{isCustomSelected ? `${item.prepTimeMinutes}m` : 'Set'}</span>
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