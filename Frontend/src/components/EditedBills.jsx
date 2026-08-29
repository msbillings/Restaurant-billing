import React, { useState, useEffect } from 'react';
import { getEditedBills } from '../api/billing';
import { useLanguage } from '../context/LanguageContext';
import { ArrowLeft, Clock, FileText, Search, User, Eye, AlertCircle, Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import EditHistoryModal from './EditHistoryModal';
import { motion, AnimatePresence } from 'framer-motion';

import { getCachedEditedBills, cacheEditedBills } from '../db/offlineDb';

const RECORDS_PER_PAGE = 15;

const EditedBills = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBill, setSelectedBill] = useState(null);

  const filterGenuineEdits = (billList) => {
    return (billList || []).filter(b => {
      if (!b.editHistory || b.editHistory.length === 0) return b.isEdited === true;
      return b.editHistory.some(e => {
        const prevItems = (e.previousState?.items || []).filter(i => (i.quantity || 0) > 0).map(i => `${(i.name || '').trim()}:${i.quantity}`).sort().join(',');
        const newItems = (e.newState?.items || []).filter(i => (i.quantity || 0) > 0).map(i => `${(i.name || '').trim()}:${i.quantity}`).sort().join(',');
        const totalChanged = Math.abs((e.previousState?.total || 0) - (e.newState?.total || 0)) > 0.01;
        const chargesChanged = Math.abs((e.previousState?.deliveryCharge || 0) - (e.newState?.deliveryCharge || 0)) > 0.01 || Math.abs((e.previousState?.containerCharge || 0) - (e.newState?.containerCharge || 0)) > 0.01;
        return prevItems !== newItems || totalChanged || chargesChanged;
      });
    });
  };

  useEffect(() => {
    // 1. Instant Cache Load (0ms delay) on mount
    getCachedEditedBills().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setBills(filterGenuineEdits(cached));
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // 2. Background Revalidation
    fetchBills(true);
  }, []);

  const fetchBills = async (isBackground = false) => {
    if (!isBackground && bills.length === 0) {
      setLoading(true);
    }
    try {
      const data = await getEditedBills();
      const onlyEdited = filterGenuineEdits(data);
      setBills(onlyEdited);
      cacheEditedBills(onlyEdited);
    } catch (error) {
      console.error('Failed to fetch edited bills:', error);
    } finally {
      setLoading(false);
    }
  };

  // Date Change Handlers with Strict Validation (End Date must be >= Start Date)
  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (endDate && val && val > endDate) {
      setEndDate(val); // Auto-adjust end date if start date is set ahead of end date
    }
  };

  const handleEndDateChange = (val) => {
    if (startDate && val && val < startDate) {
      setEndDate(startDate); // Auto-adjust to start date if user picks earlier end date
    } else {
      setEndDate(val);
    }
  };

  const filteredBills = bills.filter(bill => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
      (bill.billNumber || '').toLowerCase().includes(q) ||
      (bill.tableNo || '').toLowerCase().includes(q) ||
      (bill.customerName || '').toLowerCase().includes(q)
    );
    if (!matchesSearch) return false;

    const totalEdits = bill.editHistory?.length || 0;
    const lastEdit = totalEdits > 0 ? bill.editHistory[totalEdits - 1] : null;
    const dateStr = lastEdit ? lastEdit.editedAt : (bill.updatedAt || bill.createdAt);
    if (!dateStr) return true;

    const billDate = new Date(dateStr);

    if (startDate) {
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      if (billDate < sDate) return false;
    }

    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      if (billDate > eDate) return false;
    }

    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / RECORDS_PER_PAGE));
  const paginatedBills = filteredBills.slice((currentPage - 1) * RECORDS_PER_PAGE, currentPage * RECORDS_PER_PAGE);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-800';
      case 'Billed': return 'bg-orange-100 text-orange-800';
      case 'Paid': return 'bg-emerald-100 text-emerald-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden w-full">
      {/* Top Level Header Bar */}
      <header className="bg-white px-2.5 sm:px-4 py-2 sm:py-2.5 border-b border-slate-200 shrink-0 flex flex-col gap-2">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2">
          
          {/* Title & Realtime Count Badge */}
          <div className="flex items-center gap-2">
            <button
              onClick={onGoBack}
              className="p-1 -ml-1 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors touch-target"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">{t("Edited Bills History")}</h1>
              <span className="bg-amber-100 text-amber-800 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold">
                {filteredBills.length} {t("Bills")}
              </span>
            </div>
          </div>

          {/* Controls: Search + Date Range + Pagination in a unified row */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-36 md:w-44 lg:w-48">
              <input
                type="text"
                placeholder={t("Search by Bill No or Table...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Clean Aligned Date Range Picker */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-white px-1.5 sm:px-2 py-1 rounded-xl border border-slate-200 text-xs shadow-2xs shrink-0">
              <input
                type="date"
                max={endDate || undefined}
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-transparent text-[10px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer w-[95px] sm:w-[115px] px-0 border-none min-w-0"
                style={{ colorScheme: 'light' }}
                title={t("Start Date")}
              />
              <span className="text-slate-400 font-bold text-[10px] sm:text-xs">-</span>
              <input
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-transparent text-[10px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer w-[95px] sm:w-[115px] px-0 border-none min-w-0"
                style={{ colorScheme: 'light' }}
                title={t("End Date")}
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-[9px] sm:text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-1 py-0.5 rounded-md transition-colors ml-0.5 shrink-0"
                  title={t("Reset Dates")}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-0.5 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title={t("Previous Page")}
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-[10px] sm:text-xs font-black text-slate-700 font-mono px-0.5 whitespace-nowrap">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-0.5 rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title={t("Next Page")}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-1.5 sm:p-2.5 md:p-3 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-medium text-sm">{t("Loading history...")}</p>
          </div>
        ) : paginatedBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto text-center p-6">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <FileText size={32} className="text-slate-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">{t("No edited bills found")}</h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-3">
              {search || startDate || endDate ? t("Try adjusting your filter or date range criteria.") : t("Bills that are reopened and modified will appear here.")}
            </p>
            {(startDate || endDate || search) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); }}
                className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-primary/20 transition-colors"
              >
                <RotateCcw size={13} />
                <span>{t("Reset All Filters")}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-2.5 sm:gap-3">
            <AnimatePresence>
              {paginatedBills.map((bill, index) => {
                const totalEdits = bill.editHistory?.length || 0;
                const lastEdit = totalEdits > 0 ? bill.editHistory[totalEdits - 1] : null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    key={bill._id || bill.billNumber}
                    className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col md:flex-row gap-2.5 sm:gap-3.5 justify-between items-start md:items-center"
                  >
                    <div className="flex gap-3 items-start min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <h3 className="font-bold text-slate-800 text-sm sm:text-base font-mono">
                            {bill.billNumber || 'Unbilled'}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(bill.status)}`}>
                            {bill.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-medium text-slate-500">
                          <div className="flex items-center gap-1">
                            <span className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold">T</span>
                            <span className="text-slate-700 font-bold text-xs">{bill.tableNo}</span>
                          </div>
                          {(bill.customerName || bill.customerPhone) && (
                            <div className="flex items-center gap-1 truncate max-w-[200px]">
                              <User size={12} className="shrink-0" />
                              <span className="truncate">{bill.customerName || 'Customer'} {bill.customerPhone && `(${bill.customerPhone})`}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 md:gap-5 w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4 shrink-0">
                      <div className="flex-1 md:flex-none">
                        <p className="text-[10px] text-slate-500 font-medium mb-0.5">{t("Edits Count")}</p>
                        <div className="flex items-center gap-1">
                          <AlertCircle size={13} className="text-amber-500 shrink-0" />
                          <span className="font-bold text-slate-700 text-xs whitespace-nowrap">{totalEdits} {t("times")}</span>
                        </div>
                      </div>
                      
                      <div className="flex-1 md:flex-none">
                        <p className="text-[10px] text-slate-500 font-medium mb-0.5">{t("Last Edit")}</p>
                        <div className="flex items-center gap-1">
                          <Clock size={13} className="text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-700 text-xs whitespace-nowrap">
                            {lastEdit ? new Date(lastEdit.editedAt).toLocaleString('en-IN', {
                              hour: '2-digit', minute: '2-digit', hour12: true, month: 'short', day: 'numeric'
                            }) : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs shrink-0 touch-target shadow-xs"
                      >
                        <Eye size={14} />
                        <span>{t("View Edits")}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {selectedBill && (
        <EditHistoryModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
        />
      )}
    </div>
  );
};

export default EditedBills;
