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
        <div className="p-4 print:p-0 print:pb-2">
          {/* Header */}
          <div className="text-center mb-3 print:mb-0">
            <h1 className="text-[26px] print:text-[26px] font-[900] font-black uppercase tracking-tight leading-tight text-black">{settings.restaurantName}</h1>
            <div className="text-[22px] print:text-[22px] font-[900] font-black uppercase tracking-widest text-black mt-1 print:mt-0 mb-1">
              K.O.T
            </div>
            {order.kotNumber ? (
              <p className="text-[20px] print:text-[20px] font-[900] font-black text-black border-b-2 border-dashed border-black pb-1">#{order.kotNumber}</p>
            ) : (
              <p className="text-[17px] print:text-[17px] font-[900] font-black text-black border-b-2 border-dashed border-black pb-1">(Kitchen Order Ticket)</p>
            )}
          </div>

          {/* Info */}
          <div className="flex justify-between items-center text-[16px] print:text-[16px] font-[900] font-black text-black mb-1">
            <span>{new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '-')} {new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>TYPE: {order.billType || order.orderType || 'Dine-In'}</span>
          </div>
          <div className="text-[22px] print:text-[22px] font-[900] font-black text-black mb-1 border-b-2 border-dashed border-black pb-1">
            TABLE: {order.tableNo || 'N/A'}
          </div>
          {order.orderSource && order.orderSource !== 'Direct' && (
            <p className="text-[18px] print:text-[18px] font-[900] font-black text-black mb-1">{order.orderSource} ORDER</p>
          )}
          {order.customerName && (
            <p className="text-[17px] print:text-[17px] font-[900] font-black text-black mb-1">CUSTOMER: {order.customerName}</p>
          )}

          {/* Items Header */}
          <div className="border-y-2 border-dashed border-black py-1 mb-1">
            <div className="flex justify-between gap-1 text-[18px] print:text-[18px] font-[900] font-black uppercase text-black">
              <div className="w-[45px] text-center">QTY</div>
              <div className="flex-1">ITEM</div>
            </div>
          </div>

          {/* Items List */}
          <div className="mb-2 border-b-2 border-dashed border-black pb-2">
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between gap-2 text-[20px] print:text-[20px] font-[900] font-black uppercase text-black pb-2 pt-1 border-b-2 border-dashed border-black last:border-0 leading-tight">
                  <div className="w-[45px] text-center text-[22px] print:text-[22px] font-[900] font-black">{item.quantity || 0}</div>
                  <div className="flex-1 break-words font-[900] font-black">{item.name || 'Unknown Item'}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-center text-black font-[900] font-black py-2">No items</div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-[16px] print:text-[16px] font-[900] font-black text-black pt-1">
            <p>*** END OF KOT ***</p>
          </div>
          
          {/* Cut Line Visual (Screen only) */}
          <div className="mt-8 border-b-4 border-dotted border-gray-300 print:hidden relative">
             <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black/80 rounded-full"></div>
             <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-black/80 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KOT;
