import React, { useState } from 'react';
import { X, CheckCircle, Wallet, CreditCard, Banknote, PieChart } from 'lucide-react';

const PaymentModal = ({ total, billNumber, tableNo, onClose, onComplete }) => {
  const [mode, setMode] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState(total);
  const [splitPayments, setSplitPayments] = useState({ cash: 0, upi: 0, card: 0 });
  const [upiApp, setUpiApp] = useState('PhonePe');
  const [enableQrPayment] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings'));
      return s?.enableQrPayment !== false;
    } catch (e) { return true; }
  });

  const balance = amountPaid - total;
  const mixedTotal = splitPayments.cash + splitPayments.upi + splitPayments.card;
  const isMixedValid = mixedTotal === total;

  const getIcon = (m) => {
    switch(m) {
      case 'Cash': return <Banknote size={20} />;
      case 'Card': return <CreditCard size={20} />;
      case 'UPI': return <Wallet size={20} />;
      case 'Mixed': return <PieChart size={20} />;
      default: return <Banknote size={20} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border flex justify-between items-center bg-gradient-to-r from-primary/5 to-accent/5">
          <h2 className="font-bold text-lg text-text-main">Complete Payment</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="text-center mb-8">
            <span className="text-text-muted text-sm uppercase tracking-wider font-semibold">Amount Due</span>
            <div className="text-4xl font-bold text-primary mt-1">₹{total.toFixed(2)}</div>
          </div>

          <div className="mb-6">
            <label className="text-sm font-medium text-text-muted mb-3 block">Select Payment Mode</label>
            <div className="grid grid-cols-4 gap-3">
              {['Cash', 'UPI', 'Card', 'Mixed'].map(m => (
                <button 
                  key={m}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                    mode === m 
                      ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                      : 'bg-background border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                  }`}
                  onClick={() => {
                    setMode(m);
                    if (m !== 'Cash') {
                      setAmountPaid(total);
                    }
                  }}
                >
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
                  <label className="text-sm font-medium text-text-muted">Amount Received</label>
                </div>
                
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-lg">₹</span>
                  <input 
                    type="number" 
                    className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-xl font-black text-text-main focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    value={amountPaid === 0 ? '' : amountPaid} 
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 mt-2">
                  <button onClick={() => setAmountPaid(total)} className="py-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-bold text-text-main transition-colors">Exact</button>
                  <button onClick={() => setAmountPaid(500)} className="py-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-bold text-text-main transition-colors">₹500</button>
                  <button onClick={() => setAmountPaid(1000)} className="py-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-bold text-text-main transition-colors">₹1000</button>
                  <button onClick={() => setAmountPaid(2000)} className="py-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-bold text-text-main transition-colors">₹2000</button>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-background rounded-xl border border-border">
                <span className="font-medium text-text-muted">Balance to Return</span>
                <span className={`text-2xl font-black ${balance < 0 ? 'text-danger' : 'text-success'}`}>
                  ₹{Math.max(0, balance).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {mode === 'UPI' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {enableQrPayment ? (
                <div className="bg-background p-5 rounded-2xl border border-border flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 bg-primary/10 py-1 px-3 text-xs font-bold text-primary tracking-wide uppercase">
                    Scan & Pay Instantly
                  </div>
                  
                  <div className="bg-white p-3 rounded-2xl shadow-md border border-border/40 mt-5 mb-2 flex flex-col items-center">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent((() => {
                        let pa = 'maheshsiva864@oksbi';
                        let pn = 'MS Billings';
                        try {
                          const s = JSON.parse(localStorage.getItem('restaurantSettings'));
                          if (s?.upiId && s.upiId !== 'msbillings@upi') pa = s.upiId.trim();
                          if (s?.restaurantName) pn = s.restaurantName.trim();
                        } catch (e) {}
                        const am = Number(total || 0).toFixed(2);
                        const noteText = billNumber ? `Bill #${billNumber} - Rs ${am}` : tableNo ? `Table ${tableNo} - Rs ${am}` : `Payment Rs ${am}`;
                        const tn = noteText.replace(/[^a-zA-Z0-9 .#-]/g, '');
                        const tr = `PAY${Date.now()}`;
                        return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                      })())}`} 
                      alt="UPI QR Code" 
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  
                  <div className="font-bold text-text-main text-base flex items-center gap-1.5">
                    Amount Due: <span className="text-primary font-black text-lg">₹{total.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 font-medium">Supports PhonePe, GPay, Paytm & all UPI apps</p>
                </div>
              ) : (
                <div className="bg-background p-5 rounded-2xl border border-border text-center">
                  <div className="font-bold text-text-main text-base mb-1">UPI Payment Due: ₹{total.toFixed(2)}</div>
                  <p className="text-xs text-text-muted">Dynamic QR Code display is turned off in Settings.</p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-text-muted mb-2 block uppercase tracking-wider">Record UPI App Used By Customer</label>
                <div className="grid grid-cols-3 gap-2">
                  {['PhonePe', 'GPay', 'Paytm', 'Amazon Pay', 'BharatPe', 'Other'].map(app => (
                    <button
                      key={app}
                      className={`py-2 rounded-xl border text-sm font-bold transition-all ${
                        upiApp === app 
                          ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                          : 'bg-background border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                      }`}
                      onClick={() => setUpiApp(app)}
                    >
                      {app}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === 'Mixed' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-text-muted">Enter Split Amounts</label>
                
                <div className="grid gap-3">
                  {['cash', 'upi', 'card'].map((method) => (
                    <div key={method} className="flex items-center gap-3">
                      <div className="w-20 uppercase font-bold text-sm text-text-main flex items-center gap-2">
                        {method === 'cash' ? <Banknote size={16} /> : method === 'upi' ? <Wallet size={16} /> : <CreditCard size={16} />}
                        {method}
                      </div>
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-lg">₹</span>
                        <input 
                          type="number" 
                          className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 font-black text-text-main focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                          value={splitPayments[method] === 0 ? '' : splitPayments[method]} 
                          onChange={(e) => setSplitPayments({...splitPayments, [method]: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-background rounded-xl border border-border">
                <span className="font-medium text-text-muted">Sum / Total</span>
                <span className={`text-xl font-black ${mixedTotal !== total ? 'text-danger' : 'text-success'}`}>
                  ₹{mixedTotal.toFixed(2)} / ₹{total.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface">
          <button 
            className={`w-full text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg ${
              ((mode === 'Cash' && balance < 0) || (mode === 'Mixed' && !isMixedValid))
                ? 'bg-surface-hover text-text-muted shadow-none cursor-not-allowed border border-border' 
                : 'bg-success hover:bg-green-600 shadow-success/30 hover:shadow-success/50 hover:-translate-y-0.5'
            }`}
            disabled={(mode === 'Cash' && balance < 0) || (mode === 'Mixed' && !isMixedValid)}
            onClick={() => onComplete({ mode, amountPaid, splitPayments, upiApp })}
          >
            <CheckCircle size={22} />
            <span>Complete {mode} Payment</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
