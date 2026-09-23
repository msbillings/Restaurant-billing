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
  const width = is58mm ? 32 : 44;
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
    content += CMD.ALIGN_CENTER + CMD.TEXT_DOUBLE_HEIGHT_BOLD + tableLabel + CMD.LINE_FEED + CMD.TEXT_NORMAL;
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
    content += CMD.BOLD_ON + 'Item              Note       Qty.' + CMD.LINE_FEED + CMD.BOLD_OFF;
  } else {
    content += CMD.BOLD_ON + 'Item                  Special Note    Qty.' + CMD.LINE_FEED + CMD.BOLD_OFF;
  }
  content += lineDivider + CMD.LINE_FEED;

  // 10. Items Rows with BOLD item names, BOLD quantities, and clean whole-word wrapping
  const maxItem = is58mm ? 16 : 22;
  const maxNote = is58mm ? 9 : 14;
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
    content += CMD.BOLD_ON + firstLineItem + CMD.BOLD_OFF + ' ' + firstLineNote + ' ' + CMD.BOLD_ON + firstLineQty + CMD.BOLD_OFF + CMD.LINE_FEED;

    // Remaining wrapped item name lines (all bold, no hyphens!)
    for (let l = 1; l < itemLines.length; l++) {
      content += CMD.BOLD_ON + `  ${itemLines[l]}` + CMD.BOLD_OFF + CMD.LINE_FEED;
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
      const isUsb = printer.connectionType === 'usb' && printer.usbPort;
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

      // If running on cloud (Render or Vercel) and printer IP is a private LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x, 127.0.0.1):
      // The cloud server cannot reach the local LAN printer directly via TCP. Relay via Socket.IO to local station.
      const isPrivateLanIp = isNetwork && /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|localhost)/.test(printer.ipAddress);
      const isCloudEnv = !!(process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' && !process.env.APP_USER_DATA_PATH));
      if (isNetwork && isPrivateLanIp && isCloudEnv) {
        console.log(`[PrinterService] ⚡ Cloud environment (Render/Vercel) cannot reach private LAN printer '${printer.name}' (${printer.ipAddress}). Relaying KOT via Socket.IO to local station.`);
        emitSocketEvent(req, 'relayPrintKOT', {
          jobId: `kot_svc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          bill,
          items: itemsToPrint,
          kotNumber,
          queueNumber,
          printer: {
            _id: printer._id,
            name: printer.name,
            connectionType: printer.connectionType,
            ipAddress: printer.ipAddress,
            port: printer.port || 9100,
            paperWidth: printer.paperWidth,
            location: printer.location,
            bluetoothAddress: printer.bluetoothAddress,
            deviceName: printer.deviceName,
            usbPort: printer.usbPort
          },
          rasterBufferBase64: (rasterBufferBase64 && typeof rasterBufferBase64 === 'string') ? rasterBufferBase64 : (buffer ? buffer.toString('base64') : null),
          restaurantDetails,
          timestamp: Date.now()
        });
        return;
      }

      try {
        let res;
        if (isUsb) {
          res = await sendRawToUSBPrinter(printer.usbPort, buffer, printer.deviceName || printer.name);
          if (res.actualPort && res.actualPort !== printer.usbPort) {
            printer.usbPort = res.actualPort;
            try {
              const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
              await PrinterConfig.findByIdAndUpdate(printer._id, { usbPort: res.actualPort });
            } catch (_) {}
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
export const generateESCPOSBillReceipt = async (bill, printerConfig = {}, restaurantDetails = {}) => {
  const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };

  // Dynamic Paper Width from Settings or Printer Config (80mm vs 58mm)
  const is58mm = printerConfig.paperWidth === '58mm' || s.printFormat === '58mm';
  const width = is58mm ? 32 : 44;
  const solidLine = generateESCPOSSolidLine(is58mm, 2);

  // Dynamic Font Size from Settings ('small', 'medium', 'large', 'extra-large')
  const fontSize = (s.receiptFontSize || printerConfig.fontSize || 'medium').toLowerCase();

  // Dynamic Font Style / Family from Settings
  const fontFamily = (s.receiptFontFamily || '').toLowerCase();
  const isMonospace = fontFamily.includes('mono') || fontFamily.includes('courier') || fontFamily.includes('lucida');

  const restName = (s.restaurantName || 'MS Billings Restaurant').trim();
  const restAddress = (s.address || '').trim();
  const restPhone = (s.phone || '').trim();
  const gstin = (s.gstin || s.gstNumber || '').trim();
  const fssai = (s.fssai || s.fssaiNumber || '').trim();

  const chunks = [];

  // Initialize printer cleanly and set left margin for equal left/right margins
  // 80mm: Shift left margin by 24 dots (~3mm) so 44 columns (528 dots) sits dead-center on 80mm roll
  // 58mm: Shift left margin by 12 dots (~1.5mm)
  const leftMarginDots = is58mm ? 12 : 24;
  const setLeftMarginCmd = GS + 'L' + String.fromCharCode(leftMarginDots & 0xFF, (leftMarginDots >> 8) & 0xFF);
  let initCmd = CMD.INIT + setLeftMarginCmd;

  // Apply dynamic font style (Monospace Font B vs Standard Font A)
  if (isMonospace) {
    initCmd += CMD.FONT_B;
  } else {
    initCmd += CMD.FONT_A;
  }

  // Apply dynamic line spacing based on font size setting
  if (fontSize === 'small') {
    initCmd += CMD.LINE_SPACING_COMPACT;
  } else if (fontSize === 'large' || fontSize === 'extra-large') {
    initCmd += CMD.LINE_SPACING_RELAXED;
  } else {
    initCmd += CMD.LINE_SPACING_DEFAULT;
  }
  chunks.push(Buffer.from(initCmd, 'utf-8'));

  // 1. Dynamic Restaurant Logo (if enabled and present)
  const logoUrl = s.logo || s.restaurantLogo;
  const shouldShowLogo = (s.showLogo !== false && s.showLogo !== 'false' && s.printLogo !== false && s.printLogo !== 'false') && !!logoUrl;
  if (shouldShowLogo) {
    try {
      const logoBuf = await generateESCPOSLogoRaster(logoUrl, is58mm);
      if (logoBuf && logoBuf.length > 0) {
        chunks.push(logoBuf);
      }
    } catch (e) {
      console.warn('[PrinterService] Failed to include logo raster:', e.message);
    }
  }

  // 2. Header - Restaurant Branding (Up of Boldness: Double-width & Double-height)
  let headerText = '';
  headerText += CMD.ALIGN_CENTER;
  if (printerConfig.printHeader && printerConfig.printHeader.trim()) {
    headerText += printerConfig.printHeader.trim() + CMD.LINE_FEED;
  }
  headerText += CMD.TEXT_LARGE_BOLD + restName.toUpperCase() + CMD.LINE_FEED + CMD.TEXT_NORMAL;

  // Down of Boldness: Regular weight, light, clear store details
  headerText += CMD.BOLD_OFF;
  if (restAddress) {
    const addrMax = is58mm ? 26 : 38;
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

  // 3. Invoice Title & Order/Table Details (Up of Boldness)
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

  // Metadata - Date, Time, Cashier, Bill No
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
  if (bill.tokenNumber || bill.tokenNo || bill.queueNumber) {
    const tNum = bill.tokenNumber || bill.tokenNo || bill.queueNumber;
    orderMeta += CMD.BOLD_ON + `Token No.: ${tNum}` + CMD.BOLD_OFF + CMD.LINE_FEED;
  }
  if (bill.customerName || bill.customerPhone) {
    const custStr = [bill.customerName, bill.customerPhone].filter(Boolean).join(' | ');
    orderMeta += `Customer: ${custStr.substring(0, width - 10)}` + CMD.LINE_FEED;
  }
  chunks.push(Buffer.from(orderMeta, 'utf-8'));
  chunks.push(solidLine);

  // 4. Items Table Header
  let itemHead = '';
  if (is58mm) {
    itemHead += CMD.BOLD_ON + 'Item             Qty.     Amount' + CMD.LINE_FEED + CMD.BOLD_OFF;
  } else {
    itemHead += CMD.BOLD_ON + 'Item                  Qty.    Price    Amount' + CMD.LINE_FEED + CMD.BOLD_OFF;
  }
  chunks.push(Buffer.from(itemHead, 'utf-8'));
  chunks.push(solidLine);

  // 5. Items List - High Contrast Dynamic Bold
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

    if (is58mm) {
      const maxLen = 16;
      const itemLines = wrapTextLines(name, maxLen);
      const firstLineItem = (itemLines[0] || '').padEnd(maxLen, ' ');
      const qStr = String(qty).padStart(4, ' ');
      const aStr = amount.padStart(10, ' ');
      itemsContent += CMD.BOLD_ON + firstLineItem + CMD.BOLD_OFF + ' ' + CMD.BOLD_ON + qStr + CMD.BOLD_OFF + ' ' + CMD.BOLD_ON + aStr + CMD.BOLD_OFF + CMD.LINE_FEED;
      for (let l = 1; l < itemLines.length; l++) {
        itemsContent += CMD.BOLD_ON + `  ${itemLines[l]}` + CMD.BOLD_OFF + CMD.LINE_FEED;
      }
    } else {
      const maxLen = 20;
      const itemLines = wrapTextLines(name, maxLen);
      const firstLineItem = (itemLines[0] || '').padEnd(maxLen, ' ');
      const qStr = String(qty).padStart(5, ' ');
      const pStr = price.padStart(8, ' ');
      const aStr = amount.padStart(8, ' ');
      itemsContent += CMD.BOLD_ON + firstLineItem + CMD.BOLD_OFF + ' ' + CMD.BOLD_ON + qStr + CMD.BOLD_OFF + ' ' + pStr + ' ' + CMD.BOLD_ON + aStr + CMD.BOLD_OFF + CMD.LINE_FEED;
      for (let l = 1; l < itemLines.length; l++) {
        itemsContent += CMD.BOLD_ON + `  ${itemLines[l]}` + CMD.BOLD_OFF + CMD.LINE_FEED;
      }
    }

    if (item.specialNote) {
      itemsContent += `  * Note: ${item.specialNote.substring(0, width - 10)}` + CMD.LINE_FEED;
    }
  });

  chunks.push(Buffer.from(itemsContent, 'utf-8'));
  chunks.push(solidLine);

  // 6. Totals & Tax Breakdown
  const sub = Number(bill.subtotal || activeItems.reduce((acc, curr) => acc + (Number(curr.price || 0) * ((curr.quantity || 1) - (curr.cancelledQuantity || 0))), 0) || 0);
  const disc = Number(bill.discount || 0);
  const taxable = Math.max(0, sub - disc);

  let totalsContent = '';
  if (is58mm) {
    totalsContent += formatTwoCols(`Total Qty: ${totalQty}`, `Sub Total: ${sub.toFixed(2)}`, width) + CMD.LINE_FEED;
    if (disc > 0) {
      const discPct = bill.discountType === 'percentage' && bill.discountValue 
        ? ` (${bill.discountValue}%)` 
        : (bill.discountType === 'complimentary' ? ' (100%)' : (bill.discountName ? ` (${bill.discountName})` : ''));
      totalsContent += CMD.BOLD_ON + formatTwoCols(`Discount${discPct}:`, `-${disc.toFixed(2)}`, width) + CMD.LINE_FEED + CMD.BOLD_OFF;
    }
  } else {
    const leftSide = `Total Qty: ${totalQty}`;
    const rightSide = `Sub Total          ${sub.toFixed(2)}`;
    totalsContent += formatTwoCols(leftSide, rightSide, width) + CMD.LINE_FEED;

    if (disc > 0) {
      const discPct = bill.discountType === 'percentage' && bill.discountValue 
        ? ` (${bill.discountValue}%)` 
        : (bill.discountType === 'complimentary' ? ' (100%)' : (bill.discountName ? ` (${bill.discountName})` : ''));
      const discRight = `Discount${discPct}     -${disc.toFixed(2)}`;
      totalsContent += CMD.BOLD_ON + formatTwoCols('', discRight, width) + CMD.LINE_FEED + CMD.BOLD_OFF;
    }
  }

  // Tax Breakdown (CGST, SGST, IGST)
  const isCgstEnabled = s.enableCgst !== undefined 
    ? (s.enableCgst === true || s.enableCgst === 'true') 
    : (s.taxSettings?.enableCgst === true || s.taxSettings?.enableCgst === 'true');

  const isSgstEnabled = s.enableSgst !== undefined 
    ? (s.enableSgst === true || s.enableSgst === 'true') 
    : (s.taxSettings?.enableSgst === true || s.taxSettings?.enableSgst === 'true');

  const isGstEnabled = s.enableGst !== undefined 
    ? (s.enableGst === true || s.enableGst === 'true') 
    : (s.taxSettings?.enableGst === true || s.taxSettings?.enableGst === 'true');

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

  // Delivery & Container Charge
  if (Number(bill.deliveryCharge || 0) > 0) {
    totalsContent += formatTwoCols('Delivery Charge:', Number(bill.deliveryCharge).toFixed(2), width) + CMD.LINE_FEED;
  }
  if (Number(bill.containerCharge || 0) > 0) {
    totalsContent += formatTwoCols('Container Charge:', Number(bill.containerCharge).toFixed(2), width) + CMD.LINE_FEED;
  }

  // Final Total & Round off calculation
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

  // 7. Grand Total - Large, Deep Bold (Double Width + Double Height across the full page)
  const grandTotalCols = is58mm ? 16 : 22;
  const grandTotalRow = formatTwoCols('Grand Total', `Rs.${roundedTotal.toFixed(2)}`, grandTotalCols);
  let grandTotalStr = '';
  grandTotalStr += CMD.ALIGN_LEFT + CMD.TEXT_LARGE_BOLD + grandTotalRow + CMD.LINE_FEED + CMD.TEXT_NORMAL;
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

  // 9. UPI Scan to Pay QR Code (Universal 1-bit Monochrome ESC/POS Raster)
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

    const qrRasterBuffer = generateESCPOSQRCodeRaster(qrUri, is58mm);

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

/**
 * Routes and sends Bill Receipt to active thermal network printers concurrently
 */
export const printBillToPrinters = async (req, bill, specificPrinterId = null, rasterBufferBase64 = null) => {
  try {
    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    const Setting = getTenantModel(req, 'Setting', SettingDefault);

    // Fetch restaurant settings and merge to guarantee upiId and store info are present
    let dbSettings = {};
    try {
      const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
      if (settingsDoc?.value) {
        dbSettings = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
      }
    } catch (e) {
      console.warn('[PrinterService] Could not fetch restaurantSettings for bill receipt:', e.message);
    }
    const restaurantDetails = { ...dbSettings, ...(bill.restaurantDetails || {}) };

    // Find active receipt/general printers
    let query = { isActive: true };
    if (specificPrinterId) {
      query._id = specificPrinterId;
    } else {
      query.type = { $in: ['receipt', 'general', 'both'] };
    }

    const receiptPrinters = await PrinterConfig.find(query);
    if (!receiptPrinters || receiptPrinters.length === 0) {
      return {
        success: false,
        message: 'No active Receipt printer configured in Printer & Multi-Kitchen Routing.'
      };
    }

    const targetPrinters = receiptPrinters.filter(p => 
      (p.connectionType === 'network' && p.ipAddress) ||
      (p.connectionType === 'usb' && p.usbPort) ||
      (p.connectionType === 'bluetooth' && (p.bluetoothAddress || p.deviceName || p.name))
    );

    if (targetPrinters.length === 0) {
      return {
        success: false,
        message: `Found ${receiptPrinters.length} receipt printer(s), but none are configured with Network IP, USB port, or Bluetooth.`
      };
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
      console.warn('[PrinterService] Could not load floors for bill routing:', e.message);
    }

    const results = [];
    for (const printer of targetPrinters) {
      // Dynamic Floor / Location Filtering Logic for Bill Receipt
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
          console.log(`[PrinterService] Skipping Bill printer '${printer.name}' - floor '${printer.location}' does not match table '${bill.tableNo}'.`);
          continue;
        }
      }

      const isUsb = printer.connectionType === 'usb' && printer.usbPort;
      const isNetwork = printer.connectionType === 'network' && printer.ipAddress;
      const isBluetooth = printer.connectionType === 'bluetooth' && (printer.bluetoothAddress || printer.deviceName || printer.name);

      let buffer;
      if (rasterBufferBase64 && typeof rasterBufferBase64 === 'string') {
        buffer = Buffer.from(rasterBufferBase64, 'base64');
      } else {
        buffer = await generateESCPOSBillReceipt(bill, printer, restaurantDetails);
      }
      const targetDestination = isUsb
        ? `USB Port: ${printer.usbPort}`
        : isBluetooth
          ? `Bluetooth: ${printer.bluetoothAddress || printer.deviceName || printer.name}`
          : `${printer.ipAddress}:${printer.port || 9100}`;

      if (isNetwork) {
        const isPrivateLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|localhost)/.test(printer.ipAddress);
        const isCloudEnv = !!(process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' && !process.env.APP_USER_DATA_PATH));
        if (isCloudEnv && isPrivateLanIp) {
          console.log(`[PrinterService] ⚡ Cloud environment (Render/Vercel) cannot reach private LAN printer '${printer.name}' (${printer.ipAddress}). Relaying Bill via Socket.IO to local station.`);
          emitSocketEvent(req, 'relayPrintBill', {
            jobId: `bill_svc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            bill,
            printer: {
              _id: printer._id,
              name: printer.name,
              connectionType: printer.connectionType,
              ipAddress: printer.ipAddress,
              port: printer.port || 9100,
              paperWidth: printer.paperWidth,
              location: printer.location,
              bluetoothAddress: printer.bluetoothAddress,
              deviceName: printer.deviceName,
              usbPort: printer.usbPort
            },
            rasterBufferBase64: (rasterBufferBase64 && typeof rasterBufferBase64 === 'string') ? rasterBufferBase64 : (buffer ? buffer.toString('base64') : null),
            restaurantDetails,
            timestamp: Date.now()
          });
          results.push({
            printer: printer.name,
            success: true,
            relayed: true,
            message: `Bill #${bill.billNumber || ''} sent to ${printer.name} via local Wi-Fi print station`
          });
          continue;
        }
      }
      try {
        let actualUsbPort = printer.usbPort;
        if (isUsb) {
          const res = await sendRawToUSBPrinter(printer.usbPort, buffer, printer.deviceName || printer.name);
          if (res.actualPort && res.actualPort !== printer.usbPort) {
            actualUsbPort = res.actualPort;
            console.log(`[PrinterService] Auto-updated printer '${printer.name}' port from ${printer.usbPort} to ${res.actualPort}`);
            printer.usbPort = res.actualPort;
            try {
              const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
              await PrinterConfig.findByIdAndUpdate(printer._id, { usbPort: res.actualPort });
            } catch (_) {}
          }
        } else if (isBluetooth) {
          await sendRawToBluetoothPrinter(printer.bluetoothAddress || printer.deviceName || printer.name, buffer);
        } else {
          await sendRawToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
        }

        const effectiveDestination = isUsb
          ? `USB Port: ${actualUsbPort}`
          : targetDestination;

        results.push({
          printer: printer.name,
          ip: printer.ipAddress || null,
          usbPort: isUsb ? actualUsbPort : null,
          port: printer.port || 9100,
          success: true,
          message: `Bill #${bill.billNumber || ''} printed successfully to ${printer.name} (${effectiveDestination})`
        });
        emitNotification(
          req,
          '🖨️ Bill Printed',
          `Bill #${bill.billNumber || ''} printed to ${printer.name} (${effectiveDestination})`,
          'success',
          ['Admin', 'Cashier', 'Manager']
        );
      } catch (err) {
        console.error(`[PrinterService] Bill print error on '${printer.name}' (${targetDestination}): ${err.message}`);

        // Build a clean, user-friendly error message (hide raw PowerShell/system noise)
        let friendlyMsg = err.message || 'Unknown error';
        if (/PRINTER_OFFLINE|no active COM|not reachable|not connected|not responding/i.test(friendlyMsg)) {
          friendlyMsg = `Printer "${printer.name}" is OFF or not connected. Please turn it ON and try again.`;
        } else if (/timeout|timed out/i.test(friendlyMsg)) {
          friendlyMsg = `Printer "${printer.name}" is not responding. Check the connection and try again.`;
        } else if (/TCP connection failed|ECONNREFUSED/i.test(friendlyMsg)) {
          friendlyMsg = `Cannot reach printer "${printer.name}" on the network. Check the IP address and connection.`;
        } else if (friendlyMsg.length > 120) {
          // Truncate very long raw technical messages
          friendlyMsg = friendlyMsg.substring(0, 120).trim() + '…';
        }

        results.push({
          printer: printer.name,
          ip: printer.ipAddress || null,
          usbPort: printer.usbPort || null,
          success: false,
          message: `Failed to print to ${printer.name}: ${friendlyMsg}`
        });
        emitNotification(
          req,
          '🖨️ Printer Not Connected',
          friendlyMsg,
          'warning',
          ['Admin', 'Cashier', 'Manager']
        );
      }
    }

    const anySuccess = results.some(r => r.success);
    return {
      success: anySuccess,
      results,
      message: anySuccess
        ? results.filter(r => r.success).map(r => r.message).join(', ')
        : results.map(r => r.message).join('; ')
    };
  } catch (error) {
    console.error('[PrinterService] Critical error during bill printing:', error);
    return { success: false, message: error.message };
  }
};

export { sendRawToUSBPrinter, getAvailableUSBAndCOMPorts, scanNetworkThermalPrinters };
