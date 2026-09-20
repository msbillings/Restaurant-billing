import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  Wallet,
  CreditCard,
  Banknote,
  PieChart,
  Loader2,
  BookOpen,
  Sparkles,
  Check,
  Award
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/axios';

const PaymentModal = ({
  total,
  billNumber,
  tableNo,
  customerPhone,
  customerName,
  isLoading,
  onClose,
  onComplete,
  hideUnpaid = false
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState('Cash');

  // Loyalty & Wallet state
  const [loyalty, setLoyalty] = useState(null);
  const [walletRedemption, setWalletRedemption] = useState(0);

  // Fetch customer loyalty data
  useEffect(() => {
    if (!customerPhone) return;
    const cleanPhone = String(customerPhone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) return;

    let isMounted = true;
    api.get(`/loyalty/customer/${cleanPhone}`)
      .then(res => {
        if (isMounted && res.data && res.data.config?.enabled) {
          setLoyalty(res.data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [customerPhone]);

  // Max redemption calculation based on restaurant rules
  const maxPercent = loyalty?.config?.maxRedemptionPercent ?? 100;
  const maxByPercent = Math.floor((total * maxPercent) / 100);
  const maxRedeemable = loyalty ? Math.min(loyalty.walletBalance || 0, maxByPercent) : 0;

  // Effective total to pay via payment mode after wallet discount
  const effectiveTotal = Math.max(0, Number((total - walletRedemption).toFixed(2)));

  const [amountPaid, setAmountPaid] = useState(effectiveTotal);
  const [splitPayments, setSplitPayments] = useState({ cash: 0, upi: 0, card: 0 });
  const [upiApp, setUpiApp] = useState('PhonePe');
  const [enableQrPayment] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings'));
      const hasValidUpi = s?.upiId && s.upiId.trim() !== '' && s.upiId.trim() !== 'msbillings@upi';
      return s?.enableQrPayment !== false && Boolean(hasValidUpi);
    } catch (e) {
      return false;
    }
  });

  const currencySymbol = localStorage.getItem('primaryCurrency') === 'USD' ? '$' : '₹';
  const quickAmounts = currencySymbol === '$' ? [10, 50, 100] : [500, 1000, 2000];

  // Update amountPaid when walletRedemption changes
  useEffect(() => {
    if (mode !== 'Cash') {
      setAmountPaid(effectiveTotal);
    } else {
      setAmountPaid(prev => (prev < effectiveTotal ? effectiveTotal : prev));
    }
  }, [walletRedemption, effectiveTotal, mode]);

  const balance = amountPaid - effectiveTotal;
  const mixedTotal = (splitPayments.cash || 0) + (splitPayments.upi || 0) + (splitPayments.card || 0);
  const isMixedValid = Math.abs(mixedTotal - effectiveTotal) < 0.01;
  const remainingMixed = Number((effectiveTotal - mixedTotal).toFixed(2));

  const getIcon = (m) => {
    switch (m) {
      case 'Cash': return <Banknote size={20} />;
      case 'Card': return <CreditCard size={20} />;
      case 'UPI': return <Wallet size={20} />;
      case 'Mixed': return <PieChart size={20} />;
      case 'Unpaid': return <BookOpen size={20} />;
      default: return <Banknote size={20} />;
    }
  };

  const handleApplyWallet = () => {
    if (walletRedemption > 0) {
      setWalletRedemption(0);
    } else {
      setWalletRedemption(maxRedeemable);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border flex justify-between items-center bg-gradient-to-r from-primary/5 to-accent/5">
          <h2 className="font-bold text-lg text-text-main">{t("Complete Payment")}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Amount Due Area with Wallet Breakdown */}
          <div className="text-center mb-6">
            <span className="text-text-muted text-sm uppercase tracking-wider font-semibold">
              {walletRedemption > 0 ? t("Net Payable Amount") : t("Amount Due")}
            </span>
            <div className="text-4xl font-bold text-primary mt-1">
              {currencySymbol}{effectiveTotal.toFixed(2)}
            </div>
            {walletRedemption > 0 && (
              <div className="flex items-center justify-center gap-2 mt-1 text-xs text-text-muted">
                <span>{t("Bill Total:")} <strong className="line-through">{currencySymbol}{total.toFixed(2)}</strong></span>
                <span>•</span>
                <span className="text-emerald-600 font-bold">{t("Wallet Used:")} -{currencySymbol}{walletRedemption.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Loyalty Wallet Available Banner */}
          {loyalty && loyalty.walletBalance > 0 && (
            <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-primary/10 border border-emerald-500/30 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-text-main">{t("Loyalty Wallet Available")}</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.2 rounded-full font-bold">
                        {loyalty.points || 0} pts
                      </span>
                    </div>
                    <div className="text-sm font-black text-emerald-600 font-mono mt-0.5">
                      ₹{loyalty.walletBalance} {t("available")}
                      {maxPercent < 100 && (
                        <span className="text-[10px] font-normal text-text-muted ml-1.5">
                          ({t("Max")} {maxPercent}%: ₹{maxRedeemable})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {walletRedemption > 0 ? (
                    <button
                      type="button"
                      onClick={handleApplyWallet}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1">
                      <X size={13} />
                      <span>{t("Remove")}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={maxRedeemable <= 0}
                      onClick={handleApplyWallet}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1">
                      <Check size={13} />
                      <span>{t("Use Wallet (₹")}{maxRedeemable})</span>
                    </button>
                  )}
                </div>
              </div>
              {walletRedemption > 0 && (
                <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>✅ ₹{walletRedemption} {t("applied to this bill")}</span>
                  <span>{t("Wallet Balance left:")} ₹{Math.max(0, loyalty.walletBalance - walletRedemption)}</span>
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            <label className="text-sm font-medium text-text-muted mb-3 block">{t("Select Payment Mode")}</label>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] gap-3">
              {['Cash', 'UPI', 'Card', 'Mixed', 'Unpaid'].filter(m => !(hideUnpaid && m === 'Unpaid')).map((m) => (
                <button
                  key={m}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                    mode === m
                      ? 'bg-primary/10 border-primary text-primary shadow-sm'
                      : 'bg-background border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                  }`}
                  onClick={() => {
                    if (m === 'Unpaid' && (!customerPhone || !customerName)) {
                      alert(t("Customer Name and Phone are required for Unpaid (Khata) bills. Please close and link CRM first."));
                      return;
                    }
                    setMode(m);
                    if (m !== 'Cash') {
                      setAmountPaid(effectiveTotal);
                    }
                  }}>
                  {getIcon(m)}
                  <span className="text-sm font-bold">{m}</span>
                </button>
              ))}
            </div>
          </div>

          {mode === 'Cash' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-text-muted">{t("Amount Received")}</label>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-lg">{currencySymbol}</span>
                  <input
                    type="number"
                    min="0"
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-xl font-black text-text-main focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    value={amountPaid === 0 ? '' : amountPaid}
                    onChange={(e) => setAmountPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                    autoFocus
                  />
                </div>

                <div className="flex gap-2">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="flex-1 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-all cursor-pointer"
                      onClick={() => setAmountPaid(amt)}>
                      +{currencySymbol}{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="flex-1 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs font-bold text-primary hover:bg-primary/20 transition-all cursor-pointer"
                    onClick={() => setAmountPaid(effectiveTotal)}>
                    {t("Exact")}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-background border border-border rounded-xl flex justify-between items-center">
                <span className="text-sm font-medium text-text-muted">{t("Change to Return")}</span>
                <span className={`text-xl font-black ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                  {currencySymbol}{Math.max(0, balance).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {mode === 'UPI' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {enableQrPayment ? (
                <div className="bg-background p-6 rounded-2xl border border-primary/20 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
                  <div className="bg-primary/10 py-1 px-3 rounded-full text-xs font-bold text-primary tracking-wide uppercase mb-3">
                    {t("Scan & Pay with Any App")}
                  </div>

                  <div className="bg-white p-3 rounded-2xl shadow-md border border-border/40 my-2 flex flex-col items-center">
                    <QRCodeSVG
                      value={(() => {
                        let pa = 'maheshsiva864@oksbi';
                        let pn = 'MS Billings';
                        try {
                          const s = JSON.parse(localStorage.getItem('restaurantSettings'));
                          if (s?.upiId && s.upiId !== 'msbillings@upi') pa = s.upiId.trim();
                          if (s?.restaurantName) pn = s.restaurantName.trim();
                        } catch (e) {}
                        const am = Number(effectiveTotal || 0).toFixed(2);
                        const noteText = billNumber ? `Bill #${billNumber} - Rs ${am}` : tableNo ? `Table ${tableNo} - Rs ${am}` : `Payment Rs ${am}`;
                        const tn = noteText.replace(/[^a-zA-Z0-9 .#-]/g, '');
                        const tr = `PAY${Date.now()}`;
                        return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                      })()}
                      size={160}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div className="mt-4 text-center">
                    {t("Amount Due:")} <span className="text-primary font-black text-lg">{currencySymbol}{effectiveTotal.toFixed(2)}</span>
                    <div className="text-xs text-text-muted mt-1">{t("Supports PhonePe, GPay, Paytm & all UPI apps")}</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-background border border-border rounded-xl">
                  <Wallet size={48} className="text-text-muted mb-4 opacity-20" />
                  <div className="font-bold text-text-main text-base mb-1">{t("UPI Payment Due:")} {currencySymbol}{effectiveTotal.toFixed(2)}</div>
                  <div className="text-sm text-text-muted">{t("Waiting for customer to scan and pay...")}</div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-text-muted mb-2 block uppercase tracking-wider">{t("Record UPI App Used By Customer")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {['PhonePe', 'GPay', 'Paytm', 'Amazon Pay', 'BharatPe', 'Other'].map((app) => (
                    <button
                      key={app}
                      className={`py-2 rounded-xl border text-sm font-bold transition-all ${
                        upiApp === app
                          ? 'bg-primary/10 border-primary text-primary shadow-sm'
                          : 'bg-background border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                      }`}
                      onClick={() => setUpiApp(app)}>
                      {app}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === 'Mixed' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className={`p-4 rounded-xl border flex flex-col gap-2.5 shadow-xs transition-all ${
                isMixedValid
                  ? 'bg-success/5 border-success/30'
                  : remainingMixed > 0
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-danger/10 border-danger/30'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-text-main">{t("Total Allocated")}</span>
                  <span className={`text-xl font-black ${isMixedValid ? 'text-success' : remainingMixed > 0 ? 'text-amber-600' : 'text-danger'}`}>
                    {currencySymbol}{mixedTotal.toFixed(2)} / {currencySymbol}{effectiveTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-border/60">
                  <span className="text-xs font-semibold text-text-muted">
                    {isMixedValid ? t("Payment fully allocated") : remainingMixed > 0 ? t("Remaining to allocate") : t("Over allocated")}
                  </span>
                  <span className={`text-sm font-bold ${isMixedValid ? 'text-success' : 'text-text-muted'}`}>
                    {currencySymbol}{Math.abs(remainingMixed).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {['cash', 'upi', 'card'].map((method) => (
                  <div key={method} className="flex items-center gap-3">
                    <div className="w-20 capitalize text-sm font-bold text-text-muted">{t(method)}</div>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">{currencySymbol}</span>
                      <input
                        type="number"
                        min="0"
                        onWheel={(e) => e.target.blur()}
                        className="w-full bg-background border border-border rounded-xl py-2 pl-8 pr-3 text-base font-bold text-text-main focus:outline-none focus:border-primary"
                        value={splitPayments[method] === 0 ? '' : splitPayments[method]}
                        onChange={(e) => setSplitPayments({
                          ...splitPayments,
                          [method]: Math.max(0, parseFloat(e.target.value) || 0)
                        })}
                        placeholder={`${method.charAt(0).toUpperCase() + method.slice(1)} Amount`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic QR Code specifically for Entered UPI Split Amount */}
              {splitPayments.upi > 0 && enableQrPayment && (
                <div className="bg-background p-4 rounded-2xl border border-primary/20 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden animate-in fade-in duration-200">
                  <div className="bg-primary/10 py-1 px-3 rounded-full text-[11px] font-bold text-primary tracking-wide uppercase mb-2">
                    {t("Scan & Pay UPI Portion")} ({currencySymbol}{Number(splitPayments.upi).toFixed(2)})
                  </div>

                  <div className="bg-white p-2.5 rounded-2xl shadow-md border border-border/40 my-1 flex flex-col items-center">
                    <QRCodeSVG
                      value={(() => {
                        let pa = 'maheshsiva864@oksbi';
                        let pn = 'MS Billings';
                        try {
                          const s = JSON.parse(localStorage.getItem('restaurantSettings'));
                          if (s?.upiId && s.upiId !== 'msbillings@upi') pa = s.upiId.trim();
                          if (s?.restaurantName) pn = s.restaurantName.trim();
                        } catch (e) {}
                        const am = Number(splitPayments.upi || 0).toFixed(2);
                        const noteText = billNumber ? `Bill #${billNumber} - Rs ${am}` : tableNo ? `Table ${tableNo} - Rs ${am}` : `Payment Rs ${am}`;
                        const tn = noteText.replace(/[^a-zA-Z0-9 .#-]/g, '');
                        const tr = `PAY${Date.now()}`;
                        return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                      })()}
                      size={135}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div className="text-xs text-text-muted mt-2">
                    {t("Mobile will only show entered amount:")} <strong className="text-primary font-black text-sm">{currencySymbol}{Number(splitPayments.upi).toFixed(2)}</strong>
                  </div>

                  <div className="w-full mt-3 pt-2 border-t border-border/50">
                    <label className="text-[10px] font-semibold text-text-muted mb-1.5 block uppercase tracking-wider text-left">{t("Record UPI App Used")}</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['PhonePe', 'GPay', 'Paytm', 'Amazon Pay', 'BharatPe', 'Other'].map((app) => (
                        <button
                          type="button"
                          key={app}
                          className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            upiApp === app
                              ? 'bg-primary/10 border-primary text-primary shadow-xs'
                              : 'bg-surface border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                          }`}
                          onClick={() => setUpiApp(app)}>
                          {app}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface">
          <button
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg ${
              isLoading
                ? 'bg-blue-600 text-white shadow-blue-500/30 cursor-not-allowed opacity-90'
                : (mode === 'Cash' && balance < 0) || (mode === 'Mixed' && !isMixedValid)
                ? 'bg-surface-hover text-slate-800 shadow-none cursor-not-allowed border border-border'
                : mode === 'Unpaid'
                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-600/30 hover:shadow-amber-600/50 hover:-translate-y-0.5'
                : 'bg-success text-white hover:bg-green-600 shadow-success/30 hover:shadow-success/50 hover:-translate-y-0.5'
            }`}
            disabled={isLoading || (mode === 'Cash' && balance < 0) || (mode === 'Mixed' && !isMixedValid)}
            onClick={() => onComplete({
              mode,
              amountPaid,
              splitPayments,
              upiApp,
              walletRedemption
            })}>
            {isLoading ? (
              <>
                <Loader2 size={22} className="animate-spin text-white" />
                <span>{t("Processing...")}</span>
              </>
            ) : (
              <>
                <CheckCircle size={22} />
                <span>{mode === 'Unpaid' ? t("Save as Unpaid (Khata)") : `${t("Complete")} ${t(mode)} ${t("Payment")}`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;