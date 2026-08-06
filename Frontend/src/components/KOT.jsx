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
      } else if (window.electronAPI.printPreview) {
        window.electronAPI.printPreview(htmlContent, settings.kotPrinter);
      } else {
        window.electronAPI.silentPrint(htmlContent, settings.kotPrinter, false);
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
        
        <div className="p-3 print:pl-4 print:pr-2 print:py-0 print:pb-2">
          
          {/* Header */}
          <div className="text-center mb-1 flex flex-col gap-0.5" style={{ fontWeight: 'normal' }}>
            <div>
              {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '/')} {new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{t("KOT -")}{order.kotNumber || order.billNumber || 'PREVIEW'}</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{order.billType || order.orderType || 'Dine In'}</div>
            {order.tableNo && <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{t("Table No:")}{order.tableNo}</div>}
          </div>

          <div style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

          {/* Info */}
          <div className="mb-1 flex flex-col" style={{ fontWeight: 'normal' }}>
            {order.captainName && <div>{t("Assign to:")}{order.captainName}</div>}
            {order.captainName && <div>{t("Captain:")}{order.captainName}</div>}
            {!order.captainName && <div>{t("Biller:")}{order.cashierName || 'admin'}</div>}
          </div>
          
          <div style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

          {/* Items Header */}
          <div className="flex mb-1" style={{ fontWeight: 'normal' }}>
            <div className="flex-1">{t("Item")}</div>
            <div className="w-16 text-center">{t("Special")}
              <br />{t("Note")}
            </div>
            <div className="w-8 text-center mt-auto">{t("Qty.")}</div>
          </div>

          {/* Items List */}
          <div className="mb-1">
            {order.items && order.items.length > 0 ?
            order.items.map((item, idx) => {
              const isCancelled = item.status === 'Cancelled' || item.isCancelled;
              return (
                <div key={idx} className="flex items-start mb-1 leading-tight" style={{ fontWeight: 'normal' }}>
                  <div className={`flex-1 pr-1 break-words ${isCancelled ? 'line-through' : ''}`}>
                    {item.name || 'Unknown Item'} {isCancelled ? '(CANCELLED)' : ''}
                  </div>
                  <div className="w-16 text-center text-gray-700 leading-tight">
                    {item.specialNote ? item.specialNote : '--'}
                  </div>
                  <div className={`w-8 text-center ${isCancelled ? 'line-through' : ''}`}>
                    {isCancelled ? 0 : (item.quantity || 0)}
                  </div>
                </div>
              );
            }) :

            <div className="text-center py-1" style={{ fontWeight: 'normal' }}>{t("No items")}</div>
            }
          </div>
          
        </div>
      </div>
    </div>);

};

export default KOT;