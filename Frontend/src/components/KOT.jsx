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
      case 'A4': return 'w-full max-w-3xl print:w-full print:max-w-full';
      case '58mm': return 'w-[200px] print:w-full print:max-w-full print:m-0';
      case '80mm':
      default: return 'w-[280px] print:w-full print:max-w-full print:m-0';
    }
  };

  return (
    <div id="kot-print-area" className="invoice-container fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] overflow-y-auto overflow-x-hidden animate-in fade-in duration-200 p-4 print:p-0 print:block print:w-full print:h-full">
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
      <div className="sticky top-4 flex items-center justify-center sm:justify-end gap-2.5 print:hidden w-full max-w-xl mx-auto z-30 px-3 py-2 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl mb-4">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-900 rounded-xl hover:bg-gray-100 transition-all shadow-md font-bold text-xs sm:text-sm active:scale-95 cursor-pointer">
          <Printer size={16} />
          <span>{t("Print KOT")}</span>
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-md font-bold text-xs sm:text-sm active:scale-95 cursor-pointer">
          <ArrowLeft size={16} />
          <span>{t("Close")}</span>
        </button>
      </div>

      {/* KOT Preview */}
      <div
        className={`receipt-print bg-white text-black mx-auto shadow-2xl print:shadow-none my-6 print:m-0 print:border-0 overflow-hidden ${getFormatClasses()}`}
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          color: '#000',
          fontWeight: 'normal',
          fontSize: '13px',
          lineHeight: '1.3',
          width: '100%'
        }}>
        
        <div style={{ padding: '0 8px', boxSizing: 'border-box' }}>
          
          {/* Header - Centered */}
          <div className="text-center mb-1" style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div>
              {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '/')} {new Date(order.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
            <div className="text-lg font-bold" style={{ fontSize: '18px', fontWeight: 'bold' }}>{t("KOT -")}{order.kotNumber || order.billNumber || 'PREVIEW'}</div>
            {order.kotNumber && !order.kotNumber.toUpperCase().includes('UPDATE') && (
              <div className="text-base font-bold text-gray-900" style={{ fontSize: '15px', fontWeight: 'bold', color: '#111827' }}>
                {t("Queue No:")} #{order.queueNumber || order.tokenNo || '1'}
              </div>
            )}
            {(() => {
              const bType = order.billType || order.orderType || (order.tableNo?.startsWith('DEL') ? 'Delivery' : (order.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
              if (bType === 'Delivery') {
                const partner = (order.orderSource || '').trim() || 'DIRECT';
                return (
                  <>
                    <div className="text-lg font-black text-red-600 tracking-wider uppercase" style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626' }}>
                      DELIVERY: {partner.toUpperCase()}
                    </div>
                    <div className="text-base font-bold" style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      Order #{order.tableNo}
                    </div>
                  </>
                );
              } else if (bType === 'Takeaway') {
                return (
                  <div className="text-lg font-black text-blue-600 tracking-wider uppercase" style={{ fontSize: '18px', fontWeight: '900', color: '#2563eb' }}>
                    TAKEAWAY {order.tableNo ? `(${order.tableNo})` : ''}
                  </div>
                );
              } else {
                return (
                  <>
                    <div className="text-base font-bold" style={{ fontSize: '16px', fontWeight: 'bold' }}>Dine In</div>
                    {order.tableNo && <div className="text-base font-bold" style={{ fontSize: '16px', fontWeight: 'bold' }}>{t("Table No: ")}{order.tableNo}</div>}
                  </>
                );
              }
            })()}
            {order.customerName && (
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>
                Customer: {order.customerName} {order.customerPhone ? `(${order.customerPhone})` : ''}
              </div>
            )}
          </div>

          <div className="border-t-[1.5px] border-dashed border-black my-1" style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

          {/* Info - Left aligned */}
          <div className="mb-1 text-left" style={{ marginBottom: '4px', textAlign: 'left' }}>
            {order.captainName && <div>{t("Assign to:")}{order.captainName}</div>}
            {order.captainName && <div>{t("Captain:")}{order.captainName}</div>}
            {!order.captainName && <div>{t("Biller:")}{order.cashierName || 'admin'}</div>}
          </div>
          
          <div className="border-t-[1.5px] border-dashed border-black my-1" style={{ borderTop: '1.5px dashed black', margin: '4px 0' }}></div>

          {/* Items Header - 3 Column Layout */}
          <div className="flex w-full mb-1 font-bold border-b border-black pb-1 text-xs sm:text-sm" style={{ display: 'flex', width: '100%', marginBottom: '4px', borderBottom: '1px solid black', paddingBottom: '2px', fontWeight: 'bold' }}>
            <div className="text-left pr-1" style={{ flex: '2 1 0%', textAlign: 'left', paddingRight: '4px' }}>{t("Item")}</div>
            <div className="text-center px-1" style={{ flex: '1.2 1 0%', textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>{t("Special Note")}</div>
            <div className="text-right shrink-0" style={{ width: '38px', textAlign: 'right', flexShrink: 0 }}>{t("Qty.")}</div>
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
                  <div className="flex w-full items-start justify-between" style={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div className={`text-left pr-1 break-words font-bold ${isCancelled ? 'line-through text-red-600' : ''}`} style={{ flex: '2 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '4px', textDecoration: isCancelled ? 'line-through' : 'none', color: isCancelled ? '#dc2626' : '#000', fontWeight: 'bold' }}>
                      {item.name || 'Unknown Item'}
                      {isCancelled && <span className="text-[10px] ml-1 font-black text-red-600" style={{ fontSize: '10px', marginLeft: '4px', color: '#dc2626', fontWeight: 'bold' }}>({t("CANCELLED")})</span>}
                      {isReduced && <span className="text-[10px] ml-1 font-black text-red-500" style={{ fontSize: '10px', marginLeft: '4px', color: '#ef4444', fontWeight: 'bold' }}>(-{item.reducedQuantity}x {t("Reduced")})</span>}
                    </div>
                    <div className="text-center px-1 break-words text-xs" style={{ flex: '1.2 1 0%', textAlign: 'center', wordBreak: 'break-word', paddingLeft: '2px', paddingRight: '2px', fontSize: '11px', color: item.specialNote ? '#dc2626' : '#9ca3af', fontWeight: item.specialNote ? 'bold' : 'normal' }}>
                      {item.specialNote ? item.specialNote : '-'}
                    </div>
                    <div className={`text-right font-black font-mono shrink-0 ${isCancelled ? 'line-through text-red-600' : ''}`} style={{ width: '38px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold', textDecoration: isCancelled ? 'line-through' : 'none', color: isCancelled ? '#dc2626' : '#000' }}>
                      {isCancelled ? `-${cancelCount}` : (item.quantity || 0)}
                    </div>
                  </div>
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