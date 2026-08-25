import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Printer, ArrowLeft } from 'lucide-react';

const KOT = ({ order, onClose }) => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState({
    restaurantName: 'msbillings'
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handlePrint = () => {
    if (window.electronAPI) {
      const receiptNode = document.querySelector('#kot-print-area .receipt-print');
      const htmlContent = receiptNode ? receiptNode.outerHTML : document.getElementById('kot-print-area').outerHTML;
      const isSilent = settings.silentPrinting !== false;
      if (isSilent && settings.kotPrinter) {
        window.electronAPI.silentPrint(htmlContent, settings.kotPrinter, true);
      } else {
        window.electronAPI.silentPrint(htmlContent, settings.kotPrinter || '', false);
      }
    } else if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
      window.AndroidPrint.print();
    } else {
      window.print();
    }
  };

  const getFormatClasses = () => {
    switch (settings.printFormat) {
      case 'A4':return 'w-full max-w-3xl print:w-full print:max-w-full';
      case '58mm':return 'w-[200px] print:w-[185px] mx-auto print:m-0';
      case '80mm':
      default:return 'w-[280px] print:w-[255px] mx-auto print:m-0';
    }
  };

  return (
    <div id="kot-print-area" className="invoice-container fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-50 overflow-y-auto animate-in fade-in duration-200 items-center p-4 print:p-0">
      <style>
        {`
          @media print {
            @page {
              size: portrait;
              margin: 0 !important;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0;
            }
          }
        `}
      </style>

      {/* Controls - Hidden on Print */}
      <div className="sticky top-2 sm:top-4 right-2 sm:right-4 flex justify-end gap-2 sm:gap-3 print:hidden w-full max-w-3xl z-10 px-2">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-full hover:bg-gray-200 transition-colors shadow-lg touch-target font-bold text-xs sm:text-sm">
          <Printer size={18} />
          <span>{t("Print KOT")}</span>
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors backdrop-blur-md touch-target font-bold text-xs sm:text-sm border border-white/30">
          <ArrowLeft size={18} />
          <span>{t("Close")}</span>
        </button>
      </div>

      {/* KOT Preview */}
      <div
        className={`receipt-print bg-white text-black mx-auto shadow-2xl print:shadow-none mt-6 mb-10 print:m-0 print:border-0 overflow-hidden ${getFormatClasses()}`}
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          color: '#000',
          fontWeight: 'normal',
          fontSize: '14px',
          lineHeight: '1.3'
        }}>
        
        <div style={{ padding: '12px' }}>
          
          {/* Header - Centered */}
          <div className="text-center mb-1" style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div>
              {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '/')} {new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            <div className="text-lg font-bold" style={{ fontSize: '18px', fontWeight: 'bold' }}>{t("KOT -")}{order.kotNumber || order.billNumber || 'PREVIEW'}</div>
            {order.kotNumber && !order.kotNumber.toUpperCase().includes('UPDATE') && (
              <div className="text-base font-bold text-gray-900" style={{ fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>
                {t("Queue No:")} #{order.tokenNo || order.queueNumber || order.kotNumber?.replace(/[^0-9]/g, '') || '1'}
              </div>
            )}
            <div className="text-base font-bold" style={{ fontSize: '16px', fontWeight: 'bold' }}>{order.billType || order.orderType || 'Dine In'}</div>
            {order.tableNo && <div className="text-base font-bold" style={{ fontSize: '16px', fontWeight: 'bold' }}>{t("Table No:")}{order.tableNo}</div>}
          </div>

          <div className="border-t-[1.5px] border-dashed border-black my-1" style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

          {/* Info - Left aligned */}
          <div className="mb-1 text-left" style={{ marginBottom: '4px', textAlign: 'left' }}>
            {order.captainName && <div>{t("Assign to:")}{order.captainName}</div>}
            {order.captainName && <div>{t("Captain:")}{order.captainName}</div>}
            {!order.captainName && <div>{t("Biller:")}{order.cashierName || 'admin'}</div>}
          </div>
          
          <div className="border-t-[1.5px] border-dashed border-black my-1" style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

          {/* Items Header - Row layout */}
          <div className="flex w-full mb-1 font-bold border-b border-black pb-1" style={{ display: 'flex', width: '100%', marginBottom: '4px', borderBottom: '1px solid black', paddingBottom: '2px', fontWeight: 'bold' }}>
            <div className="flex-1 text-left" style={{ flex: '1 1 0%', textAlign: 'left' }}>{t("Item")}</div>
            <div className="w-12 text-right shrink-0" style={{ width: '48px', textAlign: 'right', flexShrink: 0 }}>{t("Qty.")}</div>
          </div>

          {/* Items List */}
          <div className="mb-1" style={{ marginBottom: '4px' }}>
            {order.items && order.items.length > 0 ?
            order.items.map((item, idx) => {
              const isCancelled = item.status === 'Cancelled' || item.isCancelled;
              const isReduced = !isCancelled && (item.reducedQuantity > 0);
              const cancelCount = item.cancelledQuantity || item.quantity || 1;
              return (
                <div key={idx} className="flex flex-col w-full mb-1.5 pb-1 border-b border-dashed border-gray-200" style={{ width: '100%', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px dashed #e5e7eb' }}>
                  <div className="flex w-full items-start justify-between">
                    <div className={`flex-1 text-left pr-2 break-words font-bold ${isCancelled ? 'line-through text-red-600' : ''}`} style={{ flex: '1 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '8px', textDecoration: isCancelled ? 'line-through' : 'none', color: isCancelled ? '#dc2626' : '#000', fontWeight: 'bold' }}>
                      {item.name || 'Unknown Item'}
                      {isCancelled && <span className="text-xs ml-1 font-black text-red-600" style={{ fontSize: '11px', marginLeft: '4px', color: '#dc2626', fontWeight: 'bold' }}>({t("CANCELLED")})</span>}
                      {isReduced && <span className="text-xs ml-1 font-black text-red-500" style={{ fontSize: '11px', marginLeft: '4px', color: '#ef4444', fontWeight: 'bold' }}>(-{item.reducedQuantity}x {t("Reduced")})</span>}
                    </div>
                    <div className={`w-12 text-right font-black font-mono shrink-0 ${isCancelled ? 'line-through text-red-600' : ''}`} style={{ width: '48px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold', textDecoration: isCancelled ? 'line-through' : 'none', color: isCancelled ? '#dc2626' : '#000' }}>
                      {isCancelled ? `-${cancelCount}` : (item.quantity || 0)}
                    </div>
                  </div>
                  {item.specialNote && (
                    <div className="text-xs text-gray-700 italic mt-0.5 pl-2" style={{ fontSize: '11px', color: '#374151', fontStyle: 'italic', paddingLeft: '8px', marginTop: '2px' }}>
                      * {item.specialNote}
                    </div>
                  )}
                </div>
              );
            }) :

            <div className="text-center py-1" style={{ textAlign: 'center', padding: '4px 0' }}>{t("No items")}</div>
            }
          </div>
          
        </div>
      </div>
    </div>);

};

export default KOT;