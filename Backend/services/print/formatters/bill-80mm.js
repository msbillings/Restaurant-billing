import { CMD, GS, wrapTextLines, formatTwoCols, generateESCPOSLogoRaster, generateESCPOSQRCodeRaster } from '../utils/escposHelpers.js';

/**
 * Generate a formatted Bill Receipt ESC/POS Buffer for thermal printers (80mm Specific)
 */
export const generateESCPOSBillReceipt80mm = async (bill, printerConfig = {}, restaurantDetails = {}) => {
  const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };

  const width = 44; // 80mm
  const solidLine = Buffer.from('-'.repeat(width) + CMD.LINE_FEED, 'utf-8');

  const fontSize = (s.receiptFontSize || printerConfig.fontSize || 'medium').toLowerCase();
  const fontFamily = (s.receiptFontFamily || '').toLowerCase();
  const isMonospace = fontFamily.includes('mono') || fontFamily.includes('courier') || fontFamily.includes('lucida');

  const restName = (s.restaurantName || 'MS Billings Restaurant').trim();
  const restType = (s.restaurantType || '').trim();
  const restAddress = (s.address || '').trim();
  const restPhone = (s.phone || '').trim();
  const gstin = (s.gstin || s.gstNumber || '').trim();
  const fssai = (s.fssai || s.fssaiNumber || '').trim();

  const chunks = [];

  // Left margin offset for 80mm
  const leftMarginDots = 24;
  const setLeftMarginCmd = GS + 'L' + String.fromCharCode(leftMarginDots & 0xFF, (leftMarginDots >> 8) & 0xFF);
  let initCmd = CMD.INIT + setLeftMarginCmd;

  if (isMonospace) {
    initCmd += CMD.FONT_B;
  } else {
    initCmd += CMD.FONT_A;
  }

  if (fontSize === 'small') {
    initCmd += CMD.LINE_SPACING_COMPACT;
  } else if (fontSize === 'large' || fontSize === 'extra-large') {
    initCmd += CMD.LINE_SPACING_RELAXED;
  } else {
    initCmd += CMD.LINE_SPACING_DEFAULT;
  }
  chunks.push(Buffer.from(initCmd, 'utf-8'));

  // 1. Dynamic Restaurant Logo
  const logoUrl = s.logo || s.restaurantLogo;
  const shouldShowLogo = (s.showLogo !== false && s.showLogo !== 'false' && s.printLogo !== false && s.printLogo !== 'false') && !!logoUrl;
  if (shouldShowLogo) {
    try {
      const logoBuf = await generateESCPOSLogoRaster(logoUrl, false); // is58mm=false
      if (logoBuf && logoBuf.length > 0) {
        chunks.push(logoBuf); 
      }
    } catch (e) {
      console.warn('[PrinterService] Failed to include logo raster:', e.message);
    }
  }

  // 2. Header
  let headerText = '';
  headerText += CMD.ALIGN_CENTER;
  if (printerConfig.printHeader && printerConfig.printHeader.trim()) {
    headerText += printerConfig.printHeader.trim() + CMD.LINE_FEED;
  }
  headerText += CMD.TEXT_DOUBLE_HEIGHT_BOLD + restName.toUpperCase() + CMD.LINE_FEED + CMD.TEXT_NORMAL;
  if (restType) {
    const typeMax = 38;
    const typeLines = wrapTextLines(restType, typeMax);
    typeLines.forEach(l => {
      headerText += l + CMD.LINE_FEED;
    });
  }
  if (restAddress) {
    const addrMax = 38;
    const addrLines = wrapTextLines(restAddress, addrMax);
    addrLines.forEach(l => {
      headerText += l + CMD.LINE_FEED;
    });
  }
  if (gstin) {
    headerText += `GSTIN : ${gstin}` + CMD.LINE_FEED;
  }
  if (restPhone) {
    headerText += `PH : ${restPhone}` + CMD.LINE_FEED;
  }
  if (fssai) {
    headerText += `FSSAI : ${fssai}` + CMD.LINE_FEED;
  }
  chunks.push(Buffer.from(headerText, 'utf-8'));
  chunks.push(solidLine);

  // 3. Invoice Title & Order
  let titleSection = '';
  const invoiceTitle = bill.status === 'Unpaid'
    ? 'Unpaid (Khata)'
    : (bill.discountType === 'complimentary' ? 'Complimentary Bill' : 'Tax Invoice');
  titleSection += CMD.ALIGN_CENTER + CMD.BOLD_ON + invoiceTitle + CMD.LINE_FEED + CMD.BOLD_OFF;
  chunks.push(Buffer.from(titleSection, 'utf-8'));
  chunks.push(solidLine);

  const bType = bill.billType || (bill.tableNo?.startsWith('DEL') ? 'Delivery' : (bill.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine-In'));
  let tableLabel = '';
  if (bType === 'Delivery') {
    const channel = (bill.orderSource || '').trim() || 'DIRECT DELIVERY';
    tableLabel = `DELIVERY: ${channel.toUpperCase()}${bill.tableNo ? ` (${bill.tableNo})` : ''}`;
  } else if (bType === 'Takeaway') {
    tableLabel = `TAKEAWAY${bill.tableNo ? ` (${bill.tableNo})` : ''}`;
  } else {
    tableLabel = `Dine-In: ${bill.tableNo || 'Table'}`;
  }
  let orderMeta = '';
  orderMeta += CMD.ALIGN_CENTER + CMD.BOLD_ON + tableLabel + CMD.LINE_FEED + CMD.BOLD_OFF;
  orderMeta += CMD.ALIGN_LEFT;
  const dateObj = new Date(bill.settledAt || bill.billedAt || bill.createdAt || Date.now());
  const dateStr = `Date: ${dateObj.toLocaleDateString('en-GB')}`;
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  orderMeta += formatTwoCols(dateStr, timeStr, width) + CMD.LINE_FEED;

  const cashierStr = `Cashier: ${bill.cashierName || 'admin'}`;
  const billCleanNo = (bill.billNumber || bill._id?.toString().slice(-6) || 'PREVIEW').replace(/^#/, '');
  const billNoStr = `Bill No.: ${billCleanNo}`;
  orderMeta += formatTwoCols(cashierStr, billNoStr, width) + CMD.LINE_FEED;

  if (bill.captainName) {
    orderMeta += `Assign to: ${bill.captainName}` + CMD.LINE_FEED;
  }
  if (bill.customerName || bill.customerPhone) {
    const custStr = [bill.customerName, bill.customerPhone].filter(Boolean).join(' | ');
    orderMeta += `Customer: ${custStr.substring(0, width - 10)}` + CMD.LINE_FEED;
  }
  chunks.push(Buffer.from(orderMeta, 'utf-8'));
  chunks.push(solidLine);

  // 4. Items Table Header (80mm)
  let itemHead = '';
  const h80Item = 'Item'.padEnd(18, ' ');
  const h80Qty = 'Qty.'.padStart(4, ' ');
  const h80Price = 'Price'.padStart(9, ' ');
  const h80Amt = 'Amount'.padStart(9, ' ');
  itemHead += CMD.BOLD_ON + h80Item + ' ' + h80Qty + ' ' + h80Price + ' ' + h80Amt + CMD.LINE_FEED + CMD.BOLD_OFF;
  chunks.push(Buffer.from(itemHead, 'utf-8'));
  chunks.push(solidLine);

  // 5. Items List
  const activeItems = (bill.items || []).filter(i => !i.isCancelled);
  let totalQty = 0;
  let itemsContent = '';

  activeItems.forEach(item => {
    const qty = (item.quantity || 1) - (item.cancelledQuantity || 0);
    if (qty <= 0) return;
    totalQty += qty;
    const price = Number(item.price || 0).toFixed(2);
    const amount = (Number(item.price || 0) * qty).toFixed(2);
    const name = (item.name || item.itemName || 'Unknown Item').trim();

    const maxLen = 18;
    const itemLines = wrapTextLines(name, maxLen);
    const firstLineItem = (itemLines[0] || '').padEnd(maxLen, ' ');
    const qStr = String(qty).padStart(4, ' ');
    const pStr = price.padStart(9, ' ');
    const aStr = amount.padStart(9, ' ');
    itemsContent += CMD.BOLD_ON + firstLineItem + CMD.BOLD_OFF + ' ' + CMD.BOLD_ON + qStr + CMD.BOLD_OFF + ' ' + pStr + ' ' + CMD.BOLD_ON + aStr + CMD.BOLD_OFF + CMD.LINE_FEED;
    for (let l = 1; l < itemLines.length; l++) {
      itemsContent += CMD.BOLD_ON + `  ${itemLines[l]}` + CMD.BOLD_OFF + CMD.LINE_FEED;
    }

    if (item.specialNote) {
      itemsContent += `  * Note: ${item.specialNote.substring(0, width - 10)}` + CMD.LINE_FEED;
    }
  });

  chunks.push(Buffer.from(itemsContent, 'utf-8'));
  chunks.push(solidLine);

  // 6. Totals
  const sub = Number(bill.subtotal || activeItems.reduce((acc, curr) => acc + (Number(curr.price || 0) * ((curr.quantity || 1) - (curr.cancelledQuantity || 0))), 0) || 0);
  const disc = Number(bill.discount || 0);
  const taxable = Math.max(0, sub - disc);

  let totalsContent = '';
  const subStr = `Sub Total: ${sub.toFixed(2)}`;
  totalsContent += formatTwoCols(`Total Qty: ${totalQty}`, subStr, width) + CMD.LINE_FEED;

  if (disc > 0) {
    const discPct = bill.discountType === 'percentage' && bill.discountValue
      ? ` (${bill.discountValue}%)`
      : (bill.discountType === 'complimentary' ? ' (100%)' : (bill.discountName ? ` (${bill.discountName})` : ''));
    const discLabel = `Discount${discPct}:`;
    const discVal = `-${disc.toFixed(2)}`;
    totalsContent += CMD.BOLD_ON + formatTwoCols(discLabel, discVal, width) + CMD.LINE_FEED + CMD.BOLD_OFF;
  }

  const isCgstEnabled = s.enableCgst !== undefined ? (s.enableCgst === true || s.enableCgst === 'true') : (s.taxSettings?.enableCgst === true || s.taxSettings?.enableCgst === 'true');
  const isSgstEnabled = s.enableSgst !== undefined ? (s.enableSgst === true || s.enableSgst === 'true') : (s.taxSettings?.enableSgst === true || s.taxSettings?.enableSgst === 'true');
  const isGstEnabled = s.enableGst !== undefined ? (s.enableGst === true || s.enableGst === 'true') : (s.taxSettings?.enableGst === true || s.taxSettings?.enableGst === 'true');

  const cRate = isCgstEnabled ? (s.cgstRate !== undefined ? Number(s.cgstRate) : (s.taxSettings?.cgstRate !== undefined ? Number(s.taxSettings.cgstRate) : 2.5)) : 0;
  const sRate = isSgstEnabled ? (s.sgstRate !== undefined ? Number(s.sgstRate) : (s.taxSettings?.sgstRate !== undefined ? Number(s.taxSettings.sgstRate) : 2.5)) : 0;
  const gRate = isGstEnabled ? (s.gstRate !== undefined ? Number(s.gstRate) : (s.taxSettings?.gstRate !== undefined ? Number(s.taxSettings.gstRate) : 5)) : 0;
  const totRate = cRate + sRate + gRate;

  let computedTaxRupees = 0;
  if (bill.tax !== undefined && bill.tax !== null) {
    if (Number(bill.tax) <= 0) {
      computedTaxRupees = 0;
    } else if (Number(bill.tax) <= 100 && Math.abs(Number(bill.total) - taxable - (taxable * Number(bill.tax)) / 100) <= Math.abs(Number(bill.total) - taxable - Number(bill.tax))) {
      computedTaxRupees = (taxable * Number(bill.tax)) / 100;
    } else {
      computedTaxRupees = Number(bill.tax);
    }
  } else if (totRate > 0) {
    computedTaxRupees = (taxable * totRate) / 100;
  }

  if (computedTaxRupees > 0 && totRate > 0) {
    if (cRate > 0 && sRate > 0) {
      const cAmt = computedTaxRupees * (cRate / Math.max(1, totRate));
      const sAmt = computedTaxRupees * (sRate / Math.max(1, totRate));
      totalsContent += formatTwoCols(`CGST@${cRate.toFixed(1)}%:`, cAmt.toFixed(2), width) + CMD.LINE_FEED;
      totalsContent += formatTwoCols(`SGST@${sRate.toFixed(1)}%:`, sAmt.toFixed(2), width) + CMD.LINE_FEED;
    } else if (gRate > 0) {
      totalsContent += formatTwoCols(`GST@${gRate.toFixed(1)}%:`, computedTaxRupees.toFixed(2), width) + CMD.LINE_FEED;
    } else {
      totalsContent += formatTwoCols(`GST/Tax:`, computedTaxRupees.toFixed(2), width) + CMD.LINE_FEED;
    }
  }

  if (Number(bill.deliveryCharge || 0) > 0) {
    totalsContent += formatTwoCols('Delivery Charge:', Number(bill.deliveryCharge).toFixed(2), width) + CMD.LINE_FEED;
  }
  if (Number(bill.containerCharge || 0) > 0) {
    totalsContent += formatTwoCols('Container Charge:', Number(bill.containerCharge).toFixed(2), width) + CMD.LINE_FEED;
  }

  let finalTotal = Number(bill.total || 0);
  const addCharges = Number(bill.deliveryCharge || 0) + Number(bill.containerCharge || 0);
  if (!finalTotal || isNaN(finalTotal) || (finalTotal <= 0 && sub > 0)) {
    finalTotal = taxable + computedTaxRupees + addCharges;
  }
  const roundedTotal = Math.round(finalTotal);
  const roundOff = roundedTotal - finalTotal;
  if (Math.abs(roundOff) > 0.009) {
    totalsContent += formatTwoCols('Round off:', `${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}`, width) + CMD.LINE_FEED;
  }

  chunks.push(Buffer.from(totalsContent, 'utf-8'));
  chunks.push(solidLine);

  // 7. Grand Total
  const grandTotalCols = width;
  const grandTotalRow = formatTwoCols('Grand Total', `Rs.${roundedTotal.toFixed(2)}`, grandTotalCols);
  let grandTotalStr = '';
  grandTotalStr += CMD.ALIGN_LEFT + CMD.TEXT_DOUBLE_HEIGHT_BOLD + grandTotalRow + CMD.LINE_FEED + CMD.TEXT_NORMAL;
  chunks.push(Buffer.from(grandTotalStr, 'utf-8'));
  chunks.push(solidLine);

  // 8. Payment Status
  const hasSplit = bill.paymentMode === 'Mixed' || (bill.splitPayments && (Number(bill.splitPayments.cash || 0) > 0 || Number(bill.splitPayments.upi || 0) > 0 || Number(bill.splitPayments.card || 0) > 0));
  let payStatus = '';
  if (hasSplit) {
    payStatus += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'PAID VIA MIXED PAYMENT' + CMD.LINE_FEED + CMD.BOLD_OFF;
    const parts = [];
    if (Number(bill.splitPayments?.cash || 0) > 0) parts.push(`Cash: Rs.${Number(bill.splitPayments.cash).toFixed(2)}`);
    if (Number(bill.splitPayments?.upi || 0) > 0) parts.push(`UPI: Rs.${Number(bill.splitPayments.upi).toFixed(2)}`);
    if (Number(bill.splitPayments?.card || 0) > 0) parts.push(`Card: Rs.${Number(bill.splitPayments.card).toFixed(2)}`);
    payStatus += parts.join(' | ') + CMD.LINE_FEED;
    chunks.push(Buffer.from(payStatus, 'utf-8'));
    chunks.push(solidLine);
  } else if (bill.status === 'Unpaid') {
    payStatus += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'UNPAID (KHATA BILL)' + CMD.LINE_FEED + CMD.BOLD_OFF;
    chunks.push(Buffer.from(payStatus, 'utf-8'));
    chunks.push(solidLine);
  } else if (bill.paymentMode) {
    const isUpiMode = bill.paymentMode === 'UPI' || bill.paymentMode === 'QR' || bill.paymentMode === 'Online';
    const appSuffix = isUpiMode && (bill.upiApp || bill.paymentMethod) ? ` [${bill.upiApp || bill.paymentMethod}]` : '';
    payStatus += CMD.ALIGN_CENTER + CMD.BOLD_ON + `Paid via ${bill.paymentMode}${appSuffix}` + CMD.LINE_FEED + CMD.BOLD_OFF;
    chunks.push(Buffer.from(payStatus, 'utf-8'));
    chunks.push(solidLine);
  }

  // 9. UPI Scan to Pay QR Code
  const pa = (s.upiId || '').trim();

  if (s.enableQrPayment !== false && pa && roundedTotal > 0) {
    const isMixed = bill.paymentMode === 'Mixed';
    const upiSplit = Number(bill.splitPayments?.upi || 0);
    const am = (isMixed && upiSplit > 0) ? upiSplit.toFixed(2) : roundedTotal.toFixed(2);
    const pn = restName;
    const noteText = bill.billNumber ? `Bill #${bill.billNumber} - Rs ${am}` : `Payment Rs ${am}`;
    const tn = noteText.replace(/[^a-zA-Z0-9 .#-]/g, '');
    const tr = `INV${Date.now()}`;
    const qrUri = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;

    let preQr = '';
    preQr += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'SCAN TO PAY VIA UPI' + CMD.LINE_FEED + CMD.BOLD_OFF;

    const qrRasterBuffer = generateESCPOSQRCodeRaster(qrUri, false);

    let postQr = '';
    postQr += CMD.ALIGN_CENTER + `UPI ID: ${pa}` + CMD.LINE_FEED;

    chunks.push(Buffer.from(preQr, 'utf-8'));
    chunks.push(qrRasterBuffer);
    chunks.push(Buffer.from(postQr, 'utf-8'));
    chunks.push(solidLine);
  }

  // 10. Footer
  let footer = '';
  footer += CMD.ALIGN_CENTER;
  if (printerConfig.printFooter && printerConfig.printFooter.trim()) {
    footer += printerConfig.printFooter.trim() + CMD.LINE_FEED;
  }
  footer += CMD.BOLD_ON + (s.footerMessage || '*** THANK YOU! VISIT AGAIN ***') + CMD.LINE_FEED + CMD.BOLD_OFF;
  footer += CMD.LINE_FEED;
  footer += CMD.CUT_PAPER;
  chunks.push(Buffer.from(footer, 'utf-8'));

  return Buffer.concat(chunks);
};
