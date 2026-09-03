import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { Printer, ArrowLeft, Save, Download, X, Smartphone, Loader2, UserRound, ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Toast from './Toast';
import { sendWhatsAppBill } from '../api/whatsapp';
import html2canvas from 'html2canvas';
import api from '../api/axios';

const Invoice = ({ bill, onClose, onSave }) => {
  const { t } = useLanguage();
  const currencySymbol = localStorage.getItem('primaryCurrency') === 'USD' ? '$' : '₹';
  const primaryCurrency = localStorage.getItem('primaryCurrency') || 'INR';
  let enabledCurrencies = [];
  let baseRate = 1.0;
  try {
    const s = JSON.parse(localStorage.getItem('secondaryCurrencies')) || [];
    enabledCurrencies = s.filter((c) => c.enabled && c.code !== primaryCurrency);
    if (primaryCurrency !== 'INR') {
      const found = s.find((r) => r.code === primaryCurrency);
      if (found) baseRate = found.rate;
    }
  } catch (e) {}

  const [settings, setSettings] = useState({
    restaurantName: 'msbillings',
    restaurantType: 'Restaurant',
    address: '123 Foodie Street, Gourmet City',
    phone: '+91 98765 43210',
    email: 'feedback@msbillings.com',
    gstin: '29ABCDE1234F1Z5',
    upiId: 'maheshsiva864@oksbi',
    footerMessage: '*** Thank You! Visit Again ***'
  });

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState(() => bill?.customerPhone || '');
  const [whatsappCustomerName, setWhatsappCustomerName] = useState(() => bill?.customerName || '');
  const [toast, setToast] = useState(null);
  const [sendingAutomated, setSendingAutomated] = useState(false);
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);
  const [msgExpanded, setMsgExpanded] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (whatsappPhone && whatsappPhone.length >= 2) {
        try {
          const res = await api.get(`/customers/search?q=${whatsappPhone}`);
          setCustomerSuggestions(res.data);
          setShowSuggestions(true);
        } catch (err) {
          console.error('Error fetching customer suggestions:', err);
        }
      } else {
        setCustomerSuggestions([]);
        setShowSuggestions(false);
      }
    };
    
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [whatsappPhone]);

  useEffect(() => {
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings((prev) => ({ ...prev, ...parsed }));
    }
  }, []);

  const handlePrint = () => {
    if (window.electronAPI) {
      const receiptNode = document.querySelector('#invoice-print-area .receipt-print');
      const htmlContent = receiptNode ? receiptNode.outerHTML : document.getElementById('invoice-print-area').outerHTML;
      const isSilent = settings.silentPrinting !== false;
      if (isSilent && settings.billingPrinter) {
        window.electronAPI.silentPrint(htmlContent, settings.billingPrinter, true);
      } else {
        window.electronAPI.silentPrint(htmlContent, settings.billingPrinter || '', false);
      }
    } else if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
      window.AndroidPrint.print();
    } else {
      window.print();
    }
  };

  const generateEBillWhatsAppText = (overrideName = null) => {
    const s = settings || {};
    const restName = (s.restaurantName || 'MS Billings Restaurant').trim();
    const billNo = bill?.billNumber || 'PREVIEW';
    const dateStr = new Date(bill?.createdAt || Date.now()).toLocaleDateString('en-GB');
    const timeStr = new Date(bill?.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bType = bill?.billType || (bill?.tableNo?.startsWith('DEL') ? 'Delivery' : (bill?.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine-In'));
    const tableInfo = bType === 'Dine-In' ? `Table: ${bill?.tableNo || 'N/A'}` : `${bType} ${bill?.tableNo ? `(${bill?.tableNo})` : ''}`;
    const customerName = overrideName || whatsappCustomerName || bill?.customerName || '';

    const itemsList = (bill?.items || [])
      .filter(item => !item.isCancelled)
      .map(item => {
        const qty = (item.quantity || 0) - (item.cancelledQuantity || 0);
        if (qty <= 0) return null;
        const price = (item.price || 0).toFixed(2);
        const itemTot = ((item.price || 0) * qty).toFixed(2);
        return `• ${item.name} x ${qty} @ ₹${price} = ₹${itemTot}`;
      })
      .filter(Boolean)
      .join('\n');

    const totalQty = (bill?.items || []).filter(i => !i.isCancelled).reduce((acc, curr) => acc + ((curr.quantity || 1) - (curr.cancelledQuantity || 0)), 0);
    const sub = Number(bill?.subtotal || bill?.items?.filter(i => !i.isCancelled).reduce((acc, curr) => acc + ((curr.price || 0) * ((curr.quantity || 1) - (curr.cancelledQuantity || 0))), 0) || 0);
    const subtotal = sub.toFixed(2);
    const disc = Number(bill?.discount || 0);
    const discount = disc > 0 ? `\n• *Discount:* -₹${disc.toFixed(2)}` : '';
    const taxable = Math.max(0, sub - disc);

    // Dynamic tax calculation identical to printed receipt invoice
    const cRate = s.enableCgst === true ? (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5) : 0;
    const sRate = s.enableSgst === true ? (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5) : 0;
    const gRate = s.enableGst === true ? (s.gstRate !== undefined ? Number(s.gstRate) : 5) : 0;
    const totRate = cRate + sRate + gRate;

    let rate = totRate;
    let taxRupees = 0;

    if (bill?.tax !== undefined && bill?.tax !== null) {
      if (Number(bill.tax) <= 100 && Math.abs(Number(bill.total) - taxable - taxable * Number(bill.tax) / 100) <= Math.abs(Number(bill.total) - taxable - Number(bill.tax))) {
        rate = Number(bill.tax);
        taxRupees = (taxable * rate) / 100;
      } else {
        taxRupees = Number(bill.tax);
        rate = bill.taxRate || Math.round((taxRupees / Math.max(1, taxable)) * 100) || totRate;
      }
    } else if (totRate > 0) {
      rate = totRate;
      taxRupees = (taxable * rate) / 100;
    }

    let taxBreakdown = '';
    if (taxRupees > 0 && rate > 0) {
      if (cRate > 0 && sRate > 0) {
        const cEff = rate * (cRate / Math.max(1, totRate));
        const cAmt = taxRupees * (cRate / Math.max(1, totRate));
        const sEff = rate * (sRate / Math.max(1, totRate));
        const sAmt = taxRupees * (sRate / Math.max(1, totRate));
        taxBreakdown += `\n• *CGST (${cEff.toFixed(1)}%):* +₹${cAmt.toFixed(2)}`;
        taxBreakdown += `\n• *SGST (${sEff.toFixed(1)}%):* +₹${sAmt.toFixed(2)}`;
      } else if (gRate > 0) {
        const gEff = rate * (gRate / Math.max(1, totRate));
        const gAmt = taxRupees * (gRate / Math.max(1, totRate));
        taxBreakdown += `\n• *GST (${gEff.toFixed(1)}%):* +₹${gAmt.toFixed(2)}`;
      } else {
        taxBreakdown += `\n• *GST/Tax (${rate}%):* +₹${taxRupees.toFixed(2)}`;
      }
    }

    const deliveryCharge = Number(bill?.deliveryCharge || 0) > 0 ? `\n• *Delivery Charge:* +₹${Number(bill.deliveryCharge).toFixed(2)}` : '';
    const containerCharge = Number(bill?.containerCharge || 0) > 0 ? `\n• *Container Charge:* +₹${Number(bill.containerCharge).toFixed(2)}` : '';

    let finalTotal = Number(bill?.total || 0);
    const addCharges = Number(bill?.deliveryCharge || 0) + Number(bill?.containerCharge || 0);
    if (!finalTotal || isNaN(finalTotal) || (finalTotal <= 0 && sub > 0)) {
      finalTotal = taxable + taxRupees + addCharges;
    }
    const roundedTotal = Math.round(finalTotal);
    const roundOff = roundedTotal - finalTotal;
    const roundOffText = roundOff !== 0 ? `\n• *Round Off:* ${roundOff > 0 ? '+' : ''}₹${roundOff.toFixed(2)}` : '';
    const total = finalTotal.toFixed(2);

    let paymentInfo = bill?.paymentMethod || 'Cash';
    if (bill?.paymentBreakdown && (bill.paymentBreakdown.cash > 0 || bill.paymentBreakdown.upi > 0 || bill.paymentBreakdown.card > 0)) {
      const parts = [];
      if (bill.paymentBreakdown.cash > 0) parts.push(`Cash: ₹${bill.paymentBreakdown.cash}`);
      if (bill.paymentBreakdown.upi > 0) parts.push(`UPI: ₹${bill.paymentBreakdown.upi}`);
      if (bill.paymentBreakdown.card > 0) parts.push(`Card: ₹${bill.paymentBreakdown.card}`);
      paymentInfo = parts.join(' | ');
    }

    const READ_MORE = String.fromCharCode(8206).repeat(4001);

    let header = '';
    let footerMessage = s.footerMessage;

    if (bType === 'Delivery') {
      header = customerName
        ? `🛵 Dear *${customerName}*, thank you for ordering delivery with us!\n🧾 *Delivery e-Bill #${billNo}* | *${restName.toUpperCase()}*`
        : `🛵 *HOME DELIVERY E-BILL* 🛵\n🏠 *${restName.toUpperCase()}* | Bill #${billNo}`;
      if (!footerMessage) footerMessage = '*** THANK YOU FOR YOUR DELIVERY ORDER! ENJOY YOUR MEAL ***';
    } else if (bType === 'Takeaway') {
      header = customerName
        ? `🛍️ Dear *${customerName}*, thank you for your takeaway order!\n🧾 *Takeaway e-Bill #${billNo}* | *${restName.toUpperCase()}*`
        : `🛍️ *TAKEAWAY E-BILL RECEIPT* 🛍️\n📦 *${restName.toUpperCase()}* | Bill #${billNo}`;
      if (!footerMessage) footerMessage = '*** THANK YOU FOR ORDERING TAKEAWAY! VISIT AGAIN ***';
    } else {
      header = customerName
        ? `👋 Dear *${customerName}*, thank you for dining with us!\n🧾 *e-Bill #${billNo}* | *${restName.toUpperCase()}*`
        : `🧾 *DIGITAL E-BILL RECEIPT* 🧾\n🏨 *${restName.toUpperCase()}* | Bill #${billNo}`;
      if (!footerMessage) footerMessage = '*** THANK YOU! VISIT AGAIN ***';
    }

    return `${header}\n${READ_MORE}\n` +
      (s.address ? `📍 ${s.address.split('\n')[0]}\n` : '') +
      (s.gstin ? `📄 *GSTIN:* ${s.gstin}\n` : '') +
      (s.fssai ? `🍽️ *FSSAI:* ${s.fssai}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Bill No:* #${billNo}\n` +
      `*Date & Time:* ${dateStr}, ${timeStr}\n` +
      `*Order Type:* ${tableInfo}\n` +
      (customerName ? `*Customer:* ${customerName}\n` : '') +
      (bill?.customerPhone || whatsappPhone ? `*Phone:* ${bill?.customerPhone || whatsappPhone}\n` : '') +
      (bill?.tokenNumber ? `*Token No:* ${bill.tokenNumber}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🛒 *ITEMS ORDERED (${totalQty} Qty):*\n` +
      `${itemsList}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Subtotal:* ₹${subtotal}` +
      discount +
      taxBreakdown +
      deliveryCharge +
      containerCharge +
      roundOffText +
      `\n• *GRAND TOTAL:* *₹${total}*\n` +
      `• *Payment Mode:* ${paymentInfo}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_${footerMessage}_`;
  };

  const handleSendWhatsAppBill = async (targetPhone = null, overrideName = null) => {
    const numToSend = (targetPhone !== null ? targetPhone : (whatsappPhone || bill?.customerPhone || '')).trim();
    let cleanPhone = numToSend.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setToast({ message: t("Please enter customer WhatsApp number to send bill"), type: 'warning' });
      setSendingAutomated(false);
      return;
    }

    const msg = generateEBillWhatsAppText(overrideName);

    setSendingAutomated(true);

    // Yield animation frame so React paints spinner immediately
    await new Promise(resolve => requestAnimationFrame(resolve));

    // High-speed, crisp receipt capture
    let imageBase64 = null;
    try {
      const receiptElement = document.querySelector('#invoice-print-area .receipt-print') || document.querySelector('.receipt-print');
      if (receiptElement) {
        const canvas = await Promise.race([
          html2canvas(receiptElement, {
            scale: 1.2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 1000,
            onclone: (clonedDoc) => {
              const el = clonedDoc.querySelector('.receipt-print');
              if (el) {
                el.style.boxShadow = 'none';
                el.style.filter = 'none';
                el.style.backdropFilter = 'none';
                el.style.margin = '0 auto';
                el.style.backgroundColor = '#ffffff';
                el.style.border = 'none';
                el.style.borderRadius = '0px';
                el.style.width = '320px';
                el.style.maxWidth = '320px';
                el.style.minWidth = '320px';
              }
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error(t('Receipt capture timed out'))), 4000))
        ]);

        if (canvas) {
          imageBase64 = canvas.toDataURL('image/jpeg', 0.75);
        }
      }
    } catch (captureErr) {
      console.error('Could not generate receipt image:', captureErr);
    }

    if (!imageBase64) {
      setToast({ message: t("Could not capture bill image. Please try again."), type: 'error' });
      setSendingAutomated(false);
      return;
    }

    try {
      const res = await Promise.race([
        sendWhatsAppBill(cleanPhone, msg, imageBase64, null, `Bill_${bill?.billNumber || 'Receipt'}.jpg`),
        new Promise((_, reject) => setTimeout(() => reject(new Error(t("WhatsApp server timed out. Please check connection."))), 15000))
      ]);

      if (res && res.success) {
        setToast({ message: `${t("e-Bill with receipt image sent to")} +${cleanPhone} ${t("via WhatsApp! ✓")}`, type: 'success' });
        setShowWhatsAppModal(false);
      } else {
        throw new Error(res?.error || t('Failed to send WhatsApp e-Bill'));
      }
    } catch (err) {
      console.error('WhatsApp send error:', err);
      const errorMsg = err.response?.data?.error || err.message || t('Failed to send WhatsApp e-Bill');
      setToast({ message: `WhatsApp: ${errorMsg}`, type: 'error' });
    } finally {
      setSendingAutomated(false);
    }
  };

  const getFormatClasses = () => {
    switch (settings.printFormat) {
      case 'A4': return 'w-full max-w-sm print:max-w-full';
      case '58mm': return 'w-[200px] print:w-full print:max-w-full print:m-0';
      case '80mm':
      default: return 'w-[280px] print:w-full print:max-w-full print:m-0';
    }
  };

  return (
    <div id="invoice-print-area" className="invoice-container fixed inset-0 bg-black/30 backdrop-blur-md z-[1000] overflow-y-auto overflow-x-hidden animate-in fade-in duration-200 p-4 print:p-0 print:block print:w-full print:h-full">
      <style>
        {`
          @media print {
            @page {
              size: ${settings.printFormat === 'A4' ? 'A4 portrait' : settings.printFormat === '58mm' ? '58mm auto portrait' : '80mm auto portrait'};
              margin: 0 !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .invoice-container {
              background: #ffffff !important;
              padding: 0 !important;
            }
            .receipt-print {
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}
      </style>

      {/* Controls - Hidden on Print */}
      <div className="sticky top-4 flex flex-wrap items-center justify-center gap-2.5 print:hidden w-full max-w-2xl mx-auto z-30 px-4 py-2.5 bg-transparent mb-4">
        {onSave &&
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-gray-900 rounded-xl transition-all shadow-md font-bold text-xs sm:text-sm active:scale-95 cursor-pointer">
            <Save size={16} />
            <span>{t("Finish")}</span>
          </button>
        }
        <div className="flex items-center bg-[#25D366] rounded-xl shadow-md overflow-hidden">
          <button
            onClick={() => {
              if (!whatsappPhone && !bill?.customerPhone) {
                setShowWhatsAppModal(true);
                setToast({ message: t("Please enter customer WhatsApp number to send bill"), type: 'warning' });
              } else {
                handleSendWhatsAppBill();
              }
            }}
            disabled={sendingAutomated}
            className="flex items-center gap-1.5 px-3.5 py-2 text-gray-900 font-bold text-xs sm:text-sm active:scale-95 cursor-pointer hover:bg-[#20bd5a] transition-all disabled:opacity-75 disabled:cursor-wait"
            title={t("Send e-Bill directly on WhatsApp (1-Click)")}>
            {sendingAutomated ? (
              <>
                <Loader2 size={15} className="animate-spin shrink-0" />
                <span className="animate-pulse">{t('Sending...')}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                <span>{t("WhatsApp e-Bill")}</span>
              </>
            )}
          </button>
          <button
            onClick={() => { setShowWhatsAppModal(true); setMsgExpanded(false); }}
            className="px-2 py-2 text-gray-900/80 hover:text-gray-900 hover:bg-[#20bd5a] border-l border-white/25 transition-colors cursor-pointer"
            title={t("Edit mobile number")}>
            <Smartphone size={15} />
          </button>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-gray-900 rounded-xl hover:bg-gray-100 transition-all shadow-md font-bold text-xs sm:text-sm active:scale-95 cursor-pointer">
          <Printer size={16} />
          <span>{t("Print Bill")}</span>
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-gray-900 rounded-xl transition-all shadow-md font-bold text-xs sm:text-sm active:scale-95 cursor-pointer">
          <ArrowLeft size={16} />
          <span>{t("Close")}</span>
        </button>
      </div>

      {/* WhatsApp Quick Modal rendered via Portal */}
      {showWhatsAppModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 w-full max-w-md shadow-2xl text-gray-900 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] overflow-hidden relative">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#25D366]/5 rounded-full blur-2xl pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4 shrink-0 relative z-10">
              <div className="flex items-center gap-2.5 text-[#25D366] font-bold text-base">
                <div className="w-8 h-8 rounded-xl bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center text-[#25D366]">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                  </svg>
                </div>
                <span>{t("Send WhatsApp e-Bill")}</span>
              </div>
              <button onClick={() => setShowWhatsAppModal(false)} className="text-gray-500 hover:text-gray-900 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 mb-4 overflow-y-auto pr-1 flex-1 relative z-10">

              {/* Customer Name Row */}
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{t('Customer Name')} <span className="text-gray-500 font-normal">(for personalised greeting)</span></label>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                  <UserRound size={14} className="text-gray-500 shrink-0" />
                  <input
                    type="text"
                    value={whatsappCustomerName}
                    onChange={(e) => setWhatsappCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="bg-transparent text-gray-900 flex-1 text-gray-900 text-sm focus:outline-none"
                  />
                  {/* Open Customer CRM mini-modal */}
                  <button
                    type="button"
                    onClick={() => setShowCustomerEditModal(true)}
                    title="Open Customer Details"
                    className="shrink-0 p-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 hover:text-orange-300 transition-colors cursor-pointer">
                    <UserRound size={14} />
                  </button>
                </div>
              </div>

              {/* Phone Number Row */}
              <div className="relative">
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  {t("Recipient / Customer Mobile Number")}
                </label>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                  <span className="text-sm font-bold text-gray-500">+91</span>
                  <input
                    type="tel"
                    value={whatsappPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setWhatsappPhone(val);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Enter 10-digit number"
                    className="bg-transparent text-gray-900 flex-1 text-gray-900 font-mono font-bold text-sm focus:outline-none"
                    autoFocus
                  />
                  <Phone size={14} className="text-gray-500 shrink-0" />
                </div>
                {/* Suggestions Dropdown */}
                {showSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-50 border border-gray-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {customerSuggestions.map((cust, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2.5 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0 flex justify-between items-center"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setWhatsappPhone(cust.phone);
                          setWhatsappCustomerName(cust.name && cust.name !== 'Guest' ? cust.name : '');
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex flex-col">
                           <span className="text-sm text-gray-900 font-mono">{cust.phone}</span>
                           <span className="text-xs text-gray-500">{cust.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Preset Buttons */}
              {bill?.customerPhone && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setWhatsappPhone(bill.customerPhone); setWhatsappCustomerName(bill.customerName || whatsappCustomerName); }}
                    className="text-[11px] font-semibold bg-gray-50 hover:bg-gray-100 text-cyan-700 border border-cyan-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
                    {bill.customerPhone} {bill.customerName ? `(${bill.customerName})` : '(Customer)'}
                  </button>
                </div>
              )}

              {/* Bill Details Snapshot */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs space-y-1 text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("Bill No:")}</span>
                  <span className="font-bold text-gray-900">#{bill?.billNumber || 'PREVIEW'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("Total Amount:")}</span>
                  <span className="font-bold text-emerald-600 font-mono">₹{Number(bill?.total || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* WhatsApp Message Preview with Read More/Less */}
              {(() => {
                const rawMsg = generateEBillWhatsAppText();
                const previewMsg = rawMsg.replace(/\u200E/g, '');
                const previewLimit = 220;
                const isLong = previewMsg.length > previewLimit;
                return (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 shadow-sm">
                    <div className="text-[11px] text-gray-600 font-semibold mb-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3 fill-emerald-600" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                      <span>{t("Message Preview")}</span>
                    </div>
                    <pre className="text-[11px] text-gray-800 whitespace-pre-wrap leading-relaxed font-sans max-h-48 overflow-y-auto">
                      {msgExpanded || !isLong ? previewMsg : previewMsg.slice(0, previewLimit) + '...'}
                    </pre>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => setMsgExpanded(v => !v)}
                        className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold transition-colors cursor-pointer">
                        {msgExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        <span>{msgExpanded ? t("Read less") : t("Read more")}</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-2.5 pt-2 border-t border-gray-100 shrink-0 relative z-10">
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer">
                {t("Cancel")}
              </button>
              <button
                type="button"
                disabled={sendingAutomated}
                onClick={() => handleSendWhatsAppBill(whatsappPhone, whatsappCustomerName)}
                className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-[#25D366]/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-wait">
                {sendingAutomated ? (
                  <><Loader2 size={16} className="animate-spin" /><span className="animate-pulse">{t("Sending...")}</span></>
                ) : (
                  <><svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg><span>{t("Send e-Bill")}</span></>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Inline Customer Details Mini-Modal rendered via Portal */}
      {showCustomerEditModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white border border-orange-500/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl text-gray-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-500 rounded-lg">
                  <UserRound size={16} className="text-gray-900" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">{t('Customer Details')}</div>
                  <div className="text-[11px] text-gray-500">{t('Name & phone for this e-bill')}</div>
                </div>
              </div>
              <button onClick={() => setShowCustomerEditModal(false)} className="text-gray-500 hover:text-gray-900 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <label className="text-xs font-semibold text-gray-500 block mb-1">{t('Phone Number')}</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <Phone size={14} className="text-gray-500 shrink-0" />
                  <input
                    type="tel"
                    maxLength={10}
                    value={whatsappPhone}
                    onChange={(e) => {
                      setWhatsappPhone(e.target.value.replace(/[^0-9]/g, ''));
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="10-digit mobile number"
                    className="bg-transparent text-gray-900 flex-1 text-gray-900 font-mono font-bold text-sm focus:outline-none"
                    autoFocus
                  />
                </div>
                {/* Suggestions Dropdown */}
                {showSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-50 border border-gray-100 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {customerSuggestions.map((cust, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2.5 hover:bg-slate-700 cursor-pointer border-b border-white/5 last:border-0 flex justify-between items-center"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setWhatsappPhone(cust.phone);
                          setWhatsappCustomerName(cust.name && cust.name !== 'Guest' ? cust.name : '');
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex flex-col">
                           <span className="text-sm text-gray-900 font-mono">{cust.phone}</span>
                           <span className="text-xs text-gray-500">{cust.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{t('Customer Name')}</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <UserRound size={14} className="text-gray-500 shrink-0" />
                  <input
                    type="text"
                    value={whatsappCustomerName}
                    onChange={(e) => setWhatsappCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="bg-transparent text-gray-900 flex-1 text-gray-900 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerEditModal(false)}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-gray-900 rounded-xl font-bold text-sm transition-all shadow-md shadow-orange-500/20 cursor-pointer active:scale-95">
                ✓ {t('Apply')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div
        className={`receipt-print bg-white text-black mx-auto shadow-2xl print:shadow-none mt-6 mb-10 print:m-0 print:border-0 overflow-hidden ${getFormatClasses()}`}
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          color: '#000',
          fontWeight: 'normal',
          fontSize: '13px',
          lineHeight: '1.3',
          width: settings.printFormat === 'A4' ? '100%' : undefined,
          maxWidth: settings.printFormat === 'A4' ? '360px' : undefined
        }}>
        
        <div className="p-3 print:p-2" style={{ paddingLeft: '8px', paddingRight: '8px', boxSizing: 'border-box' }}>
          
          {/* Header */}
          <div align="center" className="text-center mb-2" style={{ textAlign: 'center', margin: '0 auto 8px auto', width: '100%', display: 'block' }}>
            {settings.logo &&
            <div align="center" className="flex justify-center mb-1" style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '0 auto 4px auto', textAlign: 'center' }}>
                <img src={settings.logo} alt="Restaurant Logo" style={{ maxHeight: '48px', maxWidth: '120px', width: 'auto', height: 'auto', objectFit: 'contain', margin: '0 auto', display: 'block' }} className="max-h-12 max-w-[120px] object-contain print:max-h-12 print:max-w-[120px]" />
              </div>
            }
            <div align="center" style={{ fontSize: '18px', lineHeight: '1.1', marginBottom: '4px', fontWeight: 'bold', textAlign: 'center', width: '100%', display: 'block' }}>
              {(settings.restaurantName || 'MSBILLINGS').toUpperCase()}
            </div>
            <div align="center" style={{ fontSize: '12px', lineHeight: '1.2', fontWeight: 'normal', textAlign: 'center', width: '100%', display: 'block' }}>
              {(settings.address || '').split('\n').map((line, i) =>
              <div key={i} align="center" style={{ textAlign: 'center', width: '100%', display: 'block' }}>{line}</div>
              )}
              {settings.gstin && <div align="center" style={{ textAlign: 'center', width: '100%', display: 'block' }}>{t("GSTIN :")}{settings.gstin}</div>}
              {settings.phone && <div align="center" style={{ textAlign: 'center', width: '100%', display: 'block' }}>{t("PH :")}{settings.phone}</div>}
              {settings.fssai && <div align="center" style={{ textAlign: 'center', width: '100%', display: 'block' }}>{t("FSSAI :")}{settings.fssai}</div>}
            </div>
          </div>

          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>
          
          <div style={{ fontSize: '16px', textAlign: 'center', margin: '4px 0', fontWeight: 'bold' }}>
            {bill.discountType === 'complimentary' ? 'Complimentary Bill' : 'Tax Invoice'}
          </div>

          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>
          
          {/* Customer name & phone hidden for privacy — data kept in bill object, easy to re-enable */}
          {/* {bill.customerName && (
            <div style={{ fontSize: '14px', fontWeight: 'normal' }}>
              {t("Name: ")}<strong>{bill.customerName}</strong>
            </div>
          )}
          {bill.customerPhone && (
            <div style={{ fontSize: '14px', fontWeight: 'normal' }}>
              {t("Phone: ")}<strong>{bill.customerPhone}</strong>
            </div>
          )}
          {(bill.customerName || bill.customerPhone) && (
            <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>
          )} */}

          {/* Bill Info Grid - Table on own row, then Date+Time side-by-side, then Cashier+BillNo */}
          {/* Row 1: Order Type / Table Name - full width, centered */}
          {(() => {
            const bType = bill.billType || (bill.tableNo?.startsWith('DEL') ? 'Delivery' : (bill.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine-In'));
            let label = '';
            if (bType === 'Delivery') {
              const channel = (bill.orderSource || '').trim() || 'DIRECT DELIVERY';
              label = `DELIVERY: ${channel.toUpperCase()}${bill.tableNo ? ` (${bill.tableNo})` : ''}`;
            } else if (bType === 'Takeaway') {
              label = `TAKEAWAY${bill.tableNo ? ` (${bill.tableNo})` : ''}`;
            } else {
              label = `Dine-In: ${bill.tableNo || 'Table'}`;
            }
            return (
              <div style={{ width: '100%', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>
                {label}
              </div>
            );
          })()}

          {/* Row 2: Date (left) | Time 12h (right) */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'normal', marginBottom: '2px' }}>
            <span>{t('Date:')}{new Date(bill.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '/')}</span>
            <span style={{ fontWeight: 'bold' }}>{new Date(bill.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
          </div>

          {/* Row 3: Cashier (left) | Bill No (right) */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'normal', marginBottom: '2px' }}>
            <span>{t('Cashier:')}{bill.cashierName || 'admin'}</span>
            <span style={{ fontWeight: 'bold' }}>{t('Bill No.:')}{bill.billNumber || 'PREVIEW'}</span>
          </div>
          {bill.captainName && (
            <div style={{ fontSize: '14px', fontWeight: 'normal' }}>{t('Assign to:')}{bill.captainName}</div>
          )}
          {bill.tokenNumber && (
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{t('Token No.:')}{bill.tokenNumber}</div>
          )}

          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>

          {/* Items Header */}
          <div className="flex pb-0.5" style={{ display: 'flex', width: '100%', alignItems: 'center', fontSize: '13px', fontWeight: 'normal' }}>
            <div className="flex-1" style={{ flex: '1 1 0%', textAlign: 'left' }}>{t('Item')}</div>
            <div className="w-8 text-center" style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>{t("Qty.")}</div>
            <div className="w-14 text-right" style={{ width: '56px', textAlign: 'right', flexShrink: 0 }}>{t("Price")}</div>
            <div className="w-16 text-right" style={{ width: '64px', textAlign: 'right', flexShrink: 0 }}>{t('Amount')}</div>
          </div>

          <div style={{ borderTop: '1px solid black', margin: '2px 0 4px 0' }}></div>

          {/* Items List */}
          <div className="mb-1 pb-1" style={{ borderBottom: '1px solid black' }}>
            {bill.items && bill.items.length > 0 ?
            bill.items.filter(item => !item.isCancelled).map((item, idx) => {
              const activeQty = (item.quantity || 0) - (item.cancelledQuantity || 0);
              if (activeQty <= 0) return null;
              return (
                <div key={idx} className="flex items-start mb-1 leading-tight" style={{ display: 'flex', width: '100%', alignItems: 'flex-start', fontSize: '14px', fontWeight: 'normal' }}>
                  <div className="flex-1 pr-1 break-words" style={{ flex: '1 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '4px', fontSize: '12px' }}>
                    {item.name || 'Unknown Item'}
                    {item.hsnCode ? <span style={{ fontSize: '10px' }}>{t("(HSN:")}{item.hsnCode})</span> : ''}
                  </div>
                  <div className="w-8 text-center" style={{ width: '32px', textAlign: 'center', flexShrink: 0, fontSize: '13px' }}>{activeQty}</div>
                  <div className="w-14 text-right" style={{ width: '56px', textAlign: 'right', flexShrink: 0, fontSize: '13px' }}>{(item.price || 0).toFixed(2)}</div>
                  <div className="w-16 text-right" style={{ width: '64px', textAlign: 'right', flexShrink: 0, fontSize: '13px' }}>{(item.price * activeQty).toFixed(2)}</div>
                </div>
              );
            }) :

            <div className="text-center py-1" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'normal' }}>{t("No items")}</div>
            }
          </div>

          {/* Tax / Discount / Items summary */}
          <div className="flex flex-col gap-0.5 mt-1" style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', fontWeight: 'normal' }}>
            <div className="flex justify-between w-full" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-left w-24" style={{ width: '96px', textAlign: 'left', flexShrink: 0 }}>{t("Total Qty:")}{bill.items?.filter(i => !i.isCancelled).reduce((acc, curr) => acc + ((curr.quantity || 1) - (curr.cancelledQuantity || 0)), 0) || 0}</span>
              <div className="flex-1 flex justify-between pl-2" style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '8px' }}>
                <span className="text-left" style={{ textAlign: 'left' }}>{t("Sub Total")}</span>
                <span className="w-16 text-right" style={{ width: '64px', textAlign: 'right', flexShrink: 0 }}>{(bill.subtotal || bill.items?.filter(i => !i.isCancelled).reduce((acc, curr) => acc + ((curr.price || 0) * ((curr.quantity || 1) - (curr.cancelledQuantity || 0))), 0) || 0).toFixed(2)}</span>
              </div>
            </div>
            {bill.discount > 0 &&
              <div className="flex justify-between w-full" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '15px' }}>
                <span className="w-24" style={{ width: '96px', flexShrink: 0 }}></span>
                <div className="flex-1 flex justify-between pl-2" style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '8px' }}>
                  <span className="text-left" style={{ textAlign: 'left', fontWeight: 'bold' }}>
                    {t('Discount')} {bill.discountType === 'percentage' && bill.discountValue ? `(${bill.discountValue}%)` : (bill.discountType === 'complimentary' ? '(100%)' : '')}
                  </span>
                  <span className="w-16 text-right" style={{ width: '64px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold' }}>-{(bill.discount || 0).toFixed(2)}</span>
                </div>
              </div>
            }
            
            {(() => {
              const s = settings || {};
              const cRate = s.enableCgst === true ? (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5) : 0;
              const sRate = s.enableSgst === true ? (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5) : 0;
              const gRate = s.enableGst === true ? (s.gstRate !== undefined ? Number(s.gstRate) : 5) : 0;
              const totRate = cRate + sRate + gRate;

              const sub = Number(bill.subtotal || bill.items?.reduce((acc, curr) => acc + ((curr.price || 0) * (curr.quantity || 1)), 0) || 0);
              const disc = Number(bill.discount || 0);
              const taxable = Math.max(0, sub - disc);

              let rate = totRate;
              let taxRupees = 0;

              if (bill.tax !== undefined && bill.tax !== null) {
                if (Number(bill.tax) <= 100 && Math.abs(Number(bill.total) - taxable - taxable * Number(bill.tax) / 100) <= Math.abs(Number(bill.total) - taxable - Number(bill.tax))) {
                  rate = Number(bill.tax);
                  taxRupees = taxable * rate / 100;
                } else {
                  taxRupees = Number(bill.tax);
                  rate = bill.taxRate || Math.round(taxRupees / Math.max(1, taxable) * 100) || totRate;
                }
              } else if (totRate > 0) {
                rate = totRate;
                taxRupees = taxable * rate / 100;
              }

              if (taxRupees === 0 || rate === 0) return null;

              const cEff = rate * (cRate / Math.max(1, totRate));
              const cAmt = taxRupees * (cRate / Math.max(1, totRate));
              const sEff = rate * (sRate / Math.max(1, totRate));
              const sAmt = taxRupees * (sRate / Math.max(1, totRate));
              const gEff = rate * (gRate / Math.max(1, totRate));
              const gAmt = taxRupees * (gRate / Math.max(1, totRate));

              return (
                <>
                  {cRate > 0 &&
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ textAlign: 'left', flex: 1 }}>{t("CGST@")}{cEff.toFixed(1)}%</span>
                      <span style={{ textAlign: 'right', flexShrink: 0, minWidth: '48px' }}>{cAmt.toFixed(2)}</span>
                    </div>
                  }
                  {sRate > 0 &&
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ textAlign: 'left', flex: 1 }}>{t("SGST@")}{sEff.toFixed(1)}%</span>
                      <span style={{ textAlign: 'right', flexShrink: 0, minWidth: '48px' }}>{sAmt.toFixed(2)}</span>
                    </div>
                  }
                  {gRate > 0 &&
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ textAlign: 'left', flex: 1 }}>{t("GST@")}{gEff.toFixed(1)}%</span>
                      <span style={{ textAlign: 'right', flexShrink: 0, minWidth: '48px' }}>{gAmt.toFixed(2)}</span>
                    </div>
                  }
                </>);

            })()}
          </div>
          
          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>

          {/* Total & Round off */}
          <div className="flex flex-col pb-1" style={{ display: 'flex', flexDirection: 'column', fontSize: '14px' }}>
            {(() => {
              const sub = Number(bill.subtotal || bill.items?.reduce((acc, curr) => acc + ((curr.price || 0) * (curr.quantity || 1)), 0) || 0);
              const disc = Number(bill.discount || 0);
              const taxable = Math.max(0, sub - disc);
              let finalTotal = Number(bill.total);

              const s = settings || {};
              const cRate = s.enableCgst !== false ? (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5) : 0;
              const sRate = s.enableSgst !== false ? (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5) : 0;
              const gRate = s.enableGst === true ? (s.gstRate !== undefined ? Number(s.gstRate) : 5) : 0;
              const totRate = cRate + sRate + gRate;
              
              const taxRupees = bill.tax !== undefined && bill.tax !== null && Number(bill.tax) > 0
                ? (Number(bill.tax) <= 100 ? (taxable * Number(bill.tax)) / 100 : Number(bill.tax))
                : (totRate > 0 ? (taxable * totRate) / 100 : 0);

              const addCharges = Number(bill.deliveryCharge || 0) + Number(bill.containerCharge || 0);

              // Safeguard: If bill.total is missing, 0, NaN or <= 0 while sub > 0, compute dynamically
              if (!finalTotal || isNaN(finalTotal) || (finalTotal <= 0 && sub > 0)) {
                finalTotal = taxable + taxRupees + addCharges;
              }

              const roundedTotal = Math.round(finalTotal);
              const roundOff = roundedTotal - finalTotal;

              return (
                <>
                  {Number(bill.deliveryCharge || 0) > 0 && (
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
                      <span style={{ textAlign: 'left', flex: 1 }}>{t("Delivery Charge")}</span>
                      <span style={{ textAlign: 'right', flexShrink: 0, minWidth: '48px' }}>{Number(bill.deliveryCharge).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(bill.containerCharge || 0) > 0 && (
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
                      <span style={{ textAlign: 'left', flex: 1 }}>{t("Container Charge")}</span>
                      <span style={{ textAlign: 'right', flexShrink: 0, minWidth: '48px' }}>{Number(bill.containerCharge).toFixed(2)}</span>
                    </div>
                  )}
                  {roundOff !== 0 && (
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ textAlign: 'left', flex: 1 }}>{t("Round off")}</span>
                      <span style={{ textAlign: 'right', flexShrink: 0, minWidth: '48px' }}>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center w-full mt-2" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', fontWeight: 'bold' }}>
                    <span style={{ textAlign: 'left' }}>{t('Grand Total')}</span>
                    <span style={{ textAlign: 'right' }}>{currencySymbol}{roundedTotal.toFixed(2)}</span>
                  </div>
                </>);

            })()}
          </div>

          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>

          {/* Secondary Currencies */}
          {enabledCurrencies.length > 0 &&
          <div className="text-center mt-2 pb-1" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
              <div className="mb-1">{t("Amount in Foreign Currencies:")}</div>
              {enabledCurrencies.map((c) => {
              const foreignAmt = Math.round(bill.total) * (c.rate / baseRate);
              return (
                <div key={c.code} className="flex justify-between px-6" style={{ display: 'flex', width: '100%', justifyContent: 'space-between', paddingLeft: '24px', paddingRight: '24px', fontWeight: 'normal' }}>
                    <span>{c.code}</span>
                    <span>{foreignAmt.toFixed(2)}</span>
                  </div>);

            })}
              <div style={{ borderTop: '1px dashed black', margin: '4px 0', marginTop: '6px' }}></div>
            </div>
          }

          {/* Payment Mode & Entered Breakdown */}
          {(() => {
            const hasSplit = bill.paymentMode === 'Mixed' || (bill.splitPayments && (Number(bill.splitPayments.cash || 0) > 0 || Number(bill.splitPayments.upi || 0) > 0 || Number(bill.splitPayments.card || 0) > 0));
            if (hasSplit) {
              return (
                <div className="my-1.5 pb-1" style={{ fontSize: '13px' }}>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '3px' }}>
                    {t("PAID VIA MIXED PAYMENT")}
                  </div>
                  <div style={{ borderTop: '1px dashed black', margin: '3px 0' }}></div>
                  {Number(bill.splitPayments?.cash || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '1px 0' }}>
                      <span>{t("Cash Paid:")}</span>
                      <span style={{ fontWeight: 'bold' }}>{currencySymbol}{Number(bill.splitPayments.cash).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(bill.splitPayments?.upi || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '1px 0' }}>
                      <span>{t("UPI Paid")} {bill.upiApp || bill.paymentMethod ? `(${bill.upiApp || bill.paymentMethod})` : ''}:</span>
                      <span style={{ fontWeight: 'bold' }}>{currencySymbol}{Number(bill.splitPayments.upi).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(bill.splitPayments?.card || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '1px 0' }}>
                      <span>{t("Card Paid:")}</span>
                      <span style={{ fontWeight: 'bold' }}>{currencySymbol}{Number(bill.splitPayments.card).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px dashed black', margin: '3px 0' }}></div>
                </div>
              );
            } else if (bill.paymentMode === 'Cash') {
              return (
                <div className="text-center mt-1 pb-1" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'normal' }}>
                  <div style={{ fontWeight: 'bold' }}>{t("Paid via Cash")}</div>
                  {bill.amountPaid && Number(bill.amountPaid) > Number(bill.total) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '2px', padding: '0 4px' }}>
                      <span>{t("Tendered:")} {currencySymbol}{Number(bill.amountPaid).toFixed(2)}</span>
                      <span>{t("Change:")} {currencySymbol}{(Number(bill.amountPaid) - Number(bill.total)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            } else if (bill.paymentMode) {
              // Only show UPI app name for UPI/QR payments, not for Card
              const isUpiMode = bill.paymentMode === 'UPI' || bill.paymentMode === 'QR' || bill.paymentMode === 'Online';
              const appSuffix = isUpiMode && (bill.upiApp || bill.paymentMethod) ? ` [${bill.upiApp || bill.paymentMethod}]` : '';
              return (
                <div className="text-center mt-1 pb-1" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'normal' }}>
                  {t("Paid via")} <strong style={{ fontWeight: 'bold' }}>{bill.paymentMode}</strong>{appSuffix}
                </div>
              );
            }
            return null;
          })()}

          {/* UPI Scan to Pay QR Code on Invoice (Encodes exact UPI amount) */}
          {settings.enableQrPayment !== false && (() => {
            const pa = (settings.upiId || '').trim();
            if (!pa) return null;

            const isMixed = bill.paymentMode === 'Mixed';
            const upiSplit = Number(bill.splitPayments?.upi || 0);
            
            // If already fully paid by pure Cash or Card with 0 UPI, do not show UPI QR
            if (bill.status === 'Paid' && !isMixed && (bill.paymentMode === 'Cash' || bill.paymentMode === 'Card')) {
              return null;
            }

            const am = (isMixed && upiSplit > 0)
              ? upiSplit.toFixed(2)
              : Number(bill.total || 0).toFixed(2);
            
            if (Number(am) <= 0) return null;

            const pn = (settings.restaurantName || 'MSBILLINGS').trim();
            const noteText = bill.billNumber ? `Bill #${bill.billNumber} - Rs ${am}` : `Payment Rs ${am}`;
            const tn = noteText.replace(/[^a-zA-Z0-9 .#-]/g, '');
            const tr = `INV${Date.now()}`;
            const qrUri = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;

            return (
              <div className="my-2 text-center flex flex-col items-center justify-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%', margin: '8px auto' }}>
                <div className="uppercase mb-0.5" style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}>
                  {isMixed && upiSplit > 0 ? `${t("SCAN TO PAY UPI PORTION")} (${currencySymbol}${am})` : t("SCAN TO PAY VIA UPI")}
                </div>
                <div className="p-1 bg-white inline-block rounded-md shadow-xs my-1" style={{ display: 'inline-block', margin: '4px auto', textAlign: 'center' }}>
                  <QRCodeSVG
                    value={qrUri}
                    size={100}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              
                <div className="mt-0.5" style={{ fontSize: '13px', fontWeight: 'normal', textAlign: 'center' }}>
                  {t("UPI ID:")} {pa}
                </div>
              </div>
            );
          })()}

          <div className="mt-2 mb-2 text-center" style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
            <p>{settings.footerMessage || t("Thank You | Please visit Again")}</p>
          </div>
          
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Invoice;