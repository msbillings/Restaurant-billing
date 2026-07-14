import React, { useState, useEffect } from 'react';
import { Printer, ArrowLeft, Download, Save } from 'lucide-react';

const KOT = ({ order, onClose }) => {
  const [settings, setSettings] = useState({
    restaurantName: 'msbillings',
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handlePrint = () => {
    if (window.electronAPI && settings.kotPrinter) {
      const htmlContent = document.getElementById('kot-print-area').outerHTML;
      const isSilent = settings.silentPrinting !== false;
      window.electronAPI.silentPrint(htmlContent, settings.kotPrinter, isSilent);
    } else if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
      window.AndroidPrint.print();
    } else {
      window.print();
    }
  };

  const isPreview = !order.billNumber && !order._id;

  const getFormatClasses = () => {
    switch(settings.printFormat) {
      case 'A4':
        return 'w-full max-w-3xl print:max-w-full';
      case '58mm':
        return 'w-full max-w-[240px] print:max-w-[58mm]';
      case '80mm':
      default:
        return 'w-full max-w-[320px] print:max-w-[80mm]';
    }
  };

  const getPageStyle = () => {
    switch(settings.printFormat) {
      case 'A4': return 'auto';
      case '58mm': return '58mm auto';
      case '80mm':
      default: return '80mm auto';
    }
  };

  return (
    <div id="kot-print-area" className="invoice-container fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-50 overflow-y-auto animate-in fade-in duration-200 items-center p-4 print:p-0">
      <style>
        {`
          @media print {
            @page {
              margin: 0 !important;
              size: ${getPageStyle()};
            }
          }
        `}
      </style>

      {/* Controls - Hidden on Print */}
      <div className="sticky top-4 right-4 flex justify-end gap-3 print:hidden w-full max-w-3xl z-10">
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors font-bold shadow-lg"
        >
          <Printer size={18} />
          <span>Print KOT</span>
        </button>
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors font-medium backdrop-blur-md"
        >
          <ArrowLeft size={18} />
          <span>Close</span>
        </button>
      </div>

      {/* KOT Preview */}
      <div className={`receipt-print bg-white text-black mx-auto shadow-2xl print:shadow-none border border-gray-300 mt-6 mb-10 print:m-0 print:border-0 overflow-hidden ${getFormatClasses()}`} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div className="p-3 print:p-0 print:pb-2 leading-tight" style={{ color: '#000' }}>
          {/* Header */}
          <div className="text-center mb-1">
            <h1 className="text-[14px] print:text-[14px] font-bold uppercase tracking-tight leading-none text-black mb-0.5">{settings.restaurantName}</h1>
            <div className="text-[16px] print:text-[16px] font-bold uppercase tracking-widest text-black">
              K.O.T
            </div>
            {order.kotNumber ? (
              <p className="text-[14px] print:text-[14px] font-bold text-black border-b border-dashed border-black pb-0.5">#{order.kotNumber}</p>
            ) : (
              <p className="text-[12px] print:text-[12px] font-medium text-black border-b border-dashed border-black pb-0.5">(Kitchen Order Ticket)</p>
            )}
          </div>

          {/* Info */}
          <div className="text-[12px] print:text-[12px] font-medium text-black mb-1 flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>Date: {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '-')}</span>
              <span>Time: {new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex justify-between">
              <span>Type: {order.billType || order.orderType || 'Dine-In'}</span>
              <span>{order.orderSource && order.orderSource !== 'Direct' ? `Source: ${order.orderSource}` : ''}</span>
            </div>
          </div>
          
          <div className="text-[16px] print:text-[16px] font-bold text-black mb-1 border-y border-dashed border-black py-0.5 text-center uppercase">
            TABLE: {order.tableNo || 'N/A'}
          </div>

          {order.customerName && (
            <p className="text-[12px] print:text-[12px] font-medium text-black mb-1">Customer: {order.customerName}</p>
          )}

          {/* Items Header */}
          <div className="border-b border-dashed border-black pb-0.5 mb-1">
            <div className="flex text-[12px] print:text-[12px] font-bold uppercase text-black">
              <div className="w-8 text-center">Qty</div>
              <div className="flex-1 pl-1">Item</div>
            </div>
          </div>

          {/* Items List */}
          <div className="mb-1 border-b border-dashed border-black pb-1">
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <div key={idx} className="flex text-[14px] print:text-[14px] font-bold uppercase text-black pb-0.5 items-start">
                  <div className="w-8 text-center">{item.quantity || 0}</div>
                  <div className="flex-1 pl-1 break-words leading-tight">{item.name || 'Unknown Item'}</div>
                </div>
              ))
            ) : (
              <div className="text-[12px] text-center font-medium py-1">No items</div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-[12px] print:text-[12px] font-medium text-black pt-0.5">
            <p>*** END OF KOT ***</p>
          </div>
          
          {/* Cut Line Visual (Screen only) */}
          <div className="mt-6 border-b border-dotted border-gray-400 print:hidden relative">
             <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-black/50 rounded-full"></div>
             <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-black/50 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KOT;
