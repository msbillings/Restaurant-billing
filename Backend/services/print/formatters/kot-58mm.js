import { CMD, GS, wrapTextLines, formatTwoCols } from '../utils/escposHelpers.js';

/**
 * Generate a formatted KOT ESC/POS Buffer for thermal printers (58mm Specific)
 */
export const generateKOTESCPOSBuffer58mm = (bill, items, kotNumber, printerConfig = {}, queueNumber, restaurantDetails = {}) => {
  const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };

  const width = 30; // 58mm
  const lineDivider = '-'.repeat(width);

  const fontSize = (s.receiptFontSize || printerConfig.fontSize || 'medium').toLowerCase();
  
  // Left margin offset for 58mm
  const leftMarginDots = 12;
  const setLeftMarginCmd = GS + 'L' + String.fromCharCode(leftMarginDots & 0xFF, (leftMarginDots >> 8) & 0xFF);

  let content = '';
  content += CMD.INIT + setLeftMarginCmd;
  content += CMD.FONT_A;

  if (fontSize === 'small') {
    content += CMD.LINE_SPACING_COMPACT;
  } else if (fontSize === 'large' || fontSize === 'extra-large') {
    content += CMD.LINE_SPACING_RELAXED;
  } else {
    content += CMD.LINE_SPACING_DEFAULT;
  }

  // 1. Date & Time Centered
  content += CMD.ALIGN_CENTER;
  const d = new Date(bill.createdAt || Date.now());
  const dateStr = `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  content += dateStr + CMD.LINE_FEED;

  // 2. KOT Number
  let rawKot = (kotNumber || bill.kotNumber || '1').toString().trim();
  let numOnly = rawKot.replace(/^[A-Za-z\s-]+/i, '').trim();
  const kotLabel = rawKot.toUpperCase().includes('UPDATE') ? rawKot : (numOnly ? `KOT No: ${numOnly}` : `KOT No: ${rawKot}`);
  content += CMD.ALIGN_CENTER + CMD.TEXT_DOUBLE_HEIGHT_BOLD + kotLabel + CMD.LINE_FEED + CMD.TEXT_NORMAL;

  // 3. Station Badge
  const kitchenTitle = (printerConfig.name || printerConfig.assignTo || '').trim().toUpperCase();
  const locationSub = printerConfig.location ? ` - ${printerConfig.location.trim().toUpperCase()}` : '';
  if (kitchenTitle && kitchenTitle !== 'KITCHEN') {
    content += CMD.ALIGN_CENTER + CMD.BOLD_ON + `[ ${kitchenTitle}${locationSub} ]` + CMD.BOLD_OFF + CMD.LINE_FEED;
  }

  // 4. Queue No & Dine-In / Delivery
  const queueNo = queueNumber || bill.tokenNo || bill.queueNumber || '1';
  const bType = bill.billType || bill.orderType || (bill.tableNo?.startsWith('DEL') ? 'Delivery' : (bill.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
  let typeStr = 'Dine In';
  if (bType === 'Delivery') {
    const partner = (bill.orderSource || '').trim();
    typeStr = `Delivery${partner ? `: ${partner.toUpperCase()}` : ''}`;
  } else if (bType === 'Takeaway') {
    typeStr = 'Takeaway';
  } else {
    typeStr = 'Dine In';
  }
  const queueStr = `Queue No: #${queueNo}`;
  content += CMD.BOLD_ON + formatTwoCols(queueStr, typeStr, width) + CMD.LINE_FEED + CMD.BOLD_OFF;

  // 5. Table Number
  let tableLabel = '';
  if (bType === 'Delivery') {
    tableLabel = `Order #${bill.tableNo || 'DEL'}`;
  } else if (bType === 'Takeaway') {
    tableLabel = bill.tableNo ? `Order #${bill.tableNo}` : '';
  } else {
    const tClean = (bill.tableNo || '').replace(/^Table\s*/i, '').trim();
    tableLabel = tClean ? `Table No: ${bill.tableNo.includes('Table') ? bill.tableNo : `Table ${tClean}`}` : 'Table No: Dine In';
  }
  if (tableLabel) {
    content += CMD.ALIGN_CENTER + CMD.THICK_BOLD_ON + tableLabel + CMD.LINE_FEED + CMD.THICK_BOLD_OFF;
  }
  if (bill.customerName) {
    const cust = `Customer: ${bill.customerName}${bill.customerPhone ? ` (${bill.customerPhone})` : ''}`;
    content += CMD.ALIGN_CENTER + cust.substring(0, width) + CMD.LINE_FEED;
  }

  content += lineDivider + CMD.LINE_FEED;

  // 7. Biller Info
  content += CMD.ALIGN_LEFT;
  const cashier = bill.cashierName || bill.billerName || 'admin';
  const billerLine = `Biller: ${cashier}`;
  if (bill.captainName) {
    content += formatTwoCols(billerLine, `Assign: ${bill.captainName}`, width) + CMD.LINE_FEED;
  } else {
    content += billerLine + CMD.LINE_FEED;
  }

  content += lineDivider + CMD.LINE_FEED;

  // 9. Items Header 58mm
  const header58 = 'Item'.padEnd(15, ' ') + ' ' + 'Note'.padEnd(8, ' ') + ' ' + 'Qty.'.padStart(5, ' ');
  content += CMD.BOLD_ON + header58 + CMD.LINE_FEED + CMD.BOLD_OFF;
  content += lineDivider + CMD.LINE_FEED;

  // 10. Items Rows 58mm
  const maxItem = 15;
  const maxNote = 8;
  const qWidth = 5;

  items.forEach((item) => {
    const isCancelled = item.status === 'Cancelled' || item.isCancelled;
    const isReduced = !isCancelled && (item.reducedQuantity > 0);
    const cancelQty = item.cancelledQuantity || item.quantity || 1;
    const qtyNum = isCancelled ? `-${cancelQty}` : `${item.quantity || 0}`;
    let itemName = (item.name || item.itemName || 'Item').trim();
    if (isCancelled) itemName += ' [CANCEL]';
    else if (isReduced) itemName += ` [-${item.reducedQuantity}x]`;

    const noteStr = (item.specialNote && item.specialNote.trim()) ? item.specialNote.trim() : '-';
    const itemLines = wrapTextLines(itemName, maxItem);
    const firstLineItem = (itemLines[0] || '').padEnd(maxItem, ' ');
    const firstLineNote = noteStr.substring(0, maxNote).padEnd(maxNote, ' ');
    const firstLineQty = String(qtyNum).padStart(qWidth, ' ');

    content += CMD.THICK_BOLD_ON + firstLineItem + ' ' + firstLineNote + ' ' + firstLineQty + CMD.THICK_BOLD_OFF + CMD.LINE_FEED;

    for (let l = 1; l < itemLines.length; l++) {
      content += CMD.THICK_BOLD_ON + `  ${itemLines[l]}` + CMD.THICK_BOLD_OFF + CMD.LINE_FEED;
    }

    if (noteStr !== '-' && noteStr.length > maxNote) {
      const extraNoteLines = wrapTextLines(noteStr.substring(maxNote).trim(), width - 4);
      extraNoteLines.forEach(enl => {
        content += `  * ${enl}` + CMD.LINE_FEED;
      });
    }
  });

  content += lineDivider + CMD.LINE_FEED;
  content += CMD.LINE_FEED;
  content += CMD.CUT_PAPER;

  return Buffer.from(content, 'utf-8');
};
