import React, { useState, useEffect } from 'react';
import { Printer, ArrowLeft, Save } from 'lucide-react';

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
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (!parsed.upiId || parsed.upiId === 'msbillings@upi') parsed.upiId = 'maheshsiva864@oksbi';
      setSettings(prev => ({ ...prev, ...parsed }));
    }
  }, []);
  
  const handlePrint = () => {
    if (window.electronAPI && settings.billingPrinter) {
      const receiptNode = document.querySelector('#invoice-print-area .receipt-print');
      const htmlContent = receiptNode ? receiptNode.outerHTML : document.getElementById('invoice-print-area').outerHTML;
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
      case 'A4': return 'w-full max-w-3xl print:w-full print:max-w-full';
      case '58mm': return 'w-[200px] print:w-[185px] mx-auto print:m-0';
      case '80mm':
      default: return 'w-[280px] print:w-[255px] mx-auto print:m-0';
    }
  };

  return (
    <div id="invoice-print-area" className="invoice-container fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-50 overflow-y-auto animate-in fade-in duration-200 items-center p-4 print:p-0 print:block print:w-full print:h-full">
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
      <div className="sticky top-4 right-4 flex justify-end gap-3 print:hidden w-full max-w-3xl z-10">
        {onSave && (
          <button 
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-full hover:bg-success-hover transition-colors shadow-lg shadow-success/20"
          >
            <Save size={18} />
            <span>Finish</span>
          </button>
        )}
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors shadow-lg"
        >
          <Printer size={18} />
          <span>Print</span>
        </button>
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors backdrop-blur-md"
        >
          <ArrowLeft size={18} />
          <span>Close</span>
        </button>
      </div>

      {/* Receipt Preview */}
      <div 
        className={`receipt-print bg-white text-black mx-auto shadow-2xl print:shadow-none mt-6 mb-10 print:m-0 print:border-0 overflow-hidden ${getFormatClasses()}`} 
        style={{ 
          fontFamily: "Arial, Helvetica, sans-serif", 
          color: '#000', 
          fontWeight: 'normal',
          fontSize: '14px',
          lineHeight: '1.3'
        }}
      >
        <div className="p-3 print:pl-4 print:pr-2 print:py-0 print:pb-2">
          
          {/* Header */}
          <div className="text-center mb-2">
            {settings.logo && (
              <div className="flex justify-center mb-1">
                <img src={settings.logo} alt="Restaurant Logo" className="max-h-12 max-w-[120px] object-contain print:max-h-12 print:max-w-[120px]" />
              </div>
            )}
            <div style={{ fontSize: '20px', lineHeight: '1.1', marginBottom: '4px', fontWeight: 'bold' }}>
              {settings.restaurantName.toUpperCase()}
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.2', fontWeight: 'normal' }}>
              {settings.address.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {settings.gstin && <div>GSTIN : {settings.gstin}</div>}
              <div>PH : {settings.phone}</div>
              {settings.fssai && <div>FSSAI : {settings.fssai}</div>}
            </div>
          </div>

          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>
          
          <div style={{ fontSize: '18px', textAlign: 'center', margin: '4px 0', fontWeight: 'bold' }}>
            {bill.discount === 100 || bill.total === 0 ? 'Complimentary Bill' : 'Tax Invoice'}
          </div>

          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>
          
          {bill.customerName && (
            <>
              <div style={{ fontSize: '14px', fontWeight: 'normal' }}>
                Name: {bill.customerName}
              </div>
              <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>
            </>
          )}

          {/* Bill Info Grid */}
          <div className="flex justify-between mb-1" style={{ fontSize: '14px', fontWeight: 'normal' }}>
            <div className="flex flex-col gap-0.5">
              <div>Date: {new Date(bill.createdAt).toLocaleDateString('en-GB').replace(/\//g, '/')}</div>
              <div>{new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
              <div>Cashier: {bill.cashierName || 'admin'}</div>
              {bill.tokenNumber && <div style={{ fontWeight: 'bold' }}>Token No.: {bill.tokenNumber}</div>}
            </div>
            <div className="flex flex-col text-right gap-0.5">
              <div style={{ fontWeight: 'bold' }}>{bill.tableNo ? `Dine-In: ${bill.tableNo}` : (bill.billType || 'Dine-In')}</div>
              <div style={{ fontWeight: 'bold' }}>Bill No.: {bill.billNumber || 'PREVIEW'}</div>
              {bill.captainName && <div>Assign to: {bill.captainName}</div>}
            </div>
          </div>

          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>

          {/* Items Header */}
          <div className="flex pb-0.5" style={{ fontSize: '14px', fontWeight: 'normal' }}>
            <div className="flex-1">Item</div>
            <div className="w-8 text-right">Qty.</div>
            <div className="w-14 text-right">Price</div>
            <div className="w-16 text-right">Amount</div>
          </div>

          <div style={{ borderTop: '1px solid black', margin: '2px 0 4px 0' }}></div>

          {/* Items List */}
          <div className="mb-1 pb-1" style={{ borderBottom: '1px solid black' }}>
            {bill.items && bill.items.length > 0 ? (
              bill.items.map((item, idx) => (
                <div key={idx} className="flex items-start mb-1 leading-tight" style={{ fontSize: '14px', fontWeight: 'normal' }}>
                  <div className="flex-1 pr-1 break-words">
                    {item.name || 'Unknown Item'}
                    {item.hsnCode ? <span style={{ fontSize: '12px' }}> (HSN:{item.hsnCode})</span> : ''}
                  </div>
                  <div className="w-8 text-right">{item.quantity || 0}</div>
                  <div className="w-14 text-right">{(item.price || 0).toFixed(2)}</div>
                  <div className="w-16 text-right">{(item.total || (item.price * item.quantity) || 0).toFixed(2)}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-1" style={{ fontSize: '14px', fontWeight: 'normal' }}>No items</div>
            )}
          </div>

          {/* Tax / Discount / Items summary */}
          <div className="flex flex-col gap-0.5 mt-1" style={{ fontSize: '14px', fontWeight: 'normal' }}>
            <div className="flex justify-between w-full">
              <span className="text-left w-24">Total Qty: {bill.items?.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || 0}</span>
              <div className="flex-1 flex justify-between pl-2">
                <span className="text-left">Sub Total</span>
                <span className="w-16 text-right">{(bill.subtotal || bill.total || 0).toFixed(2)}</span>
              </div>
            </div>
            {bill.discount > 0 && 
              <div className="flex justify-between w-full">
                <span className="w-24"></span>
                <div className="flex-1 flex justify-between pl-2">
                  <span className="text-left">Discount</span>
                  <span className="w-16 text-right">-{(bill.discount || 0).toFixed(2)}</span>
                </div>
              </div>
            }
            
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
                  {cRate > 0 && 
                    <div className="flex justify-between w-full">
                      <span className="w-24"></span>
                      <div className="flex-1 flex justify-between pl-2">
                        <span className="text-left">CGST@{cEff.toFixed(1)}%</span>
                        <span className="w-16 text-right">{cAmt.toFixed(2)}</span>
                      </div>
                    </div>
                  }
                  {sRate > 0 && 
                    <div className="flex justify-between w-full">
                      <span className="w-24"></span>
                      <div className="flex-1 flex justify-between pl-2">
                        <span className="text-left">SGST@{sEff.toFixed(1)}%</span>
                        <span className="w-16 text-right">{sAmt.toFixed(2)}</span>
                      </div>
                    </div>
                  }
                  {gRate > 0 && 
                    <div className="flex justify-between w-full">
                      <span className="w-24"></span>
                      <div className="flex-1 flex justify-between pl-2">
                        <span className="text-left">GST@{gEff.toFixed(1)}%</span>
                        <span className="w-16 text-right">{gAmt.toFixed(2)}</span>
                      </div>
                    </div>
                  }
                </>
              );
            })()}
          </div>
          
          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>

          {/* Total & Round off */}
          <div className="flex flex-col pb-1" style={{ fontSize: '14px' }}>
            {(() => {
              const sub = Number(bill.subtotal || bill.total || 0);
              const disc = Number(bill.discount || 0);
              const taxable = Math.max(0, sub - disc);
              let finalTotal = bill.total;
              
              if (bill.tax === undefined || bill.tax === null) {
                const s = settings || {};
                const cRate = s.enableCgst !== false ? (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5) : 0;
                const sRate = s.enableSgst !== false ? (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5) : 0;
                const gRate = s.enableGst === true ? (s.gstRate !== undefined ? Number(s.gstRate) : 5) : 0;
                const totRate = cRate + sRate + gRate;
                const taxRupees = totRate > 0 ? (taxable * totRate) / 100 : 0;
                finalTotal = taxable + taxRupees;
              }
              
              const roundedTotal = Math.round(finalTotal);
              const roundOff = roundedTotal - finalTotal;

              return (
                <>
                  <div className="flex justify-between w-full">
                    <span className="w-24"></span>
                    <div className="flex-1 flex justify-between pl-2" style={{ fontWeight: 'normal' }}>
                      <span className="text-left">Round off</span>
                      <span className="w-16 text-right">{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center w-full mt-2" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    <span>Grand Total</span>
                    <span>₹{roundedTotal.toFixed(2)}</span>
                  </div>
                </>
              );
            })()}
          </div>

          <div style={{ borderTop: '1px solid black', margin: '4px 0' }}></div>

          {/* Payment Mode */}
          {bill.paymentMode && (
            <div className="text-center mt-1 pb-1" style={{ fontSize: '14px', fontWeight: 'normal' }}>
              Paid via {bill.paymentMode} {bill.paymentMethod ? `[${bill.paymentMethod}]` : ''}
            </div>
          )}

          {/* UPI Scan to Pay QR Code on Invoice */}
          {settings.enableQrPayment !== false && (
            <div className="my-2 text-center flex flex-col items-center justify-center">
              <div className="uppercase mb-0.5" style={{ fontSize: '14px', fontWeight: 'normal' }}>
                SCAN TO PAY VIA UPI
              </div>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent((() => {
                  const pa = (settings.upiId || 'maheshsiva864@oksbi').trim();
                  const pn = (settings.restaurantName || 'MSBILLINGS').trim();
                  const am = (bill.total || 0).toFixed(2);
                  const tn = `Bill ${bill.billNumber || 'Pay'}`.replace(/[^a-zA-Z0-9 ]/g, '');
                  const tr = `INV${Date.now()}`;
                  return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                })())}`} 
                alt="UPI QR" 
                className="w-24 h-24 mx-auto p-0.5 bg-white object-contain"
              />
              <div className="mt-0.5" style={{ fontSize: '14px', fontWeight: 'normal' }}>
                UPI ID: {settings.upiId || 'maheshsiva864@oksbi'}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-2 mb-2 text-center" style={{ fontSize: '14px', fontWeight: 'bold' }}>
            <p>Thank You | Please visit Again</p>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Invoice;
