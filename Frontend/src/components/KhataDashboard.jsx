import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLanguage } from "../context/LanguageContext";
import { Search, Eye, Phone, CreditCard, ChevronLeft, ChevronRight, Download, RefreshCcw, BookOpen, AlertCircle, X, CheckCircle, Loader2 } from 'lucide-react';
import { getKhataAccounts, getKhataLedger, settleKhata } from '../api/khata';
import { getBillById } from '../api/billing';
import useDebounce from '../hooks/useDebounce';
import Toast from './Toast';
import PaymentModal from './PaymentModal';
const Invoice = lazy(() => import('./Invoice'));

const KhataDashboard = () => {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const [pagination, setPagination] = useState({ totalDocs: 0, totalPages: 1, currentPage: 1 });
  const [stats, setStats] = useState({ totalOutstanding: 0, activeAccounts: 0 });
  const [toast, setToast] = useState(null);
  
  // Invoice viewer state
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBillId, setLoadingBillId] = useState(null);

  // Ledger Modal State
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  
  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState(null);
  const [paymentBill, setPaymentBill] = useState(null); // Track specific bill being paid
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const itemsPerPage = 20;

  useEffect(() => {
    fetchAccounts();
  }, [pagination.currentPage, debouncedSearchTerm]);

  const fetchAccounts = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await getKhataAccounts({ page: pagination.currentPage, limit: itemsPerPage, search: debouncedSearchTerm });
      setAccounts(data.accounts || []);
      setStats(data.stats || { totalOutstanding: 0, activeAccounts: 0 });
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (error) {
      console.error('Error fetching Khata accounts:', error);
      setToast({ message: 'Failed to load Khata accounts', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewBill = async (billId) => {
    setLoadingBillId(billId);
    try {
      const fullBill = await getBillById(billId);
      setSelectedBill(fullBill);
    } catch (error) {
      setToast({ message: 'Failed to load invoice', type: 'error' });
    } finally {
      setLoadingBillId(null);
    }
  };

  const handleViewLedger = async (account) => {
    setSelectedAccount(account);
    setLoadingLedger(true);
    try {
      const data = await getKhataLedger(account.phoneNumber);
      setLedger(data.bills || []);
    } catch (error) {
      setToast({ message: 'Failed to load ledger', type: 'error' });
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleSettlePayment = async (paymentDetails) => {
    setSubmittingPayment(true);
    try {
      const amountToSettle = paymentBill ? paymentBill.total : paymentAccount.balance;
      const notePrefix = paymentBill ? `Khata settlement for Bill #${paymentBill.billNumber}` : `Khata settlement for Account`;
      const modeStr = paymentDetails.mode || 'Cash';
      let noteStr = `${notePrefix} via ${modeStr}`;
      
      if (modeStr === 'Mixed' && paymentDetails.splitPayments) {
        const splits = [];
        if (paymentDetails.splitPayments.cash > 0) splits.push(`Cash: ₹${paymentDetails.splitPayments.cash}`);
        if (paymentDetails.splitPayments.upi > 0) splits.push(`UPI: ₹${paymentDetails.splitPayments.upi}`);
        if (paymentDetails.splitPayments.card > 0) splits.push(`Card: ₹${paymentDetails.splitPayments.card}`);
        if (splits.length > 0) noteStr += ` (${splits.join(', ')})`;
      }

      await settleKhata({
        phoneNumber: paymentAccount.phoneNumber,
        amount: paymentDetails.amountPaid || amountToSettle,
        paymentMode: modeStr,
        splitPayments: paymentDetails.splitPayments,
        upiApp: paymentDetails.upiApp,
        note: noteStr,
        targetBillId: paymentBill ? paymentBill._id : undefined
      });
      setToast({ message: `✅ Payment recorded for ${paymentAccount.customerName}`, type: 'success' });
      setPaymentModalOpen(false);
      setPaymentAccount(null);
      setPaymentBill(null);
      // Don't close the ledger modal so the user can see it updated, just refresh the ledger
      if (selectedAccount) {
         handleViewLedger(selectedAccount);
      }
      fetchAccounts(true);
    } catch (error) {
      const msg = error?.message || 'Failed to record payment';
      setToast({ message: msg, type: 'error' });
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background p-3 sm:p-4 font-sans text-text-main overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* COMPACT SINGLE ROW HEADER */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4 bg-surface p-2.5 sm:p-3 rounded-xl border border-border shadow-xs shrink-0">
        
        {/* Title & Stats */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full md:w-auto">
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-1.5 sm:p-2 bg-red-50 text-red-600 rounded-lg">
              <BookOpen size={18} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-text-main leading-tight">{t('Khata Book')}</h1>
              <span className="text-[10px] sm:text-xs text-text-muted font-bold">{stats.activeAccounts} {t('Active Accounts')}</span>
            </div>
          </div>
          
          <div className="h-8 w-px bg-border hidden sm:block"></div>
          
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-text-muted font-bold uppercase tracking-wider">{t('Total Market Dues')}</span>
            <span className="text-base sm:text-lg font-black text-red-600">₹{stats.totalOutstanding.toFixed(2)}</span>
          </div>
        </div>

        {/* Controls (Search, Refresh, Export) */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
            <input
              type="text"
              placeholder={t("Search customer or phone...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 sm:py-2 border border-border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-background font-medium"
            />
          </div>
          
          <button 
            onClick={() => fetchAccounts(true)} 
            className="p-1.5 sm:p-2 border border-border text-text-muted rounded-lg hover:bg-surface-hover transition-colors touch-target shrink-0"
            title={t('Refresh')}
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin text-primary' : ''} />
          </button>
          
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 bg-surface border border-border text-text-main rounded-lg hover:bg-surface-hover transition-colors text-xs font-bold shrink-0">
            <Download size={14} />
            <span className="hidden sm:inline">{t('Export')}</span>
          </button>
        </div>
      </div>

      {/* COMPACT DATA TABLE */}
      <div className="flex-1 bg-surface rounded-xl border border-border overflow-hidden flex flex-col shadow-xs min-h-0">
        
        {/* Table Header (Grid) */}
        <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_150px] gap-2 p-2.5 sm:p-3 border-b border-border bg-background text-[10px] font-black text-text-muted uppercase tracking-wider shrink-0">
          <div>{t('Customer')}</div>
          <div>{t('Phone')}</div>
          <div>{t('Last Update')}</div>
          <div className="text-right">{t('Pending Balance')}</div>
          <div className="text-center">{t('Actions')}</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <RefreshCcw className="animate-spin mb-3 text-primary" size={28} />
              <p className="text-sm font-bold">{t('Loading Khata accounts...')}</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <AlertCircle className="mb-3 opacity-50" size={36} />
              <p className="text-sm font-bold">{t('No pending dues found')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {accounts.map((account) => (
                <div key={account._id} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_150px] gap-2 p-3 items-center hover:bg-primary/5 transition-colors group">
                  
                  {/* Mobile labels injected for smaller screens */}
                  <div className="flex justify-between md:block">
                    <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('Customer')}</span>
                    <span className="font-bold text-xs sm:text-sm text-text-main truncate">{account.customerName}</span>
                  </div>
                  
                  <div className="flex justify-between md:block">
                    <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('Phone')}</span>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
                      <Phone size={12} className="opacity-70" />
                      {account.phoneNumber}
                    </div>
                  </div>
                  
                  <div className="flex justify-between md:block">
                    <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('Last Update')}</span>
                    <span className="text-xs text-text-muted font-medium">{account.updatedAt ? new Date(account.updatedAt).toLocaleDateString('en-GB') : '—'}</span>
                  </div>
                  
                  <div className="flex justify-between md:block md:text-right">
                    <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('Pending Balance')}</span>
                    <span className="font-black text-sm text-red-600">₹{account.balance.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex items-center justify-end md:justify-center gap-2 mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                    <button 
                      onClick={() => handleViewLedger(account)}
                      className="px-2.5 py-1.5 bg-surface border border-border text-text-main rounded-lg hover:bg-surface-hover transition-colors text-[10px] font-bold flex items-center gap-1 shadow-xs"
                    >
                      <Eye size={13} />
                      {t('Ledger')}
                    </button>
                    <button 
                      onClick={() => {
                        setPaymentAccount(account);
                        setPaymentModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-[10px] font-bold flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle size={13} />
                      {t('Settle')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* PAGINATION */}
        {!loading && accounts.length > 0 && (
          <div className="p-2 sm:p-3 border-t border-border bg-background flex items-center justify-between shrink-0">
            <span className="text-[10px] sm:text-xs font-bold text-text-muted">
              {t('Showing')} {((pagination.currentPage - 1) * itemsPerPage) + 1} {t('to')} {Math.min(pagination.currentPage * itemsPerPage, pagination.totalDocs)} {t('of')} {pagination.totalDocs}
            </span>
            
            <div className="flex gap-1">
              <button
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
                className="p-1 sm:p-1.5 border border-border rounded-lg text-text-muted hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed bg-surface touch-target"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded-lg flex items-center">
                {pagination.currentPage} / {pagination.totalPages}
              </span>
              <button
                disabled={pagination.currentPage >= pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))}
                className="p-1 sm:p-1.5 border border-border rounded-lg text-text-muted hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed bg-surface touch-target"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LEDGER MODAL - BILL HISTORY COMPACT STYLE */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-border">
            
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between bg-background gap-3 shrink-0">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-text-main flex items-center gap-2">
                  <BookOpen size={20} className="text-red-500" />
                  {selectedAccount.customerName}'s Ledger
                </h2>
                <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-xs font-bold">
                  <span className="text-text-muted flex items-center gap-1 font-mono">
                    <Phone size={12}/> {selectedAccount.phoneNumber}
                  </span>
                  <span className="text-border">|</span>
                  <span className="text-red-600 flex items-center gap-1">
                    Total Due: ₹{selectedAccount.balance.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button 
                  onClick={() => {
                    setPaymentAccount(selectedAccount);
                    setPaymentModalOpen(true);
                  }}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-xl hover:bg-emerald-100 transition-colors shadow-xs flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <CheckCircle size={16} />
                  {t('Clear Dues')}
                </button>
                <button onClick={() => setSelectedAccount(null)} className="p-1.5 sm:p-2 text-text-muted hover:bg-surface-hover rounded-xl transition-colors border border-transparent hover:border-border">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            {/* Modal Body - Ledger Table (Bill History Compact Style) */}
            <div className="flex-1 overflow-y-auto bg-background p-2 sm:p-4 min-h-0">
              <div className="bg-surface rounded-xl border border-border overflow-hidden">
                {/* Compact Grid Header */}
                <div className="hidden md:grid grid-cols-[1fr_2fr_1.5fr_1fr_1fr_1fr_1fr_120px] gap-2 p-3 border-b border-border/50 bg-background text-[10px] font-black text-text-muted uppercase tracking-wider">
                  <div>{t('BILL #')}</div>
                  <div>{t('DATE & TIME')}</div>
                  <div>{t('CUSTOMER')}</div>
                  <div>{t('TYPE')}</div>
                  <div>{t('STATUS')}</div>
                  <div>{t('PAYMENT')}</div>
                  <div>{t('TOTAL')}</div>
                  <div className="text-center">{t('ACTION')}</div>
                </div>

                {loadingLedger ? (
                  <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                    <RefreshCcw className="animate-spin text-primary mb-2" size={24} />
                    <span className="text-xs font-bold">{t('Loading bills...')}</span>
                  </div>
                ) : ledger.length === 0 ? (
                  <div className="text-center py-10 text-text-muted text-xs font-bold">
                    {t('No unpaid bills found in ledger.')}
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {ledger.map((bill) => (
                      <div key={bill._id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1.5fr_1fr_1fr_1fr_1fr_120px] gap-2 p-3 items-center hover:bg-surface-hover transition-colors group">
                        
                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('BILL #')}</span>
                          <span className="font-bold font-mono text-xs sm:text-sm text-text-main">#{bill.billNumber}</span>
                        </div>
                        
                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('DATE & TIME')}</span>
                          <div>
                            <div className="text-xs text-text-main font-semibold">{new Date(bill.createdAt).toLocaleDateString('en-GB')}</div>
                            <div className="text-[10px] text-text-muted">{new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}</div>
                          </div>
                        </div>

                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('CUSTOMER')}</span>
                          <div>
                            <div className="text-xs font-semibold text-text-main truncate">{selectedAccount.customerName}</div>
                            <div className="text-[10px] font-mono text-text-muted">{selectedAccount.phoneNumber}</div>
                          </div>
                        </div>

                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('TYPE')}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${bill.billType === 'Dine-In' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {t(bill.billType)}
                          </span>
                        </div>

                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('STATUS')}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {t(bill.status)}
                          </span>
                        </div>

                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('PAYMENT')}</span>
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-red-600 font-bold">
                            <BookOpen size={12} className="text-red-500 shrink-0" />
                            <span>{t('Unpaid (Khata)')}</span>
                          </div>
                        </div>

                        <div className="flex justify-between md:block">
                          <span className="md:hidden text-[10px] font-bold text-text-muted uppercase">{t('TOTAL')}</span>
                          <span className="font-black text-sm text-text-main">₹{bill.total.toFixed(2)}</span>
                        </div>

                        {/* ACTION column - matches Bill History */}
                        <div className="flex items-center justify-end md:justify-center gap-1.5 mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                          <button
                            onClick={() => handleViewBill(bill._id)}
                            disabled={loadingBillId === bill._id}
                            className="w-7 h-7 flex items-center justify-center bg-surface border border-border rounded-lg text-text-muted hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-60"
                            title={t('View Invoice')}
                          >
                            {loadingBillId === bill._id
                              ? <Loader2 size={12} className="animate-spin text-primary" />
                              : <Eye size={13} />}
                          </button>
                          <button
                            onClick={() => {
                              setPaymentAccount(selectedAccount);
                              setPaymentBill(bill); // Set the specific bill
                              setPaymentModalOpen(true);
                            }}
                            className="px-2 py-1 flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors whitespace-nowrap"
                            title={t('Clear Due')}
                          >
                            <CheckCircle size={12} />
                            {t('Clear Due')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CENTRALIZED PAYMENT MODAL */}
      {paymentModalOpen && paymentAccount && (
        <PaymentModal
          total={paymentBill ? paymentBill.total : paymentAccount.balance}
          billNumber={paymentBill ? paymentBill.billNumber : `KHATA-${paymentAccount._id}`}
          tableNo={paymentBill ? paymentBill.tableNo : ""}
          customerPhone={paymentAccount.phoneNumber}
          customerName={paymentAccount.customerName}
          isLoading={submittingPayment}
          hideUnpaid={true}
          onClose={() => {
            setPaymentModalOpen(false);
            setPaymentAccount(null);
            setPaymentBill(null);
          }}
          onComplete={handleSettlePayment}
        />
      )}
      {/* INVOICE VIEWER */}
      {selectedBill && (
        <Suspense fallback={null}>
          <Invoice
            bill={selectedBill}
            onClose={() => setSelectedBill(null)}
            isHistoryView={true}
          />
        </Suspense>
      )}

    </div>
  );
};

export default KhataDashboard;
