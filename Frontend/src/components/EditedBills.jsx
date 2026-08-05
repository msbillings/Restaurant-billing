import React, { useState, useEffect } from 'react';
import { getEditedBills } from '../api/billing';
import { useLanguage } from '../context/LanguageContext';
import { ArrowLeft, Clock, FileText, Search, User, Eye, AlertCircle } from 'lucide-react';
import EditHistoryModal from './EditHistoryModal';
import { motion, AnimatePresence } from 'framer-motion';

const EditedBills = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const data = await getEditedBills();
      setBills(data);
    } catch (error) {
      console.error('Failed to fetch edited bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBills = bills.filter(bill => 
    bill.billNumber?.toLowerCase().includes(search.toLowerCase()) || 
    bill.tableNo?.toLowerCase().includes(search.toLowerCase()) ||
    bill.customerName?.toLowerCase().includes(search.toLowerCase())
  );

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
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={onGoBack}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800">{t("Edited Bills History")}</h1>
            <p className="text-sm text-slate-500 font-medium">
              {t("Track all modifications made to previously saved bills.")}
            </p>
          </div>
        </div>
        
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder={t("Search by Bill No or Table...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-medium">{t("Loading history...")}</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <FileText size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{t("No edited bills found")}</h3>
            <p className="text-slate-500">
              {search ? t("Try adjusting your search criteria.") : t("Bills that are reopened and modified will appear here.")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {filteredBills.map((bill, index) => {
                const totalEdits = bill.editHistory?.length || 0;
                const lastEdit = totalEdits > 0 ? bill.editHistory[totalEdits - 1] : null;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={bill._id || bill.billNumber}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                  >
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                        <FileText size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-800 text-lg">
                            {bill.billNumber || 'Unbilled'}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusColor(bill.status)}`}>
                            {bill.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">T</span>
                            <span className="text-slate-700">{bill.tableNo}</span>
                          </div>
                          {(bill.customerName || bill.customerPhone) && (
                            <div className="flex items-center gap-1.5">
                              <User size={14} />
                              <span>{bill.customerName || 'Customer'} {bill.customerPhone && `(${bill.customerPhone})`}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:pl-4 sm:border-l border-slate-100 w-full sm:w-auto mt-2 sm:mt-0">
                      <div className="flex-1 sm:flex-none">
                        <p className="text-xs text-slate-500 font-medium mb-1">{t("Edits Count")}</p>
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-amber-500" />
                          <span className="font-bold text-slate-700">{totalEdits} {t("times")}</span>
                        </div>
                      </div>
                      
                      <div className="flex-1 sm:flex-none">
                        <p className="text-xs text-slate-500 font-medium mb-1">{t("Last Edit")}</p>
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-slate-400" />
                          <span className="font-bold text-slate-700">
                            {lastEdit ? new Date(lastEdit.editedAt).toLocaleString('en-IN', {
                              hour: '2-digit', minute: '2-digit', hour12: true, month: 'short', day: 'numeric'
                            }) : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold rounded-xl transition-colors flex items-center gap-2 text-sm shrink-0"
                      >
                        <Eye size={16} />
                        <span className="hidden sm:inline">{t("View Edits")}</span>
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
