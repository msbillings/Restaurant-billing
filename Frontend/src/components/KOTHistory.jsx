import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiGetTodayKOTs } from '../api/billing';
import { getCachedKotHistory, cacheKotHistory } from '../db/offlineDb';
import { Printer, Calendar, Search, FileText, ArrowLeft, ChevronDown, ChevronUp, ChefHat } from 'lucide-react';
import KOT from './KOT';
import Toast from './Toast';
import useDebounce from '../hooks/useDebounce';
import BackButton from './common/BackButton';
import realtimeService from '../services/realtimeService';
import { formatTime12 } from '../utils/timeFormat';

const KOTHistory = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedKOT, setSelectedKOT] = useState(null);
  const [toast, setToast] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const getTodayDateStr = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchKOTs = useCallback(async (dateParam, searchParam, isBackground = false) => {
    const d = dateParam !== undefined ? dateParam : selectedDate;
    const s = searchParam !== undefined ? searchParam : debouncedSearchTerm;
    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const data = await apiGetTodayKOTs(d, s);
      const safeData = Array.isArray(data) ? data : [];
      setKots(safeData);
      cacheKotHistory(safeData, d).catch(() => {});
    } catch (error) {
      console.error('Error fetching KOTs:', error);
      setToast({ message: 'Failed to load KOT history', type: 'error' });
      setKots([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, debouncedSearchTerm]);

  // Initial load
  useEffect(() => {
    // 1. Instant Cache Load
    getCachedKotHistory(selectedDate).then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setKots(cached);
        setLoading(false);
      }
    }).catch(() => {});

    // 2. Fetch fresh with background refresh so cache is displayed immediately and dynamic top loader shows
    fetchKOTs(selectedDate, debouncedSearchTerm, true);
  }, []);

  // When debounced search term changes
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    fetchKOTs(selectedDate, debouncedSearchTerm, false);
  }, [debouncedSearchTerm]);

  const handleDateChange = (newDate) => {
    const todayStr = getTodayDateStr();
    let finalDate = newDate;
    if (newDate && newDate > todayStr) {
      setToast({ message: t("Future dates are not allowed"), type: 'error' });
      finalDate = todayStr;
    }
    setSelectedDate(finalDate);
    // Instant cache peek if available
    getCachedKotHistory(finalDate).then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setKots(cached);
      }
    }).catch(() => {});
    fetchKOTs(finalDate, debouncedSearchTerm, false);
  };

  const handleResetToToday = () => {
    const todayStr = getTodayDateStr();
    setSelectedDate(todayStr);
    setSearchTerm('');
    fetchKOTs(todayStr, '', false);
  };

  useEffect(() => {
    // Optimistic instant update via singleton RealtimeService
    const handleNewKOT = (data) => {
      if (data && data.kot) {
        const todayStr = getTodayDateStr();
        if (selectedDate === todayStr) {
          const targetKotId = String(data.kot._id || data.kot.kotId || '');
          setKots(prev => {
            if (targetKotId) {
              const exists = prev.some(k => String(k.kotId || k._id || '') === targetKotId);
              if (exists) {
                fetchKOTs(selectedDate, debouncedSearchTerm, true);
                return prev;
              }
            }
            const newKot = {
              _id: data.kot._id,
              kotId: data.kot._id,
              kotNumber: data.kot.kotNumber,
              tableNo: data.tableNo || data.kot.tableNo,
              billType: data.billType || data.kot.billType || 'Dine-In',
              orderSource: data.kot?.orderSource || data.orderSource,
              queueNumber: data.kot?.queueNumber || data.kot?.tokenNo || data.queueNumber || data.tokenNo,
              tokenNo: data.kot?.tokenNo || data.kot?.queueNumber || data.tokenNo || data.queueNumber,
              billId: data.orderId || data.kot.orderId,
              createdAt: data.kot.createdAt || new Date().toISOString(),
              items: (data.kot.items || []).map(i => ({ ...i, status: i.status || 'Pending' }))
            };
            return [newKot, ...prev];
          });
        }
      }
      fetchKOTs(selectedDate, debouncedSearchTerm, true);
    };

    const handleKotUpdated = (data) => {
      if (data && (data.itemId || data.itemName) && data.status) {
        setKots(prev => prev.map(kot => {
          if (
            (data.kotId && (kot._id?.toString() === data.kotId?.toString() || kot.kotId?.toString() === data.kotId?.toString())) ||
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
      fetchKOTs(selectedDate, debouncedSearchTerm, true);
    };

    const unsubNewKOT = realtimeService.subscribe('newKOT', handleNewKOT);
    const unsubKotUpdated = realtimeService.subscribe('kotUpdated', handleKotUpdated);
    const unsubOrderUpdated = realtimeService.subscribe('orderUpdated', () => fetchKOTs(selectedDate, debouncedSearchTerm, true));

    return () => {
      unsubNewKOT();
      unsubKotUpdated();
      unsubOrderUpdated();
    };
  }, [selectedDate, debouncedSearchTerm, fetchKOTs]);

  const handleReprint = (kot) => {
    setSelectedKOT(kot);
  };

  const getItemsSummary = (items) => {
    if (!items || items.length === 0) return 'No items';
    
    // Group active items by name so multiple KOT batches or reduced items collapse cleanly
    const itemMap = {};
    items.forEach(i => {
      const isCancelled = i.status === 'Cancelled' || i.isCancelled;
      const qty = Math.max(0, parseInt(i.quantity || 0, 10));
      if (qty <= 0 && !isCancelled) return; // Skip 0x items
      
      const key = (i.name || '').trim().toLowerCase();
      if (!itemMap[key]) {
        itemMap[key] = {
          name: i.name,
          quantity: 0,
          isCancelled: false,
          unitStatuses: [],
          status: 'Pending',
          reducedQuantity: 0,
          cancelledQuantity: 0
        };
      }
      
      if (isCancelled && qty === 0) {
        // Fully cancelled item
        itemMap[key].isCancelled = true;
        const cancelQty = Math.max(1, parseInt(i.cancelledQuantity || i.reducedQuantity || 1, 10));
        itemMap[key].cancelledQuantity = Math.max(itemMap[key].cancelledQuantity || 0, cancelQty);
      } else if (isCancelled && qty > 0) {
        // Cancellation slip entry with quantity
        const cancelQty = Math.max(1, parseInt(i.cancelledQuantity || qty, 10));
        itemMap[key].cancelledQuantity = Math.max(itemMap[key].cancelledQuantity || 0, cancelQty);
        itemMap[key].reducedQuantity = Math.max(itemMap[key].reducedQuantity || 0, cancelQty);
      } else {
        // Active item
        itemMap[key].quantity += qty;
        const itemReduced = Math.max(0, parseInt(i.reducedQuantity || i.cancelledQuantity || 0, 10));
        if (itemReduced > 0) {
          itemMap[key].reducedQuantity = Math.max(itemMap[key].reducedQuantity || 0, itemReduced);
        }
        const units = i.unitStatuses && Array.isArray(i.unitStatuses) && i.unitStatuses.length === qty && qty > 0
          ? i.unitStatuses
          : Array.from({ length: qty }, () => i.status || 'Pending');
        itemMap[key].unitStatuses.push(...units);
      }
    });

    // If an item has active quantity > 0, it is actively being prepared (not cancelled)
    Object.values(itemMap).forEach(item => {
      if (item.quantity > 0) {
        item.isCancelled = false;
      }
    });

    // Keep cancelled items too — KOT history must show everything ordered (including cancellations)
    const activeItems = Object.values(itemMap).filter(item => item.quantity > 0 || item.isCancelled);
    if (activeItems.length === 0) return 'No active items';

    const summary = activeItems.map((i) => {
      // Fully cancelled item
      if (i.quantity === 0 || (i.isCancelled && i.quantity === 0)) {
        const cQty = i.cancelledQuantity || 1;
        return `[CANCELLED] ${cQty}x ${t(i.name)}`;
      }

      // Active item with quantity > 0
      const qty = i.quantity;
      const reducedSuffix = i.reducedQuantity > 0 ? ` [-${i.reducedQuantity}x ${t("Cancelled")}]` : '';
      const units = i.unitStatuses || [];
      const prep = units.filter(s => s === 'Ready' || s === 'Prepared').length;
      const cook = units.filter(s => s === 'Preparing').length;
      const pend = units.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

      if (qty > 1 && (prep > 0 || cook > 0)) {
        const parts = [];
        if (prep > 0) parts.push(`${prep} Prepared`);
        if (cook > 0) parts.push(`${cook} Cooking`);
        if (pend > 0) parts.push(`${pend} Pending`);
        return `${qty}x ${t(i.name)}${reducedSuffix} (${parts.join(', ')})`;
      }

      // Active item status — Cannot be Cancelled when qty > 0
      let itemStatus = 'Pending';
      if (prep === qty && qty > 0) {
        itemStatus = 'Prepared';
      } else if (cook > 0 || prep > 0) {
        itemStatus = 'Preparing';
      } else if (i.status && i.status !== 'Cancelled') {
        itemStatus = i.status;
      }
      return `${qty}x ${t(i.name)}${reducedSuffix} [${t(itemStatus)}]`;
    }).join(', ');

    return summary.length > 90 ? summary.substring(0, 87) + '...' : summary;
  };

  const getKOTStatus = (items, billStatus) => {
    if (billStatus === 'Paid' || billStatus === 'Settled') return 'Prepared';
    if (!items || items.length === 0) return 'Pending';
    const validItems = items.filter(i => (i.quantity || 0) > 0 || i.isCancelled);
    if (validItems.length === 0) return 'Pending';
    const activeItems = validItems.filter(i => (i.quantity || 0) > 0 && !i.isCancelled && i.status !== 'Cancelled');
    if (activeItems.length === 0) return 'Cancelled';
    const allReady = activeItems.every(i => i.status === 'Ready' || i.status === 'Prepared');
    const anyPreparing = activeItems.some(i => i.status === 'Preparing');
    if (allReady) return 'Prepared';
    if (anyPreparing) return 'Preparing';
    return 'Ordered';
  };

  const groupedKOTs = useMemo(() => {
    const groups = {};
    kots.forEach(kot => {
      const groupId = kot.billId || kot.tableNo;
      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          tableNo: kot.tableNo,
          billStatus: kot.billStatus,
          createdAt: kot.createdAt,
          items: [],
          kots: []
        };
      }
      if (new Date(kot.createdAt) < new Date(groups[groupId].createdAt)) {
        groups[groupId].createdAt = kot.createdAt;
      }
      groups[groupId].kots.push(kot);
      groups[groupId].items.push(...(kot.items || []).filter(i => ((i.quantity || 0) > 0 || i.isCancelled) && !i.isCancellationSlip && !kot.kotNumber?.startsWith('CANCEL')));
    });
    return Object.values(groups).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [kots]);

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header and Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 mb-2 sm:mb-2.5 shrink-0 bg-surface p-2 sm:p-2.5 border border-border rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {onNavigate && <BackButton onClick={onGoBack} className="shrink-0" />}
          <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 shadow-xs border border-orange-200 shrink-0">
            <Printer size={16} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-text-main tracking-tight whitespace-nowrap leading-tight">{t("KOT History")}</h1>
            <p className="text-[10px] sm:text-xs text-text-muted font-medium leading-tight">{t("Kitchen Order Tickets")}</p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
          {onNavigate && (
            <button
              onClick={() => onNavigate('kds')}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer shrink-0"
            >
              <ChefHat size={14} />
              <span>{t("Kitchen Display (KDS)")}</span>
            </button>
          )}

          {/* Search Bar */}
          <div className="relative flex-1 sm:w-36 md:w-44 lg:w-56">
            <input
              type="text" 
              placeholder={t("Search KOT or Table...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 font-medium" />
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1 bg-background px-2 py-1 rounded-xl border border-border text-xs shrink-0 shadow-2xs">
            <input
              type="date"
              value={selectedDate}
              max={getTodayDateStr()}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-[11px] sm:text-xs font-bold text-text-main outline-none cursor-pointer w-[105px] sm:w-[115px] border-none"
              style={{ colorScheme: 'light' }}
              title={t("Select Date")}
            />
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading && kots.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-4 flex-1 flex flex-col gap-3 shadow-xs">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-text-muted/10 rounded-xl animate-pulse w-full"></div>
            ))}
          </div>
        ) : kots.length === 0 && !refreshing ? (
          <div className="bg-surface border border-border rounded-2xl flex-1 flex flex-col items-center justify-center text-text-muted shadow-xs p-6 text-center">
            <FileText size={48} className="opacity-20 mb-3" />
            <p className="font-mono text-base sm:text-lg text-text-main font-bold">{t("No KOTs found.")}</p>
            <p className="text-xs sm:text-sm text-text-muted mt-1 mb-4">{t("No Kitchen Order Tickets found for")} <span className="font-mono font-bold text-text-main">{selectedDate}</span></p>
            <button
              onClick={handleResetToToday}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5">
              <span>{t("View Today's KOTs")}</span>
            </button>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden flex-1 flex flex-col shadow-xs">

            {/* Desktop Wide Table (Visible on md and larger) */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-background sticky top-0 z-10 shadow-xs border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider">
                      <div className="flex items-center gap-2">
                        {t("KOT No")}
                        {refreshing && <span className="inline-block w-2 h-2 rounded-full bg-orange-400 animate-pulse" title="Updating..."></span>}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider">{t("Time")}</th>
                    <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider">{t("Table / Order")}</th>
                    <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider">{t("Items Summary")}</th>
                    <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider">{t("Status")}</th>
                    <th className="px-3 py-2.5 font-bold text-xs uppercase text-text-muted tracking-wider text-right">{t("Action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* Dynamic Top UI Loading Section for Latest KOTs */}
                  {refreshing && (
                    <tr className="bg-gradient-to-r from-orange-50/80 via-amber-50/60 to-orange-50/80 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-950/30 border-b-2 border-orange-300/70 dark:border-orange-700/40 animate-pulse">
                      <td colSpan={6} className="px-4 py-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-600"></span>
                            </span>
                            <span className="text-xs font-bold text-orange-800 dark:text-orange-300 font-mono tracking-tight flex items-center gap-1.5">
                              {t("Checking for latest KOTs...")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-3 w-16 bg-orange-200/70 dark:bg-orange-800/40 rounded-full animate-pulse"></div>
                            <div className="h-3 w-32 bg-orange-200/70 dark:bg-orange-800/40 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {groupedKOTs.map((group) => (
                    <React.Fragment key={group.id}>
                      <tr 
                        onClick={() => setExpandedRow(expandedRow === group.id ? null : group.id)}
                        className="hover:bg-background/50 transition-colors cursor-pointer group-row">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {expandedRow === group.id ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                            <span className="px-2.5 py-1 text-xs font-bold rounded-lg font-mono shadow-xs border bg-slate-50 text-slate-700 border-slate-200 whitespace-nowrap">
                              {group.kots.length} KOT{group.kots.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-mono font-medium text-text-main text-xs sm:text-sm">
                            {formatTime12(group.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-bold text-text-main text-xs sm:text-sm">{t(group.tableNo)}</span>
                        </td>
                        <td className="px-3 py-2.5 w-full max-w-xs">
                          <p className="text-xs font-medium text-text-muted truncate">
                            {getItemsSummary(group.items)}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg font-mono border whitespace-nowrap ${
                            getKOTStatus(group.items, group.billStatus) === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                            getKOTStatus(group.items, group.billStatus) === 'Prepared' ? 'bg-green-50 text-green-700 border-green-200' :
                            getKOTStatus(group.items, group.billStatus) === 'Preparing' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {t(getKOTStatus(group.items, group.billStatus))}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedRow(expandedRow === group.id ? null : group.id); }}
                            className="px-2.5 py-1.5 bg-background hover:bg-orange-50 text-orange-600 font-bold text-xs rounded-lg border border-border hover:border-orange-200 transition-all inline-flex items-center gap-1">
                            {expandedRow === group.id ? t("Close") : t("View Actions")}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === group.id && group.kots.map(kot => (
                        <tr key={`${kot.billId}-${kot.kotNumber}`} className="bg-surface/30">
                          <td className="px-3 py-2.5 whitespace-nowrap pl-8">
                            <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg font-mono border whitespace-nowrap ${
                              kot.kotNumber.startsWith('CANCEL') || getKOTStatus(kot.items, kot.billStatus) === 'Cancelled' ?
                              'bg-red-50 text-red-700 border-red-200' :
                              'bg-orange-50 text-orange-700 border-orange-200'}`}>
                              {kot.kotNumber}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-mono font-medium text-text-muted text-xs">
                              {formatTime12(kot.createdAt)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap"></td>
                          <td className="px-3 py-2.5 w-full max-w-xs">
                            <p className="text-xs font-medium text-text-muted truncate">
                              {getItemsSummary(kot.items)}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-lg font-mono border whitespace-nowrap ${
                              getKOTStatus(kot.items, kot.billStatus) === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                              getKOTStatus(kot.items, kot.billStatus) === 'Prepared' ? 'bg-green-50 text-green-700 border-green-200' :
                              getKOTStatus(kot.items, kot.billStatus) === 'Preparing' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {t(getKOTStatus(kot.items, kot.billStatus))}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReprint(kot); }}
                              className="px-2.5 py-1.5 bg-background hover:bg-orange-50 text-orange-600 font-bold text-xs rounded-lg border border-border hover:border-orange-200 transition-all inline-flex items-center gap-1">
                              <Printer size={13} />{t("Reprint")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Stacked Card List (Visible on screens < 768px) */}
            <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3">
              {/* Dynamic Top UI Loader for Latest KOTs Syncing */}
              {refreshing && (
                <div className="bg-gradient-to-r from-orange-50/80 via-amber-50/60 to-orange-50/80 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-950/30 border-2 border-dashed border-orange-400/50 dark:border-orange-500/30 rounded-xl p-2.5 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-600"></span>
                    </span>
                    <span className="text-xs font-bold text-orange-800 dark:text-orange-300 font-mono">
                      {t("Checking for latest KOTs...")}
                    </span>
                  </div>
                  <div className="h-2.5 w-20 bg-orange-200/70 dark:bg-orange-800/40 rounded-full animate-pulse"></div>
                </div>
              )}
              {groupedKOTs.map((group) => (
                <div key={group.id} className="bg-background rounded-xl p-3.5 border border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text-main">{t(group.tableNo)}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md font-mono bg-slate-100 text-slate-700 border border-slate-200">
                        {group.kots.length} KOT{group.kots.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md font-mono border ${
                      getKOTStatus(group.items, group.billStatus) === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                      getKOTStatus(group.items, group.billStatus) === 'Prepared' ? 'bg-green-50 text-green-700 border-green-200' :
                      getKOTStatus(group.items, group.billStatus) === 'Preparing' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {t(getKOTStatus(group.items, group.billStatus))}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted leading-snug line-clamp-2">
                    {getItemsSummary(group.items)}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="font-mono text-text-muted">
                      {formatTime12(group.createdAt)}
                    </span>
                    <button
                      onClick={() => setExpandedRow(expandedRow === group.id ? null : group.id)}
                      className="px-3 py-1.5 bg-surface hover:bg-orange-50 text-orange-600 font-bold rounded-lg border border-border text-xs flex items-center gap-1">
                      <span>{expandedRow === group.id ? t("Hide Details") : t("Details & Reprint")}</span>
                      {expandedRow === group.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Expanded Sub-KOTs on Mobile */}
                  {expandedRow === group.id && (
                    <div className="pt-2 border-t border-border space-y-2">
                      {group.kots.map((kot) => (
                        <div key={`${kot.billId}-${kot.kotNumber}`} className="bg-surface p-2.5 rounded-lg border border-border/60 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold font-mono text-orange-600 block">{kot.kotNumber}</span>
                            <span className="text-[10px] text-text-muted">
                              {formatTime12(kot.createdAt)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleReprint(kot)}
                            className="px-3 py-1.5 bg-orange-50 text-orange-600 font-bold rounded-lg border border-orange-200 flex items-center gap-1 touch-target">
                            <Printer size={14} />
                            <span>{t("Reprint")}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Summary */}
            <div className="bg-background border-t border-border p-3 sm:p-4 flex justify-between items-center text-xs sm:text-sm font-medium text-text-muted shrink-0">
              <span>{t("Showing")} {kots.length} {t("KOTs")}</span>
              <span>{t("Date")}: {selectedDate}</span>
            </div>
          </div>
        )}
      </div>

      {selectedKOT &&
      <KOT
        order={selectedKOT}
        onClose={() => setSelectedKOT(null)} />

      }

      {toast &&
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)} />

      }
    </div>);

};

export default KOTHistory;