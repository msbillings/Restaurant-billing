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

  return (
    <div id="invoice-print-area" className="invoice-container fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-50 overflow-hidden animate-in fade-in duration-200 items-center justify-center p-4 print:p-0">
      {/* Controls - Hidden on Print */}
      <div className="absolute top-4 right-4 flex gap-3 print:hidden">
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
      <div className="receipt-print bg-white text-black w-full max-w-[320px] mx-auto shadow-2xl print:shadow-none border border-gray-300 m-10 print:m-0 print:border-0 overflow-hidden" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div className="p-4 print:p-0 print:pb-2">
          {/* Header */}
          <div className="text-center mb-3 print:mb-2">
            {settings.logo && (
              <div className="flex justify-center mb-2">
                <img src={settings.logo} alt="Restaurant Logo" className="max-h-16 max-w-[160px] object-contain print:max-h-16 print:max-w-[160px]" />
              </div>
            )}
            <h1 className="text-[26px] print:text-[26px] font-[900] font-black uppercase tracking-tight leading-tight text-black">{settings.restaurantName}</h1>
            <div className="text-[15px] print:text-[15px] font-[900] font-black text-black mt-1 leading-snug">
              {settings.address.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
            <p className="text-[15px] print:text-[15px] font-[900] font-black text-black leading-snug">Tel: {settings.phone}</p>
            {settings.email && <p className="text-[15px] print:text-[15px] font-[900] font-black text-black leading-snug">Email: {settings.email}</p>}
            {settings.gstin && <p className="text-[15px] print:text-[15px] font-[900] font-black text-black leading-snug">GSTIN: {settings.gstin}</p>}
            {settings.fssai && <p className="text-[15px] print:text-[15px] font-[900] font-black text-black leading-snug">FSSAI: {settings.fssai}</p>}
          </div>

          <div className="text-center text-[20px] print:text-[20px] font-[900] font-black uppercase tracking-widest text-black mb-2 border-y-2 border-black py-1">
            {bill.billType === 'Delivery' && bill.orderSource && bill.orderSource !== 'Direct' 
              ? `${bill.orderSource} INVOICE` 
              : 'INVOICE'}
          </div>

          {/* Bill Info */}
          <div className="flex justify-between items-center text-[15px] print:text-[15px] font-[900] font-black text-black mb-1">
            <span>{new Date(bill.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')} {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>INVOICE {bill.billNumber || 'PREVIEW'}</span>
          </div>
          <div className="flex justify-between items-center text-[15px] print:text-[15px] font-[900] font-black text-black mb-1 uppercase">
            <span>{bill.tableNo ? `TABLE: ${bill.tableNo}` : ''}</span>
            <span>{bill.billType || ''}</span>
          </div>
          {bill.customerName && (
             <div className="text-[15px] print:text-[15px] font-[900] font-black text-black mb-1">
               CUSTOMER: {bill.customerName}
             </div>
          )}

          {/* Items Header */}
          <div className="border-y-2 border-dashed border-black py-1 mb-1">
            <div className="flex justify-between gap-1 text-[17px] print:text-[17px] font-[900] font-black uppercase text-black">
              <div className="flex-1">ITEM (HSN)</div>
              <div className="text-right">TOTAL</div>
            </div>
          </div>

          {/* Items List */}
          <div className="mb-1 border-b-2 border-dashed border-black pb-2">
            {bill.items && bill.items.length > 0 ? (
              bill.items.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-0.5 text-[17px] print:text-[17px] font-[900] font-black uppercase text-black pb-2 pt-1 border-b-2 border-dashed border-black last:border-0 leading-tight">
                  <div className="break-words">
                    {item.name || 'Unknown Item'}
                    {item.hsnCode ? ` (HSN: ${item.hsnCode})` : ''}
                  </div>
                  <div className="flex justify-between text-[16px] print:text-[16px] font-[900] font-black text-black">
                    <div>{item.quantity || 0} x Rs {(item.price || 0).toFixed(2)}</div>
                    <div>Rs {(item.total || (item.price * item.quantity) || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-center text-black font-[900] font-black py-2">No items</div>
            )}
          </div>

          {/* First Subtotal Line */}
          <div className="border-t-2 border-dashed border-black pt-1 mb-1 text-right text-[16px] print:text-[16px] font-[900] font-black text-black">
            Rs {(bill.subtotal || 0).toFixed(2)}
          </div>

          {/* Tax / Discount / Items summary */}
          <div className="border-t-2 border-dashed border-black pt-1 pb-1 flex flex-col items-end text-[15px] print:text-[15px] font-[900] font-black text-black">
            {bill.discount > 0 && <div>Discount : -Rs {(bill.discount || 0).toFixed(2)}</div>}
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
                  {cRate > 0 && <div>CGST ({cEff.toFixed(2)}%) : Rs {cAmt.toFixed(2)}</div>}
                  {sRate > 0 && <div>SGST ({sEff.toFixed(2)}%) : Rs {sAmt.toFixed(2)}</div>}
                  {gRate > 0 && <div>GST ({gEff.toFixed(2)}%) : Rs {gAmt.toFixed(2)}</div>}
                  {((cRate > 0 && sRate > 0) || ((cRate > 0 || sRate > 0) && gRate > 0)) && (
                    <div>Total Tax ({rate}%) : Rs {taxRupees.toFixed(2)}</div>
                  )}
                </>
              );
            })()}
            <div className="mt-1">Items : {bill.items?.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || 0}</div>
            <div>Sub Total : Rs {(bill.subtotal || bill.total || 0).toFixed(2)}</div>
          </div>

          {/* Total */}
          <div className="text-center py-2">
            <div className="text-[26px] print:text-[26px] font-[900] font-black text-black border-y-2 border-black py-1 my-1">
              Total : Rs {(() => {
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
              })()}
            </div>
          </div>

          {/* Payment Mode */}
          {bill.paymentMode && (
            <div className="text-center mb-4">
              <div className="text-[17px] print:text-[17px] font-[900] font-black text-black mb-1">
                Payment Mode
              </div>
              <div className="text-[17px] print:text-[17px] font-[900] font-black text-black">
                {bill.paymentMode} : {(bill.total || 0).toFixed(2)}
              </div>
            </div>
          )}

          {/* UPI Scan to Pay QR Code on Invoice */}
          {settings.enableQrPayment !== false && (
            <div className="my-3 text-center flex flex-col items-center justify-center border-t border-dashed border-black pt-2 pb-1">
              <div className="text-[16px] print:text-[16px] font-[900] font-black uppercase tracking-wide text-black mb-1">
                SCAN TO PAY VIA UPI
              </div>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent((() => {
                  const pa = (settings.upiId || 'maheshsiva864@oksbi').trim();
                  const pn = (settings.restaurantName || 'MSBILLINGS').trim();
                  const am = (bill.total || 0).toFixed(2);
                  const tn = `Bill ${bill.billNumber || 'Pay'}`.replace(/[^a-zA-Z0-9 ]/g, '');
                  const tr = `INV${Date.now()}`;
                  return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                })())}`} 
                alt="UPI QR" 
                className="w-28 h-28 mx-auto border-2 border-black p-1 bg-white object-contain"
              />
              <div className="text-[14px] print:text-[14px] font-[900] font-black text-black mt-1">
                UPI ID: {settings.upiId || 'maheshsiva864@oksbi'}
              </div>
              <div className="text-[13px] print:text-[13px] text-black font-[900] font-black">
                GPay / PhonePe / Paytm / BHIM
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t-2 border-dashed border-black pt-2 text-center text-[16px] print:text-[16px] font-[900] font-black text-black">
            <p>{settings.footerMessage || 'Thank You'}</p>
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

export default Invoice;
