import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { findReceiptFont, getReceiptFontMetrics, RECEIPT_FONT_SIZES } from '../utils/receiptFonts';

const LiveReceiptPreview = ({ settings, previewTab, t, user, menuPreviewItems, onChangeFormat }) => {
  const previewFont = findReceiptFont(settings.receiptFontFamily);
  const previewMetrics = getReceiptFontMetrics(settings.receiptFontSize || 'medium', settings.printFormat || '80mm');
  const fmt = settings.printFormat || '80mm';
  
  const paperWidth = fmt === '58mm' ? 210 : fmt === 'A4' ? 360 : 280;
  const previewLabel = fmt === '58mm' ? '58mm Thermal' : fmt === 'A4' ? 'A4 / Full Page' : '80mm Thermal';

  const sampleItems = (menuPreviewItems && menuPreviewItems.length > 0)
    ? menuPreviewItems.slice(0, 3).map((item, idx) => ({
        name: item.name,
        price: Number(item.price || (idx === 0 ? 2999 : 2799)),
        quantity: idx === 0 ? 1 : 1,
        specialNote: idx === 0 ? 'Extra spicy' : ''
      }))
    : [
        { name: 'AL-Mandi Mix Chowki', price: 2999, quantity: 1, specialNote: 'Extra spicy & crispy' },
        { name: 'Chowki - Mutton', price: 2799, quantity: 1, specialNote: '' }
      ];

  const totalQty = sampleItems.reduce((sum, it) => sum + (it.quantity || 1), 0);
  const subTotal = sampleItems.reduce((sum, it) => sum + (it.price * (it.quantity || 1)), 0);
  const cgstAmt = settings.enableCgst !== false ? (subTotal * Number(settings.cgstRate !== undefined ? settings.cgstRate : 2.5)) / 100 : 0;
  const sgstAmt = settings.enableSgst !== false ? (subTotal * Number(settings.sgstRate !== undefined ? settings.sgstRate : 2.5)) / 100 : 0;
  const gstAmt = settings.enableGst === true ? (subTotal * Number(settings.gstRate !== undefined ? settings.gstRate : 5)) / 100 : 0;
  const grandTotal = Math.round(subTotal + cgstAmt + sgstAmt + gstAmt);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Format selector chips */}
      {onChangeFormat && (
        <div className="flex items-center gap-1.5 w-full justify-center flex-wrap">
          {['58mm', '80mm', 'A4'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => onChangeFormat('printFormat', f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                fmt === f
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-red-600 hover:text-red-600'
              }`}>
              {f === 'A4' ? 'A4' : f === '58mm' ? '58mm' : '80mm'}
            </button>
          ))}
          <span className="text-[10px] text-gray-400 font-medium ml-1">{previewLabel}</span>
        </div>
      )}

      {/* Paper Container */}
      <div
        className="bg-white border border-gray-200 rounded-lg shadow-sm transition-all duration-200 overflow-hidden"
        style={{ width: paperWidth, minWidth: paperWidth, maxWidth: paperWidth, margin: '0 auto' }}>
        {/* Paper top edge indicator */}
        <div className="h-1 w-full" style={{
          background: previewTab === 'kot' ? '#ef4444' : (fmt === '58mm' ? '#f97316' : fmt === 'A4' ? '#6366f1' : '#10b981')
        }} />

        {/* Info bar at top of preview */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[9px] text-gray-500 font-sans select-none">
          <span className="font-bold text-red-600 truncate max-w-[55%]">{previewFont.shortName}</span>
          <span className="font-semibold">{RECEIPT_FONT_SIZES.find(s => s.id === (settings.receiptFontSize || 'medium'))?.label || 'Medium'} ({previewMetrics.bodySize})</span>
        </div>

        {/* Tab: KOT Live Preview */}
        {previewTab === 'kot' ? (
          <div
            className="p-3 transition-all duration-150 text-black"
            style={{
              fontFamily: previewFont.value,
              ...(previewFont.previewStyle || {}),
              fontSize: previewMetrics.bodySize,
              lineHeight: previewMetrics.lineHeight,
              color: '#000000',
              backgroundColor: '#ffffff'
            }}>
            {/* Header - Date & Time */}
            <div className="text-center mb-1">
              <div style={{ fontSize: previewMetrics.detailSize }}>
                {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
              <div style={{ fontSize: previewMetrics.headingSize, fontWeight: 'bold', marginTop: '2px' }}>
                KOT No: 42
              </div>
              {/* Kitchen badge */}
              <div style={{
                fontSize: previewMetrics.detailSize,
                fontWeight: 'bold',
                padding: '2px 8px',
                border: '1.5px solid #000',
                display: 'inline-block',
                marginTop: '3px',
                marginBottom: '3px',
                letterSpacing: '0.5px'
              }}>
                [ ALL IN ONE - ALL ]
              </div>
              {/* Queue & Order Type */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: previewMetrics.subHeadingSize,
                fontWeight: 'bold',
                marginTop: '2px',
                marginBottom: '2px'
              }}>
                <span>{t("Queue No:")} #1</span>
                <span>Dine In</span>
              </div>
              {/* Table */}
              <div style={{ fontSize: previewMetrics.subHeadingSize, fontWeight: 'bold', marginTop: '1px' }}>
                {t("Table No: Ground Floor - Table 5")}
              </div>
            </div>

            <div style={{ borderTop: '1.5px dashed #000', margin: '5px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize }}>
              <span>{t("Biller:")} {user?.username || 'admin'}</span>
              <span>{t("Token: #1")}</span>
            </div>

            <div style={{ borderTop: '1.5px dashed #000', margin: '5px 0' }}></div>

            {/* Items Table Header */}
            <div style={{ display: 'flex', width: '100%', marginBottom: '4px', borderBottom: '1px solid black', paddingBottom: '2px', fontWeight: 'bold', fontSize: previewMetrics.detailSize }}>
              <div style={{ flex: '2 1 0%', textAlign: 'left' }}>{t("Item")}</div>
              <div style={{ flex: '1.2 1 0%', textAlign: 'center' }}>{t("Special Note")}</div>
              <div style={{ width: '38px', textAlign: 'right', flexShrink: 0 }}>{t("Qty.")}</div>
            </div>

            {/* Dynamic Items from Menu */}
            <div style={{ marginBottom: '4px' }}>
              {sampleItems.map((item, idx) => (
                <div key={idx} style={{ width: '100%', marginBottom: '4px', paddingBottom: '3px', borderBottom: '1px dashed #e5e7eb' }}>
                  <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start', justifyItems: 'space-between' }}>
                    <div style={{ flex: '2 1 0%', textAlign: 'left', fontWeight: 'bold', fontSize: previewMetrics.itemSize, lineHeight: '1.2', wordBreak: 'break-word', paddingRight: '4px' }}>
                      {item.name}
                    </div>
                    <div style={{ flex: '1.2 1 0%', textAlign: 'center', wordBreak: 'break-word', paddingLeft: '2px', paddingRight: '2px', fontSize: previewMetrics.detailSize, color: item.specialNote ? '#dc2626' : '#9ca3af', fontWeight: item.specialNote ? 'bold' : 'normal' }}>
                      {item.specialNote ? item.specialNote : '-'}
                    </div>
                    <div style={{ width: '38px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold', fontSize: previewMetrics.bodySize }}>
                      x{item.quantity}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1.5px dashed #000', margin: '5px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.bodySize, fontWeight: 'bold' }}>
              <span>{t("Total Items:")}</span>
              <span>{totalQty}</span>
            </div>
          </div>
        ) : (
          /* Tab: Tax Invoice / Receipt Preview */
          <div
            className="p-3 transition-all duration-150 text-black"
            style={{
              fontFamily: previewFont.value,
              ...(previewFont.previewStyle || {}),
              fontSize: previewMetrics.bodySize,
              lineHeight: previewMetrics.lineHeight,
              color: '#000000',
              backgroundColor: '#ffffff'
            }}>
            {/* Logo */}
            {Boolean(settings.logo && settings.logo !== '[logo_stored]' && settings.showLogo !== false) && (
              <div className="flex justify-center mb-1">
                <img
                  src={settings.logo}
                  alt="Logo Preview"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="object-contain"
                  style={{ maxHeight: fmt === '58mm' ? 38 : 48, maxWidth: fmt === '58mm' ? 100 : 120 }}
                />
              </div>
            )}

            {/* Restaurant Header */}
            <div className="text-center" style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: previewMetrics.headingSize, fontWeight: 'bold', lineHeight: '1.15', textTransform: 'uppercase' }}>
                {settings.restaurantName || 'ANAND\'S RESTAURANT'}
              </div>
              <div style={{ fontSize: previewMetrics.detailSize, marginTop: '2px', lineHeight: '1.25', color: '#000000' }}>
                {(settings.address || '123, Flavor Avenue, Banjara Hills, Hyderabad, Telangana 500034').split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                {settings.gstin && <div>GSTIN: {settings.gstin}</div>}
                <div>PH: {settings.phone || '8328470402'}</div>
                {settings.fssai && <div>FSSAI: {settings.fssai}</div>}
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ fontSize: previewMetrics.subHeadingSize, fontWeight: 'bold', textAlign: 'center', margin: '3px 0' }}>
              {t("Tax Invoice")}
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: previewMetrics.bodySize, marginBottom: '2px' }}>
              {t("Dine-In: Ground Floor - Table 5")}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, marginBottom: '2px' }}>
              <span>{t("Date:")} {new Date().toLocaleDateString('en-GB')}</span>
              <span style={{ fontWeight: 'bold' }}>{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, marginBottom: '2px' }}>
              <span>{t("Cashier:")} {user?.username || 'admin'}</span>
              <span style={{ fontWeight: 'bold' }}>{t("Bill No.:")} MS0575</span>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            {fmt === '58mm' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: previewMetrics.detailSize, paddingBottom: '2px' }}>
                <span>ITEM</span>
                <span>AMT</span>
              </div>
            ) : (
              <div style={{ display: 'flex', width: '100%', alignItems: 'center', fontSize: previewMetrics.detailSize, fontWeight: 'bold', paddingBottom: '2px' }}>
                <div style={{ flex: '1 1 0%', textAlign: 'left' }}>{t("Item")}</div>
                <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>{t("Qty.")}</div>
                <div style={{ width: '56px', textAlign: 'right', flexShrink: 0 }}>{t("Price")}</div>
                <div style={{ width: '64px', textAlign: 'right', flexShrink: 0 }}>{t("Amount")}</div>
              </div>
            )}

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '3px 0 5px 0', width: '100%' }}></div>

            <div style={{ marginBottom: '4px' }}>
              {sampleItems.map((item, idx) => (
                fmt === '58mm' ? (
                  <div key={idx} style={{ marginBottom: '4px', paddingBottom: '2px', borderBottom: '1px dashed #e0e0e0' }}>
                    <div style={{ fontWeight: 'bold', fontSize: previewMetrics.itemSize, textAlign: 'left', lineHeight: '1.2' }}>
                      {item.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: previewMetrics.detailSize, marginTop: '1.5px' }}>
                      <span>[{item.price.toFixed(2)}] × {item.quantity}</span>
                      <span style={{ fontWeight: 'bold' }}>{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div key={idx} style={{ display: 'flex', width: '100%', alignItems: 'flex-start', marginBottom: '4px', fontSize: previewMetrics.itemSize }}>
                    <div style={{ flex: '1 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '4px' }}>
                      {item.name}
                    </div>
                    <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>{item.quantity}</div>
                    <div style={{ width: '56px', textAlign: 'right', flexShrink: 0 }}>{item.price.toFixed(2)}</div>
                    <div style={{ width: '64px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold' }}>{(item.price * item.quantity).toFixed(2)}</div>
                  </div>
                )
              ))}
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: previewMetrics.detailSize, padding: '1px 0' }}>
              <span>{t("Total Qty:")} {totalQty}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span>{t("Sub Total:")}</span>
                <span style={{ fontWeight: 'bold' }}>{subTotal.toFixed(2)}</span>
              </div>
            </div>

            {settings.enableCgst !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, padding: '1px 0' }}>
                <span>CGST ({settings.cgstRate !== undefined ? settings.cgstRate : 2.5}%)</span>
                <span>{cgstAmt.toFixed(2)}</span>
              </div>
            )}
            {settings.enableSgst !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, padding: '1px 0' }}>
                <span>SGST ({settings.sgstRate !== undefined ? settings.sgstRate : 2.5}%)</span>
                <span>{sgstAmt.toFixed(2)}</span>
              </div>
            )}
            {settings.enableGst === true && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, padding: '1px 0' }}>
                <span>GST ({settings.gstRate !== undefined ? settings.gstRate : 5}%)</span>
                <span>{gstAmt.toFixed(2)}</span>
              </div>
            )}

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: previewMetrics.grandTotalSize, fontWeight: 'bold', margin: '3px 0' }}>
              <span>{t("Grand Total")}</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ textAlign: 'center', fontSize: previewMetrics.bodySize, fontWeight: 'bold', margin: '3px 0' }}>
              {t("Paid via Cash")}
            </div>

            {settings.enableQrPayment !== false && (settings.upiId || '').trim() && (
              <div style={{ textAlign: 'center', margin: '5px 0' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2px' }}>
                  {t("SCAN TO PAY VIA UPI")}
                </div>
                <div style={{ margin: '3px auto', display: 'inline-block' }}>
                  <QRCodeCanvas
                    value={`upi://pay?pa=${settings.upiId.trim()}&pn=${encodeURIComponent(settings.restaurantName || 'Restaurant')}&am=${grandTotal}&cu=INR`}
                    size={fmt === '58mm' ? 130 : 140}
                    level="L"
                    includeMargin={false}
                  />
                </div>
                <div style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px' }}>
                  {t("UPI ID:")} {settings.upiId.trim()}
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', marginTop: '6px', lineHeight: '1.3' }}>
              {settings.footerMessage || t("*** THANK YOU! VISIT AGAIN ***")}
            </div>
          </div>
        )}

        <div className="h-4 w-full flex items-center justify-center gap-0.5 opacity-30">
          {Array.from({ length: Math.floor(paperWidth / 8) }).map((_, i) => (
            <div key={i} className="w-1 h-3 bg-gray-400 rounded-b-full" />
          ))}
        </div>
      </div>

      <p className="text-[9px] text-gray-400 text-center">
        {t("Live preview reflects your selected font, size, and layout settings.")}
      </p>
    </div>
  );
};

export default LiveReceiptPreview;
