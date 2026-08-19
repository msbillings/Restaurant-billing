import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiGetTodayKOTs } from '../api/billing';
import { getCachedKotHistory, cacheKotHistory } from '../db/offlineDb';
import { Printer, Calendar, Search, FileText, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import KOT from './KOT';
import Toast from './Toast';
import useDebounce from '../hooks/useDebounce';
import BackButton from './common/BackButton';
import realtimeService from '../services/realtimeService';

const KOTHistory = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);
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

    // 2. Fetch fresh
    fetchKOTs(selectedDate, debouncedSearchTerm, false);
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
    setSelectedDate(newDate);
    // Instant cache peek if available
    getCachedKotHistory(newDate).then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setKots(cached);
      }
    }).catch(() => {});
    fetchKOTs(newDate, debouncedSearchTerm, false);
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
    const summary = items.map((i) => {
      const isCancelled = i.status === 'Cancelled' || i.isCancelled;
      return `${isCancelled ? '0' : i.quantity}x ${t(i.name)}${isCancelled ? ' (Cancelled)' : ''}`;
    }).join(', ');
    return summary.length > 60 ? summary.substring(0, 57) + '...' : summary;
  };

  const getKOTStatus = (items) => {
    if (!items || items.length === 0) return 'Pending';
    const allCancelled = items.every(i => i.status === 'Cancelled' || i.isCancelled);
    if (allCancelled) return 'Cancelled';
    const allReady = items.every(i => i.status === 'Ready' || i.status === 'Cancelled' || i.isCancelled);
    const anyPreparing = items.some(i => i.status === 'Preparing');
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
          createdAt: kot.createdAt,
          items: [],
          kots: []
        };
      }
      if (new Date(kot.createdAt) < new Date(groups[groupId].createdAt)) {
        groups[groupId].createdAt = kot.createdAt;
      }
      groups[groupId].kots.push(kot);
      groups[groupId].items.push(...kot.items);
    });
    return Object.values(groups).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [kots]);

  return (
    <div className="h-full flex flex-col bg-background p-4 sm:p-6 overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header and Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0 bg-surface p-4 sm:p-6 border border-border rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          {onNavigate && <BackButton onClick={onGoBack} />}
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 shadow-xs border border-orange-200 shrink-0">
            <Printer size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-main font-mono tracking-tight">{t("KOT History")}</h1>
            <p className="text-xs text-text-muted font-medium">{t("Kitchen Order Tickets")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <input
              type="text" 
              placeholder={t("Search KOT or Table...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 font-medium" />
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-background px-3 py-2 rounded-xl border border-border text-xs shrink-0 shadow-2xs">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-text-main outline-none cursor-pointer w-[128px] sm:w-[138px] border-none"
              style={{ colorScheme: 'light' }}
              title={t("Select Date")}
            />
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="bg-surface border border-border rounded-2xl p-4 flex-1 flex flex-col gap-3 shadow-xs">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-text-muted/10 rounded-xl animate-pulse w-full"></div>
            ))}
          </div>
        ) : kots.length === 0 ? (
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
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider">{t("KOT No")}</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider">{t("Time")}</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider">{t("Table / Order")}</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider">{t("Items Summary")}</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider">{t("Status")}</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider text-right">{t("Action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {groupedKOTs.map((group) => (
                    <React.Fragment key={group.id}>
                      <tr 
                        onClick={() => setExpandedRow(expandedRow === group.id ? null : group.id)}
                        className="hover:bg-background/50 transition-colors cursor-pointer group-row">
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {expandedRow === group.id ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                            <span className="px-2.5 py-1 text-xs font-bold rounded-lg font-mono shadow-xs border bg-slate-50 text-slate-700 border-slate-200">
                              {group.kots.length} KOT{group.kots.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-mono font-medium text-text-main text-sm">
                            {new Date(group.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-bold text-text-main text-sm">{t(group.tableNo)}</span>
                        </td>
                        <td className="p-4 w-full max-w-xs">
                          <p className="text-xs font-medium text-text-muted truncate">
                            {getItemsSummary(group.items)}
                          </p>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg font-mono border ${
                            getKOTStatus(group.items) === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                            getKOTStatus(group.items) === 'Prepared' ? 'bg-green-50 text-green-700 border-green-200' :
                            getKOTStatus(group.items) === 'Preparing' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {t(getKOTStatus(group.items))}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedRow(expandedRow === group.id ? null : group.id); }}
                            className="px-3 py-1.5 bg-background hover:bg-orange-50 text-orange-600 font-bold text-xs rounded-lg border border-border hover:border-orange-200 transition-all inline-flex items-center gap-1.5">
                            {expandedRow === group.id ? t("Close") : t("View Actions")}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === group.id && group.kots.map(kot => (
                        <tr key={`${kot.billId}-${kot.kotNumber}`} className="bg-surface/30">
                          <td className="p-4 whitespace-nowrap pl-10">
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg font-mono border ${
                              kot.kotNumber.startsWith('CANCEL') || getKOTStatus(kot.items) === 'Cancelled' ?
                              'bg-red-50 text-red-700 border-red-200' :
                              'bg-orange-50 text-orange-700 border-orange-200'}`}>
                              {kot.kotNumber}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="font-mono font-medium text-text-muted text-xs">
                              {new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap"></td>
                          <td className="p-4 w-full max-w-xs">
                            <p className="text-xs font-medium text-text-muted truncate">
                              {getItemsSummary(kot.items)}
                            </p>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg font-mono border ${
                              getKOTStatus(kot.items) === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                              getKOTStatus(kot.items) === 'Prepared' ? 'bg-green-50 text-green-700 border-green-200' :
                              getKOTStatus(kot.items) === 'Preparing' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {t(getKOTStatus(kot.items))}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReprint(kot); }}
                              className="px-3 py-1.5 bg-background hover:bg-orange-50 text-orange-600 font-bold text-xs rounded-lg border border-border hover:border-orange-200 transition-all inline-flex items-center gap-1.5">
                              <Printer size={14} />{t("Reprint")}
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
                      getKOTStatus(group.items) === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                      getKOTStatus(group.items) === 'Prepared' ? 'bg-green-50 text-green-700 border-green-200' :
                      getKOTStatus(group.items) === 'Preparing' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {t(getKOTStatus(group.items))}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted leading-snug line-clamp-2">
                    {getItemsSummary(group.items)}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="font-mono text-text-muted">
                      {new Date(group.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                              {new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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