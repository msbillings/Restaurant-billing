import React, { useState, useEffect } from 'react';
import { Printer, ArrowLeft, Download, Save } from 'lucide-react';

const Invoice = ({ bill, onClose, onSave }) => {
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

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (!parsed.upiId || parsed.upiId === 'msbillings@upi') parsed.upiId = 'maheshsiva864@oksbi';
      setSettings(prev => ({ ...prev, ...parsed }));
    }
  }, []);
  const handlePrint = () => {
    if (window.electronAPI && settings.billingPrinter) {
      const htmlContent = document.getElementById('invoice-print-area').outerHTML;
      const isSilent = settings.silentPrinting !== false;
      window.electronAPI.silentPrint(htmlContent, settings.billingPrinter, isSilent);
    } else if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
      window.AndroidPrint.print();
    } else {
      window.print();
    }
  };
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
    <div id="invoice-print-area" className="invoice-container fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-50 overflow-y-auto animate-in fade-in duration-200 items-center p-4 print:p-0">
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
        {onSave && (
          <button 
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-full hover:bg-success-hover transition-colors font-bold shadow-lg shadow-success/20"
          >
            <Save size={18} />
            <span>Finish</span>
          </button>
        )}
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors font-bold shadow-lg"
        >
          <Printer size={18} />
          <span>Print</span>
        </button>
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors font-medium backdrop-blur-md"
        >
          <ArrowLeft size={18} />
          <span>Close</span>
        </button>
      </div>

      {/* Receipt Preview */}
      <div className={`receipt-print bg-white text-black mx-auto shadow-2xl print:shadow-none border border-gray-300 mt-6 mb-10 print:m-0 print:border-0 overflow-hidden ${getFormatClasses()}`} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div className="p-3 print:p-0 print:pb-2 leading-tight" style={{ color: '#000' }}>
          {/* Header */}
          <div className="text-center mb-2">
            {settings.logo && (
              <div className="flex justify-center mb-1">
                <img src={settings.logo} alt="Restaurant Logo" className="max-h-12 max-w-[120px] object-contain print:max-h-12 print:max-w-[120px]" />
              </div>
            )}
            <h1 className="text-[18px] print:text-[18px] font-bold uppercase tracking-tight text-black m-0 p-0 leading-tight">{settings.restaurantName}</h1>
            <div className="text-[12px] print:text-[12px] font-medium text-black leading-tight mt-0.5">
              {settings.address.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              <div>Tel: {settings.phone}</div>
              {settings.email && <div>Email: {settings.email}</div>}
              {settings.gstin && <div>GSTIN: {settings.gstin}</div>}
              {settings.fssai && <div>FSSAI: {settings.fssai}</div>}
            </div>
          </div>

          <div className="text-center text-[14px] print:text-[14px] font-bold uppercase tracking-wide text-black border-y border-black border-dashed py-0.5 mb-1">
            {bill.billType === 'Delivery' && bill.orderSource && bill.orderSource !== 'Direct' 
              ? `${bill.orderSource} INVOICE` 
              : 'INVOICE'}
          </div>

          {/* Bill Info */}
          <div className="text-[12px] print:text-[12px] font-medium text-black mb-1.5 flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>Bill No: {bill.billNumber || 'PREVIEW'}</span>
              <span>Date: {new Date(bill.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')}</span>
            </div>
            <div className="flex justify-between uppercase">
              <span>{bill.tableNo ? `Table: ${bill.tableNo}` : (bill.billType || '')}</span>
              <span>Time: {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {bill.customerName && (
               <div>Customer: {bill.customerName}</div>
            )}
          </div>

          {/* Items Header */}
          <div className="border-y border-dashed border-black py-0.5 mb-1">
            <div className="flex text-[12px] print:text-[12px] font-bold uppercase text-black">
              <div className="flex-1">Item</div>
              <div className="w-8 text-center">Qty</div>
              <div className="w-16 text-right">Amount</div>
            </div>
          </div>

          {/* Items List */}
          <div className="mb-1 border-b border-dashed border-black pb-1">
            {bill.items && bill.items.length > 0 ? (
              bill.items.map((item, idx) => (
                <div key={idx} className="flex text-[12px] print:text-[12px] font-medium uppercase text-black pb-0.5 items-start">
                  <div className="flex-1 pr-1 break-words">
                    {item.name || 'Unknown Item'}
                    {item.hsnCode ? <span className="text-[10px]"> (HSN:{item.hsnCode})</span> : ''}
                  </div>
                  <div className="w-8 text-center">{item.quantity || 0}</div>
                  <div className="w-16 text-right">{(item.total || (item.price * item.quantity) || 0).toFixed(2)}</div>
                </div>
              ))
            ) : (
              <div className="text-[12px] text-center font-medium py-1">No items</div>
            )}
          </div>

          {/* Tax / Discount / Items summary */}
          <div className="border-b border-dashed border-black pb-1 mb-1 flex flex-col items-end text-[12px] print:text-[12px] font-medium text-black gap-0.5">
            <div className="w-full flex justify-between">
              <span>Items: {bill.items?.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || 0}</span>
              <span>Sub Total: {(bill.subtotal || bill.total || 0).toFixed(2)}</span>
            </div>
            {bill.discount > 0 && <div>Discount: -{(bill.discount || 0).toFixed(2)}</div>}
            
            {(() => {
              const s = settings || {};
              const cRate = s.enableCgst !== false ? (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5) : 0;
              const sRate = s.enableSgst !== false ? (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5) : 0;
              const gRate = s.enableGst === true ? (s.gstRate !== undefined ? Number(s.gstRate) : 5) : 0;
              const totRate = cRate + sRate + gRate;

              const sub = Number(bill.subtotal || bill.total || 0);
              const disc = Number(bill.discount || 0);
              const taxable = Math.max(0, sub - disc);

              let rate = totRate;
              let taxRupees = 0;

              if (bill.tax !== undefined && bill.tax !== null) {
                if (Number(bill.tax) <= 100 && Math.abs(Number(bill.total) - taxable - (taxable * Number(bill.tax)) / 100) <= Math.abs(Number(bill.total) - taxable - Number(bill.tax))) {
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

              if (taxRupees === 0 || rate === 0) return null;

              const cEff = (rate * (cRate / Math.max(1, totRate)));
              const cAmt = taxRupees * (cRate / Math.max(1, totRate));
              const sEff = (rate * (sRate / Math.max(1, totRate)));
              const sAmt = taxRupees * (sRate / Math.max(1, totRate));
              const gEff = (rate * (gRate / Math.max(1, totRate)));
              const gAmt = taxRupees * (gRate / Math.max(1, totRate));

              return (
                <>
                  {cRate > 0 && <div>CGST ({cEff.toFixed(2)}%): {cAmt.toFixed(2)}</div>}
                  {sRate > 0 && <div>SGST ({sEff.toFixed(2)}%): {sAmt.toFixed(2)}</div>}
                  {gRate > 0 && <div>GST ({gEff.toFixed(2)}%): {gAmt.toFixed(2)}</div>}
                </>
              );
            })()}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center text-[16px] print:text-[16px] font-bold text-black border-b border-dashed border-black pb-1 mb-1">
            <span>GRAND TOTAL</span>
            <span>Rs {(() => {
              const sub = Number(bill.subtotal || bill.total || 0);
              const disc = Number(bill.discount || 0);
              const taxable = Math.max(0, sub - disc);
              if (bill.tax !== undefined && bill.tax !== null) {
                return (bill.total || 0).toFixed(2);
              }
              const s = settings || {};
              const cRate = s.enableCgst !== false ? (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5) : 0;
              const sRate = s.enableSgst !== false ? (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5) : 0;
              const gRate = s.enableGst === true ? (s.gstRate !== undefined ? Number(s.gstRate) : 5) : 0;
              const totRate = cRate + sRate + gRate;
              const taxRupees = totRate > 0 ? (taxable * totRate) / 100 : 0;
              return (taxable + taxRupees).toFixed(2);
            })()}</span>
          </div>

          {/* Payment Mode */}
          {bill.paymentMode && (
            <div className="text-[12px] print:text-[12px] font-medium text-black text-center mb-2">
              Paid via {bill.paymentMode}
            </div>
          )}

          {/* UPI Scan to Pay QR Code on Invoice */}
          {settings.enableQrPayment !== false && (
            <div className="my-2 text-center flex flex-col items-center justify-center">
              <div className="text-[11px] print:text-[11px] font-bold uppercase text-black mb-0.5">
                SCAN TO PAY VIA UPI
              </div>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent((() => {
                  const pa = (settings.upiId || 'maheshsiva864@oksbi').trim();
                  const pn = (settings.restaurantName || 'MSBILLINGS').trim();
                  const am = (bill.total || 0).toFixed(2);
                  const tn = `Bill ${bill.billNumber || 'Pay'}`.replace(/[^a-zA-Z0-9 ]/g, '');
                  const tr = `INV${Date.now()}`;
                  return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                })())}`} 
                alt="UPI QR" 
                className="w-20 h-20 mx-auto border border-black p-0.5 bg-white object-contain"
              />
              <div className="text-[11px] print:text-[11px] font-medium text-black mt-0.5">
                UPI ID: {settings.upiId || 'maheshsiva864@oksbi'}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-1 text-center text-[12px] print:text-[12px] font-bold text-black">
            <p>{settings.footerMessage || 'Thank You'}</p>
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

export default Invoice;
