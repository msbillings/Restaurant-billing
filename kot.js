import net from 'net';
import https from 'https';
import http from 'http';
import sharp from 'sharp';
import QRCode from 'qrcode';
import PrinterConfigDefault from '../models/PrinterConfig.js';
import MenuDefault from '../models/Menu.js';
import CategoryDefault from '../models/Category.js';
import SettingDefault from '../models/Setting.js';
import FloorDefault from '../models/Floor.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { emitNotification } from '../utils/notificationHelper.js';
import { emitSocketEvent } from '../utils/socket.js';
import { sendRawToUSBPrinter, sendRawToBluetoothPrinter, getAvailableUSBAndCOMPorts } from './usbPrinterService.js';
import { scanNetworkThermalPrinters } from './networkPrinterScanner.js';

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';

const CMD = {
  INIT: ESC + '@',                  // Initialize printer
  ALIGN_LEFT: ESC + 'a\x00',         // Align Left
  ALIGN_CENTER: ESC + 'a\x01',       // Align Center
  ALIGN_RIGHT: ESC + 'a\x02',        // Align Right
  DOUBLE_STRIKE_ON: ESC + 'G\x01',   // Double-strike mode: burns dots twice for jet-black text
  DOUBLE_STRIKE_OFF: ESC + 'G\x00',
  TEXT_NORMAL: ESC + '!\x00' + GS + '!\x00' + ESC + 'E\x00' + ESC + 'G\x00', // Normal text size & regular weight
  TEXT_DOUBLE_HEIGHT: GS + '!\x01' + ESC + '!\x10',                  // Double height text
  TEXT_DOUBLE_WIDTH: GS + '!\x10' + ESC + '!\x20',                   // Double width text
  TEXT_LARGE: GS + '!\x11' + ESC + '!\x30',                          // Double height & width text
  TEXT_DOUBLE_HEIGHT_BOLD: ESC + '!\x18' + GS + '!\x01' + ESC + 'E\x01' + ESC + 'G\x01', // Double height + Bold + Double Strike
  TEXT_LARGE_BOLD: ESC + '!\x38' + GS + '!\x11' + ESC + 'E\x01' + ESC + 'G\x01',         // Large Bold (Double width + Double height + Bold + Double Strike)
  FONT_A: ESC + 'M\x00',            // Font A (Standard 12x24 Bold)
  FONT_B: ESC + 'M\x01',            // Font B (Condensed 9x17 Monospace)
  LINE_SPACING_DEFAULT: ESC + '2',  // Default 30-dot line spacing
  LINE_SPACING_COMPACT: ESC + '3\x18', // Compact 24-dot line spacing (for Small text size)
  LINE_SPACING_RELAXED: ESC + '3\x26', // Relaxed 38-dot line spacing (for Large/XL text size)
  BOLD_ON: ESC + '!\x08' + ESC + 'E\x01' + ESC + 'G\x01',            // Master bit 3 + ESC E 1 + ESC G 1 for deep jet-black bold
  BOLD_OFF: ESC + '!\x00' + ESC + 'E\x00' + ESC + 'G\x00',           // Master bit 0 + ESC E 0 + ESC G 0
  THICK_BOLD_ON: ESC + 'E\x01' + ESC + 'G\x01',                      // Pure bold and double strike without touching ESC !
  THICK_BOLD_OFF: ESC + 'E\x00' + ESC + 'G\x00',
  CUT_PAPER: GS + 'V\x42\x00',       // Full paper cut
  LINE_FEED: '\n'
};

// In-memory cache for rasterized logos (key -> Buffer) for instant 0ms retrieval on subsequent prints
const logoRasterCache = new Map();

// In-memory cache for menu item categories per tenant to avoid full collection scans on every print
const categoryMapCache = new Map();

/**
 * Sends a Buffer directly to a TCP Network Thermal Printer on IP:Port (standard 9100)
 */
export const sendRawToNetworkPrinter = (ipAddress, port = 9100, buffer) => {
  return new Promise((resolve, reject) => {
    if (!ipAddress || ipAddress.trim() === '') {
      return reject(new Error('Printer IP address is required'));
    }

    const socket = new net.Socket();
    let isHandled = false;

    socket.setTimeout(1000); // Fast 1 second connection timeout

    socket.connect(port, ipAddress, () => {
      isHandled = true;
      socket.write(buffer, () => {
        setTimeout(() => {
          socket.end();
          resolve({ success: true, message: `Successfully printed to ${ipAddress}:${port}` });
        }, 300);
      });
    });

    socket.on('error', (err) => {
      if (!isHandled) {
        isHandled = true;
        socket.destroy();
        reject(new Error(`TCP connection failed to ${ipAddress}:${port} (${err.message})`));
      }
    });

    socket.on('timeout', () => {
      if (!isHandled) {
        isHandled = true;
        socket.destroy();
        reject(new Error(`Timeout connecting to ${ipAddress}:${port}. Check IP and power.`));
      }
    });
  });
};

/**
 * Generate a test receipt ESC/POS Buffer for network printers
 */
export const generateESCPOSTestReceipt = (config) => {
  const is58mm = config.paperWidth === '58mm';
  const width = is58mm ? 32 : 48;
  const lineDivider = '-'.repeat(width);

  let content = '';
  content += CMD.INIT;
  content += CMD.ALIGN_CENTER;
  content += CMD.TEXT_DOUBLE_HEIGHT + CMD.BOLD_ON + 'PRINTER TEST OK' + CMD.LINE_FEED;
  content += CMD.TEXT_NORMAL + CMD.BOLD_OFF;
  content += lineDivider + CMD.LINE_FEED;
  content += `Name: ${config.name || 'Printer'}` + CMD.LINE_FEED;
  if (config.connectionType === 'usb') {
    content += `Port: ${config.usbPort || config.deviceName || 'USB'}` + CMD.LINE_FEED;
    content += `Mode: Driverless RAW USB` + CMD.LINE_FEED;
  } else if (config.connectionType === 'bluetooth') {
    content += `BT: ${config.bluetoothAddress || ''}` + CMD.LINE_FEED;
  } else {
    content += `IP: ${config.ipAddress}:${config.port || 9100}` + CMD.LINE_FEED;
  }
  content += `Width: ${config.paperWidth || '80mm'}` + CMD.LINE_FEED;
  content += `Date: ${new Date().toLocaleDateString('en-GB')}` + CMD.LINE_FEED;
  content += `Time: ${new Date().toLocaleTimeString()}` + CMD.LINE_FEED;
  content += lineDivider + CMD.LINE_FEED;
  content += CMD.BOLD_ON + 'MS Billings POS System' + CMD.LINE_FEED + CMD.BOLD_OFF;
  content += CMD.LINE_FEED + CMD.LINE_FEED + CMD.LINE_FEED;
  content += CMD.CUT_PAPER;

  return Buffer.from(content, 'utf-8');
};

/**
 * Text wrapping helper for fixed width thermal receipt printers
 */
export const wrapTextLines = (text, maxChars) => {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxChars) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

/**
 * Two-column aligned row generator (Left aligned key, Right aligned value)
 */
export const formatTwoCols = (left, right, width = 48) => {
  const l = String(left || '');
  const r = String(right || '');
  if (l.length + r.length >= width) {
    return l + ' ' + r;
  }
  return l + ' '.repeat(width - l.length - r.length) + r;
};

/**
 * Generate a formatted KOT ESC/POS Buffer for thermal printers
 * Matches on-screen layout: Date/Time, KOT No, Station Badge, Queue No & Order Type in single row, Table No, Biller, and 3-col items table
 */
export const generateKOTESCPOSBuffer = (bill, items, kotNumber, printerConfig = {}, queueNumber, restaurantDetails = {}) => {
  const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };

  // Dynamic Paper Width from Settings or Printer Config (80mm vs 58mm)
  const is58mm = printerConfig.paperWidth === '58mm' || s.printFormat === '58mm';
  const width = is58mm ? 30 : 44;
  const lineDivider = '-'.repeat(width);

  // Dynamic Font Size from Settings ('small', 'medium', 'large', 'extra-large')
  const fontSize = (s.receiptFontSize || printerConfig.fontSize || 'medium').toLowerCase();

  // Dynamic Font Style / Family from Settings
  const fontFamily = (s.receiptFontFamily || '').toLowerCase();
  const isMonospace = fontFamily.includes('mono') || fontFamily.includes('courier') || fontFamily.includes('lucida');

  // Left margin offset to center printout between left and right paper edges
  const leftMarginDots = is58mm ? 12 : 24;
  const setLeftMarginCmd = GS + 'L' + String.fromCharCode(leftMarginDots & 0xFF, (leftMarginDots >> 8) & 0xFF);

  let content = '';
  content += CMD.INIT + setLeftMarginCmd;
  content += CMD.FONT_A; // Standard Font A for crisp text

  // Apply dynamic line spacing based on font size setting
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

  // 2. KOT Number Centered & Bold (Double Height Bold)
  let rawKot = (kotNumber || bill.kotNumber || '1').toString().trim();
  let numOnly = rawKot.replace(/^[A-Za-z\s-]+/i, '').trim();
  const kotLabel = rawKot.toUpperCase().includes('UPDATE') ? rawKot : (numOnly ? `KOT No: ${numOnly}` : `KOT No: ${rawKot}`);
  content += CMD.ALIGN_CENTER + CMD.TEXT_DOUBLE_HEIGHT_BOLD + kotLabel + CMD.LINE_FEED + CMD.TEXT_NORMAL;

  // 3. Station Badge immediately below KOT No
  const kitchenTitle = (printerConfig.name || printerConfig.assignTo || '').trim().toUpperCase();
  const locationSub = printerConfig.location ? ` - ${printerConfig.location.trim().toUpperCase()}` : '';
  if (kitchenTitle && kitchenTitle !== 'KITCHEN') {
    content += CMD.ALIGN_CENTER + CMD.BOLD_ON + `[ ${kitchenTitle}${locationSub} ]` + CMD.BOLD_OFF + CMD.LINE_FEED;
  }

  // 4. Queue No & Dine-In / Delivery / Takeaway in a SINGLE ROW
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

  // 5. Table Number Centered (Prominent Double Height Bold)
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

  // 6. Divider Line
  content += lineDivider + CMD.LINE_FEED;

  // 7. Biller Info (Left Aligned)
  content += CMD.ALIGN_LEFT;
  const cashier = bill.cashierName || bill.billerName || 'admin';
  const billerLine = `Biller: ${cashier}`;
  if (bill.captainName) {
    content += formatTwoCols(billerLine, `Assign: ${bill.captainName}`, width) + CMD.LINE_FEED;
  } else {
    content += billerLine + CMD.LINE_FEED;
  }

  // 8. Divider Line
  content += lineDivider + CMD.LINE_FEED;

  // 9. 3-Column Items Table Header (Item, Special Note, Qty.)
  if (is58mm) {
    const header58 = 'Item'.padEnd(15, ' ') + ' ' + 'Note'.padEnd(8, ' ') + ' ' + 'Qty.'.padStart(5, ' ');
    content += CMD.BOLD_ON + header58 + CMD.LINE_FEED + CMD.BOLD_OFF;
  } else {
    content += CMD.BOLD_ON + 'Item                  Special Note    Qty.' + CMD.LINE_FEED + CMD.BOLD_OFF;
  }
  content += lineDivider + CMD.LINE_FEED;

  // 10. Items Rows with BOLD item names, BOLD quantities, and clean whole-word wrapping
  const maxItem = is58mm ? 15 : 22;
  const maxNote = is58mm ? 8 : 14;
  const qWidth = is58mm ? 5 : 6;

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

    // Item line: BOLD item name and BOLD quantity!
    content += CMD.THICK_BOLD_ON + firstLineItem + ' ' + firstLineNote + ' ' + firstLineQty + CMD.THICK_BOLD_OFF + CMD.LINE_FEED;

    // Remaining wrapped item name lines (all bold, no hyphens!)
    for (let l = 1; l < itemLines.length; l++) {
      content += CMD.THICK_BOLD_ON + `  ${itemLines[l]}` + CMD.THICK_BOLD_OFF + CMD.LINE_FEED;
    }

    // Special Note lines if longer than maxNote
    if (noteStr !== '-' && noteStr.length > maxNote) {
      const extraNoteLines = wrapTextLines(noteStr.substring(maxNote).trim(), width - 4);
      extraNoteLines.forEach(enl => {
        content += `  * ${enl}` + CMD.LINE_FEED;
      });
    }
  });

  // 11. Divider Line
  content += lineDivider + CMD.LINE_FEED;

  // Feed and cut - minimum feed to prevent paper waste
  content += CMD.LINE_FEED;
  content += CMD.CUT_PAPER;

  return Buffer.from(content, 'utf-8');
};

/**
 * Routes and sends KOT items to active thermal network printers concurrently
 */
export const printKOTToPrinters = async (req, bill, kotNumber, kotItems, queueNumber, rasterBufferBase64 = null) => {
  try {
    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    const Menu = getTenantModel(req, 'Menu', MenuDefault);

    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    let dbSettings = {};
    try {
      const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
      if (settingsDoc?.value) {
        dbSettings = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
      }
    } catch (e) {
      console.warn('[PrinterService] Could not fetch restaurantSettings for KOT:', e.message);
    }
    const restaurantDetails = { ...dbSettings, ...(bill.restaurantDetails || {}) };

    // Fetch active printers
    const activePrinters = await PrinterConfig.find({ isActive: true });
    if (!activePrinters || activePrinters.length === 0) {
      console.log('[PrinterService] No active printers configured.');
      return;
    }

    const kotPrinters = activePrinters.filter(p => p.type === 'kot' || p.type === 'general' || p.type === 'both');
    if (kotPrinters.length === 0) {
      console.log('[PrinterService] No active KOT/General/Both printers found.');
      return;
    }

    // Build item name to category mapping (cached for 120s)
    const tenantDb = req?.tenantDb || req?.headers?.['x-tenant-db'] || req?.headers?.['X-Tenant-DB'] || 'default';
    const cachedMap = categoryMapCache.get(tenantDb);
    let categoryMap = {};

    if (cachedMap && (Date.now() - cachedMap.time < 120000)) {
      categoryMap = cachedMap.map;
    } else {
      try {
        const menuList = await Menu.find({}, { name: 1, category: 1 }).populate('category', 'name').maxTimeMS(400).lean();
        menuList.forEach(m => {
          if (m.name) {
            categoryMap[m.name.toLowerCase()] = (m.category?.name || '').toLowerCase();
          }
        });
        categoryMapCache.set(tenantDb, { map: categoryMap, time: Date.now() });
      } catch (e) {
        console.warn('[PrinterService] Could not load menu categories for routing:', e.message);
      }
    }

    // Load Floor mapping for table-to-floor dynamic routing
    const Floor = getTenantModel(req, 'Floor', FloorDefault);
    let floorTableMap = {};
    try {
      const allFloors = await Floor.find({}).lean();
      allFloors.forEach(flr => {
        const fName = (flr.name || '').trim().toLowerCase();
        const allSpaces = [
          ...(flr.tables || []),
          ...(flr.cabins || []),
          ...(flr.sofas || []),
          ...(flr.spaces || [])
        ];
        allSpaces.forEach(sp => {
          if (sp.name) {
            floorTableMap[sp.name.trim().toLowerCase()] = fName;
            floorTableMap[`${fName} - ${sp.name.trim()}`.toLowerCase()] = fName;
          }
        });
      });
    } catch (e) {
      console.warn('[PrinterService] Could not load floors for routing:', e.message);
    }

    // Process all configured KOT printers in parallel
    const printPromises = kotPrinters.map(async (printer) => {
      // Dynamic Floor / Location Filtering Logic for KOT
      const printerLocation = (printer.location || '').trim().toLowerCase();
      const isFloorFilter = printerLocation !== '' &&
        printerLocation !== 'all' &&
        printerLocation !== 'all floors' &&
        printerLocation !== 'both' &&
        printerLocation !== 'both / all floors' &&
        printerLocation !== 'both / all floors (ground & first)' &&
        printerLocation !== 'general';

      if (isFloorFilter) {
        const orderTable = String(bill.tableNo || '').trim().toLowerCase();
        let tableFloorMatches = false;

        if (orderTable.includes(printerLocation)) {
          tableFloorMatches = true;
        } else if (floorTableMap[orderTable]) {
          tableFloorMatches = floorTableMap[orderTable] === printerLocation;
        } else if (!orderTable || orderTable === 'takeaway' || orderTable === 'delivery') {
          tableFloorMatches = true;
        }

        if (!tableFloorMatches) {
          console.log(`[PrinterService] Skipping KOT printer '${printer.name}' - floor '${printer.location}' does not match table '${bill.tableNo}'.`);
          return;
        }
      }

      const isNetwork = printer.connectionType === 'network' && printer.ipAddress;
      const isUsb = printer.connectionType === 'usb' && (printer.usbPort || printer.deviceName || printer.name);
      const isBluetooth = printer.connectionType === 'bluetooth' && (printer.bluetoothAddress || printer.deviceName || printer.name);

      if (!isNetwork && !isUsb && !isBluetooth) {
        console.log(`[PrinterService] Printer '${printer.name}' is ${printer.connectionType} without IP, USB port, or Bluetooth configured.`);
        return;
      }

      // Department / Item / Category Filtering Logic
      let targetItems = kotItems;
      const isItemMode = printer.assignmentMode === 'item' && Array.isArray(printer.assignedItems) && printer.assignedItems.length > 0;
      const isCatMode = Array.isArray(printer.assignedCategories) && printer.assignedCategories.length > 0;
      const assignedDept = (printer.assignTo || '').trim().toLowerCase();
      const printerName = (printer.name || '').trim().toLowerCase();
      const isDeptFilter = assignedDept !== '' && assignedDept !== 'all' && assignedDept !== 'general' && assignedDept !== printerName;

      if (isItemMode) {
        const itemSet = new Set(printer.assignedItems.map(it => it.trim().toLowerCase()));
        targetItems = kotItems.filter(item => itemSet.has((item.name || '').trim().toLowerCase()));
      } else if (isCatMode) {
        const catSet = new Set(printer.assignedCategories.map(c => c.trim().toLowerCase()));
        targetItems = kotItems.filter(item => {
          const itemLower = (item.name || '').toLowerCase();
          const catLower = categoryMap[itemLower] || (item.category?.name || item.category || '').toLowerCase();
          return catSet.has(catLower);
        });
      } else if (isDeptFilter) {
        const deptTokens = assignedDept.split(',').map(d => d.trim()).filter(Boolean);
        targetItems = kotItems.filter(item => {
          const itemLower = (item.name || '').toLowerCase();
          const catLower = categoryMap[itemLower] || (item.category?.name || item.category || '').toLowerCase();
          return deptTokens.some(token => catLower.includes(token) || itemLower.includes(token));
        });
      } else {
        // No specific category, item, or external department filter: print all items
        targetItems = kotItems;
      }

      // If specific items/categories/department are assigned but no items matched, skip this printer
      const hasSpecificFilter = isItemMode || isCatMode || isDeptFilter;
      if (targetItems.length === 0 && hasSpecificFilter) {
        console.log(`[PrinterService] Skipping printer '${printer.name}' - no items matched assigned routing.`);
        return;
      }

      const itemsToPrint = targetItems.length > 0 ? targetItems : kotItems;
      let buffer;
      if (rasterBufferBase64 && typeof rasterBufferBase64 === 'string') {
        buffer = Buffer.from(rasterBufferBase64, 'base64');
      } else {
        buffer = generateKOTESCPOSBuffer(bill, itemsToPrint, kotNumber, printer, queueNumber, restaurantDetails);
      }

      const targetDestination = isUsb
        ? `USB Port: ${printer.usbPort}`
        : isBluetooth
          ? `Bluetooth: ${printer.bluetoothAddress || printer.deviceName || printer.name}`
          : `${printer.ipAddress}:${printer.port || 9100}`;
      console.log(`[PrinterService] Streaming KOT #${kotNumber} to '${printer.name}' (${targetDestination})`);

      try {
        let res;
        if (isUsb) {
          res = await sendRawToUSBPrinter(printer.usbPort || printer.deviceName || printer.name, buffer, printer.deviceName || printer.name);
          if (res.actualPort && res.actualPort !== printer.usbPort) {
            printer.usbPort = res.actualPort;
            try {
              const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
              await PrinterConfig.findByIdAndUpdate(printer._id, { usbPort: res.actualPort });
            } catch (_) { }
          }
        } else if (isBluetooth) {
          res = await sendRawToBluetoothPrinter(printer.bluetoothAddress || printer.deviceName || printer.name, buffer);
        } else {
          res = await sendRawToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
        }
        console.log(`[PrinterService] Success: ${res.message}`);
        emitNotification(
          req,
          '🖨️ KOT Printed',
          `KOT #${kotNumber} sent to ${printer.name} (${targetDestination})`,
          'success',
          ['Admin', 'Captain', 'Manager']
        );
      } catch (err) {
        console.error(`[PrinterService] Error on '${printer.name}' (${targetDestination}): ${err.message}`);

        // Build a clean, user-friendly error message
        let friendlyMsg = err.message || 'Unknown error';
        if (/PRINTER_OFFLINE|no active COM|not reachable|not connected|not responding/i.test(friendlyMsg)) {
          friendlyMsg = `Printer "${printer.name}" is OFF or not connected. Please turn it ON and try again.`;
        } else if (/timeout|timed out/i.test(friendlyMsg)) {
          friendlyMsg = `Printer "${printer.name}" is not responding. Check the connection and try again.`;
        } else if (/TCP connection failed|ECONNREFUSED/i.test(friendlyMsg)) {
          friendlyMsg = `Cannot reach printer "${printer.name}" on the network. Check the IP address and connection.`;
        } else if (friendlyMsg.length > 120) {
          friendlyMsg = friendlyMsg.substring(0, 120).trim() + '…';
        }

        emitNotification(
          req,
          '🖨️ Printer Not Connected',
          friendlyMsg,
          'warning',
          ['Admin', 'Captain', 'Manager']
        );
      }
    });

    await Promise.allSettled(printPromises);
  } catch (error) {
    console.error('[PrinterService] Critical error during multi-printer routing:', error.message);
  }
};



/**
 * Generate a 1-bit monochrome ESC/POS raster bit image (GS v 0) for a QR Code
 * 100% universally supported across all thermal printers (58mm & 80mm, Bluetooth & USB & Network)
 */
export const generateESCPOSQRCodeRaster = (text, is58mm = true) => {
  if (!text || typeof text !== 'string') return Buffer.alloc(0);

  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const modules = qr.modules.data;

    const margin = 2; // quiet zone in modules
    const totalModules = moduleCount + 2 * margin;

    // Scale factor: 4 dots/module on 58mm (~148x148 dots), 6 dots/module on 80mm (~222x222 dots)
    const scale = is58mm ? 4 : 6;
    const pixelWidth = totalModules * scale;
    const pixelHeight = pixelWidth;

    const totalWidthDots = is58mm ? 384 : 528;
    const totalWidthBytes = totalWidthDots / 8;
    const xOffset = Math.max(0, Math.floor((totalWidthDots - pixelWidth) / 2));
    const dataBuffer = Buffer.alloc(totalWidthBytes * pixelHeight, 0);

    for (let y = 0; y < pixelHeight; y++) {
      const moduleY = Math.floor(y / scale) - margin;
      for (let x = 0; x < pixelWidth; x++) {
        const moduleX = Math.floor(x / scale) - margin;

        let isBlack = false;
        if (moduleX >= 0 && moduleX < moduleCount && moduleY >= 0 && moduleY < moduleCount) {
          isBlack = modules[moduleY * moduleCount + moduleX] === 1;
        }

        if (isBlack) {
          const targetX = xOffset + x;
          const byteIndex = y * totalWidthBytes + Math.floor(targetX / 8);
          const bitIndex = 7 - (targetX % 8);
          dataBuffer[byteIndex] |= (1 << bitIndex);
        }
      }
    }

    const xL = totalWidthBytes & 0xFF;
    const xH = (totalWidthBytes >> 8) & 0xFF;
    const yL = pixelHeight & 0xFF;
    const yH = (pixelHeight >> 8) & 0xFF;

    const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);

    return Buffer.concat([
      Buffer.from(CMD.ALIGN_LEFT, 'utf-8'),
      header,
      dataBuffer,
      Buffer.from(CMD.LINE_FEED, 'utf-8')
    ]);
  } catch (err) {
    console.error('[PrinterService] Error generating ESC/POS QR raster:', err);
    return Buffer.alloc(0);
  }
};

/**
 * Generate a 1-bit monochrome ESC/POS raster bit image (GS v 0) for a continuous solid divider line
 * Prints a smooth, unbroken black divider across the entire paper with zero font-character gaps
 */
export const generateESCPOSSolidLine = (is58mm = false, thicknessDots = 2) => {
  const widthDots = is58mm ? 384 : 528;
  const widthBytes = widthDots / 8; // 48 bytes for 58mm, 66 bytes for 80mm
  const heightDots = Math.max(1, Math.min(8, thicknessDots));
  const data = Buffer.alloc(widthBytes * heightDots, 0xFF);

  const xL = widthBytes & 0xFF;
  const xH = (widthBytes >> 8) & 0xFF;
  const yL = heightDots & 0xFF;
  const yH = (heightDots >> 8) & 0xFF;

  const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return Buffer.concat([
    Buffer.from(CMD.ALIGN_LEFT, 'utf-8'),
    header,
    data,
    Buffer.from(CMD.LINE_FEED, 'utf-8')
  ]);
};

/**
 * Download and rasterize a restaurant logo into a 1-bit monochrome ESC/POS raster image (GS v 0)
 * Cached in memory so subsequent prints are instantaneous (0ms)
 */
export const generateESCPOSLogoRaster = async (logoUrl, is58mm = false) => {
  if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.trim()) return Buffer.alloc(0);

  const cacheKey = `${logoUrl.trim()}_${is58mm ? '58' : '80'}_medium_v3`;
  if (logoRasterCache.has(cacheKey)) {
    return logoRasterCache.get(cacheKey);
  }

  try {
    let imageBuffer;
    if (logoUrl.startsWith('data:image/')) {
      const base64Data = logoUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      const client = logoUrl.startsWith('https') ? https : http;
      imageBuffer = await new Promise((resolve, reject) => {
        const req = client.get(logoUrl, { timeout: 3500 }, (res) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed to download logo: HTTP ${res.statusCode}`));
          }
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Logo download timed out'));
        });
      });
    } else {
      return Buffer.alloc(0);
    }

    // Medium logo size: 160 dots on 80mm (~20mm wide), 120 dots on 58mm (~15mm wide)
    const targetWidth = is58mm ? 120 : 160;
    const { data, info } = await sharp(imageBuffer)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toColourspace('b-w')
      .threshold(180)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelWidth = info.width;
    const pixelHeight = info.height;
    const totalWidthDots = is58mm ? 384 : 528;
    const totalWidthBytes = totalWidthDots / 8; // 48 bytes for 58mm, 66 bytes for 80mm
    const xOffset = Math.max(0, Math.floor((totalWidthDots - pixelWidth) / 2));
    const dataBuffer = Buffer.alloc(totalWidthBytes * pixelHeight, 0);

    for (let y = 0; y < pixelHeight; y++) {
      for (let x = 0; x < pixelWidth; x++) {
        const idx = y * pixelWidth + x;
        const isBlack = data[idx] < 128;
        if (isBlack) {
          const targetX = xOffset + x;
          const byteIndex = y * totalWidthBytes + Math.floor(targetX / 8);
          const bitIndex = 7 - (targetX % 8);
          dataBuffer[byteIndex] |= (1 << bitIndex);
        }
      }
    }

    const xL = totalWidthBytes & 0xFF;
    const xH = (totalWidthBytes >> 8) & 0xFF;
    const yL = pixelHeight & 0xFF;
    const yH = (pixelHeight >> 8) & 0xFF;

    const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    const result = Buffer.concat([
      Buffer.from(CMD.ALIGN_LEFT, 'utf-8'),
      header,
      dataBuffer,
      Buffer.from(CMD.LINE_FEED, 'utf-8')
    ]);

    logoRasterCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[PrinterService] Error rasterizing logo for ESC/POS:', err.message);
    return Buffer.alloc(0);
  }
};

/**
 * Generate a formatted Bill Receipt ESC/POS Buffer for thermal printers (80mm & 58mm)
 * Pixel-accurate layout matching on-screen MS Billings Invoice
 */
