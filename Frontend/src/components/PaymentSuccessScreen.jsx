import React, { useEffect, useRef, useState } from "react";
import { CheckCircle, Banknote, Wallet, CreditCard, PieChart, BookOpen, Receipt, Utensils, Bike, ShoppingBag, Clock, Calendar, Hash, User, Phone } from "lucide-react";
import confetti from "canvas-confetti";
import { useLanguage } from "../context/LanguageContext";

const DISPLAY_DURATION_MS = 1700; // 1.7 seconds — strict display time

const PaymentSuccessScreen = ({ billData, paymentData, onDone }) => {
  const { t } = useLanguage();
  const doneCalledRef = useRef(false);
  const [visible, setVisible] = useState(false);

  const raw = localStorage.getItem("primaryCurrency");
  const cs = raw === "USD" ? "$" : "\u20B9";
  const mode = paymentData?.mode || "Cash";
  const amountPaid = paymentData?.amountPaid ?? billData?.total ?? 0;
  const splits = paymentData?.splitPayments || {};
  const billNumber = billData?.billNumber || billData?.confirmedBillNumber || "";
  const billType = billData?.billType || "Dine-In";
  const tableNo = billData?.tableNo || "";
  const settledAt = billData?.settledAt ? new Date(billData.settledAt) : new Date();
  const isUnpaid = mode === "Unpaid";

  const custName = billData?.customerName || paymentData?.customerName || "";
  const custPhone = billData?.customerPhone || paymentData?.customerPhone || billData?.customerMobile || "";
  const hasCustomerInfo = Boolean(custName || custPhone);

  const dateStr = settledAt.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = settledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();

  // Entrance & Auto-dismiss at 2 seconds
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      if (!doneCalledRef.current) {
        doneCalledRef.current = true;
        setVisible(false);
        setTimeout(() => onDone?.(), 180);
      }
    }, DISPLAY_DURATION_MS);

    return () => clearTimeout(timer);
  }, [onDone]);

  // Google Pay / Paytm style 3D Canvas Confetti
  useEffect(() => {
    if (isUnpaid) return;

    const gpayColors = ["#22c55e", "#10b981", "#3b82f6", "#6366f1", "#f59e0b", "#ec4899", "#00baf2", "#ffffff"];

    // 1. Center pop from checkmark
    confetti({
      particleCount: 80,
      spread: 100,
      startVelocity: 38,
      origin: { y: 0.42 },
      colors: gpayColors,
      scalar: 1.05,
      zIndex: 9999,
      disableForReducedMotion: true,
    });

    // 2. Dual corner cannon burst (Google Pay / Paytm 3D sprinkle style)
    const t1 = setTimeout(() => {
      confetti({
        particleCount: 45,
        angle: 60,
        spread: 65,
        origin: { x: 0.05, y: 0.6 },
        colors: gpayColors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 45,
        angle: 120,
        spread: 65,
        origin: { x: 0.95, y: 0.6 },
        colors: gpayColors,
        zIndex: 9999,
      });
    }, 220);

    return () => {
      clearTimeout(t1);
    };
  }, [isUnpaid]);

  const handleContainerClick = () => {
    if (!doneCalledRef.current) {
      doneCalledRef.current = true;
      setVisible(false);
      setTimeout(() => onDone?.(), 150);
    }
  };

  const cfgMap = {
    Cash:   { label: "Cash",           gradient: "from-emerald-500 to-green-600",   text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    UPI:    { label: "UPI",            gradient: "from-blue-500 to-indigo-600",      text: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
    Card:   { label: "Card",           gradient: "from-violet-500 to-purple-600",    text: "text-violet-700",  bg: "bg-violet-50 border-violet-200" },
    Mixed:  { label: "Mixed",          gradient: "from-orange-400 to-rose-500",      text: "text-orange-700",  bg: "bg-orange-50 border-orange-200" },
    Unpaid: { label: "Unpaid (Khata)", gradient: "from-amber-500 to-yellow-600",     text: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  };
  const cfg = cfgMap[mode] || cfgMap.Cash;
  const hasMixedBreakdown = mode === "Mixed" && (splits.cash > 0 || splits.upi > 0 || splits.card > 0);
  const tableShort = tableNo && tableNo.includes(" - ") ? tableNo.split(" - ").pop() : tableNo;

  return (
    <div
      onClick={handleContainerClick}
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 cursor-pointer select-none"
      style={{
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease",
      }}
    >
      {/* Main Payment Success Card */}
      <div
        className="relative z-[202] w-full max-w-[330px] sm:max-w-[350px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[88vh] flex flex-col"
        style={{
          background: "linear-gradient(160deg,#ffffff 0%,#f0fdf4 100%)",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.9) translateY(20px)",
          transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div className={"h-1.5 w-full bg-gradient-to-r " + cfg.gradient} />

        <div className="px-5 py-4 sm:py-5 flex flex-col items-center gap-3 overflow-y-auto">

          {/* Checkmark Icon */}
          <div className="relative flex items-center justify-center mt-1">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
              style={{
                background: isUnpaid
                  ? "linear-gradient(135deg,#f59e0b,#d97706)"
                  : "linear-gradient(135deg,#22c55e,#16a34a)",
                animation: "pss_pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
              }}
            >
              <CheckCircle size={30} className="text-white" strokeWidth={2.5} />
            </div>
            {!isUnpaid && (
              <>
                <div
                  className="absolute inset-0 rounded-full border-[3px] border-emerald-400/40"
                  style={{ animation: "pss_ripple 1s ease-out 0.2s both" }}
                />
                <div
                  className="absolute inset-0 rounded-full border-[3px] border-emerald-300/20"
                  style={{ animation: "pss_ripple 1s ease-out 0.4s both" }}
                />
              </>
            )}
          </div>

          {/* Heading */}
          <div className="text-center">
            <h2 className="text-lg font-black text-gray-900 tracking-tight leading-snug">
              {isUnpaid ? t("Saved as Unpaid (Khata)") : t("Payment Successful!")}
            </h2>
            <p className="text-[11px] text-gray-400 font-medium">
              {isUnpaid ? t("Bill recorded as due") : t("Bill settled successfully")}
            </p>
          </div>

          {/* Amount */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
              {t("Amount Paid")}
            </span>
            <span
              className="text-[38px] sm:text-[42px] font-black tracking-tight leading-none"
              style={{ color: isUnpaid ? "#d97706" : "#16a34a" }}
            >
              {cs}{Number(amountPaid).toFixed(2)}
            </span>
          </div>

          {/* Method Badge */}
          <div
            className={
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold text-xs " +
              cfg.bg +
              " " +
              cfg.text
            }
          >
            {mode === "Cash" ? (
              <Banknote size={14} />
            ) : mode === "UPI" ? (
              <Wallet size={14} />
            ) : mode === "Card" ? (
              <CreditCard size={14} />
            ) : mode === "Mixed" ? (
              <PieChart size={14} />
            ) : (
              <BookOpen size={14} />
            )}
            <span>
              {t("Paid via")} {t(cfg.label)}
            </span>
          </div>

          {/* Customer Details (Only if exists) */}
          {hasCustomerInfo && (
            <div className="w-full bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                  <User size={14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">
                    {t("Customer")}
                  </span>
                  <span className="font-bold text-gray-900 truncate text-xs mt-0.5">
                    {custName || t("Guest")}
                  </span>
                </div>
              </div>
              {custPhone && (
                <div className="flex items-center gap-1 font-mono text-emerald-700 font-bold bg-white/90 border border-emerald-200/80 rounded-md px-2 py-1 text-[11px] shrink-0">
                  <Phone size={10} className="text-emerald-600" />
                  <span>{custPhone}</span>
                </div>
              )}
            </div>
          )}

          {/* Mixed Breakdown (If Mixed) */}
          {hasMixedBreakdown && (
            <div className="w-full rounded-xl border border-orange-200 bg-orange-50 overflow-hidden text-xs">
              <div className="px-3 py-1 bg-orange-100/80 border-b border-orange-200 text-[9px] font-black text-orange-800 uppercase tracking-wider">
                {t("Mixed Payment Breakdown")}
              </div>
              {splits.cash > 0 && (
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-orange-100">
                  <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                    <Banknote size={12} className="text-emerald-600" />
                    {t("Cash")}
                  </span>
                  <span className="font-bold text-gray-900">
                    {cs}{Number(splits.cash).toFixed(2)}
                  </span>
                </div>
              )}
              {splits.upi > 0 && (
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-orange-100">
                  <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                    <Wallet size={12} className="text-blue-600" />
                    {t("UPI")}
                  </span>
                  <span className="font-bold text-gray-900">
                    {cs}{Number(splits.upi).toFixed(2)}
                  </span>
                </div>
              )}
              {splits.card > 0 && (
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                    <CreditCard size={12} className="text-violet-600" />
                    {t("Card")}
                  </span>
                  <span className="font-bold text-gray-900">
                    {cs}{Number(splits.card).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Info Grid */}
          <div className="w-full grid grid-cols-2 gap-1.5 text-xs">
            {billNumber ? (
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                <span className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                  <Hash size={8} />
                  {t("Bill No.")}
                </span>
                <span className="font-bold text-gray-800 font-mono">
                  #{billNumber}
                </span>
              </div>
            ) : (
              <div />
            )}
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
              <span className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                <Receipt size={8} />
                {t("Invoice Type")}
              </span>
              <span className="font-bold text-gray-800 flex items-center gap-1 flex-wrap text-xs">
                {billType === "Delivery" ? (
                  <Bike size={12} />
                ) : billType === "Takeaway" ? (
                  <ShoppingBag size={12} />
                ) : (
                  <Utensils size={12} />
                )}
                {t(billType)}
                {tableShort && (
                  <span className="text-[9px] text-gray-400 font-mono">
                    &middot; {tableShort}
                  </span>
                )}
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
              <span className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                <Calendar size={8} />
                {t("Date")}
              </span>
              <span className="font-bold text-gray-800 font-mono">
                {dateStr}
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
              <span className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                <Clock size={8} />
                {t("Time")}
              </span>
              <span className="font-bold text-gray-800 font-mono">
                {timeStr}
              </span>
            </div>
          </div>
        </div>

        <div className={"h-1 w-full bg-gradient-to-r " + cfg.gradient + " opacity-40"} />
      </div>

      <style>{`
        @keyframes pss_pop { 0%{transform:scale(0.3);opacity:0;} 70%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;} }
        @keyframes pss_ripple { 0%{transform:scale(1);opacity:1;} 100%{transform:scale(2.2);opacity:0;} }
      `}</style>
    </div>
  );
};

export default PaymentSuccessScreen;
