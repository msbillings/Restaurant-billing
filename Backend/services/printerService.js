import net from 'net';
import QRCode from 'qrcode';
import PrinterConfigDefault from '../models/PrinterConfig.js';
import MenuDefault from '../models/Menu.js';
import CategoryDefault from '../models/Category.js';
import SettingDefault from '../models/Setting.js';
import FloorDefault from '../models/Floor.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { emitNotification } from '../utils/notificationHelper.js';
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
  TEXT_NORMAL: GS + '!\x00',         // Normal text size
  TEXT_DOUBLE_HEIGHT: GS + '!\x01',  // Double height text
  TEXT_DOUBLE_WIDTH: GS + '!\x10',   // Double width text
  TEXT_LARGE: GS + '!\x11',          // Double height & width text
  FONT_A: ESC + 'M\x00',            // Font A (Standard 12x24)
  FONT_B: ESC + 'M\x01',            // Font B (Condensed 9x17 Monospace)
  LINE_SPACING_DEFAULT: ESC + '2',  // Default 30-dot line spacing
  LINE_SPACING_COMPACT: ESC + '3\x18', // Compact 24-dot line spacing (for Small text size)
  LINE_SPACING_RELAXED: ESC + '3\x26', // Relaxed 38-dot line spacing (for Large/XL text size)
  BOLD_ON: ESC + 'E\x01',            // Bold text ON
  BOLD_OFF: ESC + 'E\x00',           // Bold text OFF
  DOUBLE_STRIKE_ON: ESC + 'G\x01',   // Double-strike ON (darker thermal print)
  DOUBLE_STRIKE_OFF: ESC + 'G\x00',  // Double-strike OFF
  CUT_PAPER: GS + 'V\x42\x00',       // Full paper cut
  LINE_FEED: '\n'
};

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
  const width = is58mm ? 32 : 48;
  const lineDivider = '-'.repeat(width);

  // Dynamic Font Size from Settings ('small', 'medium', 'large', 'extra-large')
  const fontSize = (s.receiptFontSize || printerConfig.fontSize || 'medium').toLowerCase();

  // Dynamic Font Style / Family from Settings
  const fontFamily = (s.receiptFontFamily || '').toLowerCase();
  const isMonospace = fontFamily.includes('mono') || fontFamily.includes('courier') || fontFamily.includes('lucida');

  let content = '';
  content += CMD.INIT;

  // Apply dynamic font style (Monospace Font B vs Standard Font A)
  if (isMonospace) {
    content += CMD.FONT_B;
  } else {
    content += CMD.FONT_A;
  }

  // Apply dynamic line spacing based on font size setting
  if (fontSize === 'small') {
    content += CMD.LINE_SPACING_COMPACT;
  } else if (fontSize === 'large' || fontSize === 'extra-large') {
    content += CMD.LINE_SPACING_RELAXED;
  } else {
    content += CMD.LINE_SPACING_DEFAULT;
  }

  // Apply global BOLD_ON for darker print in a single thermal pass (no double-strike speed penalty)
  content += CMD.BOLD_ON;

  // 1. Date & Time Centered
  content += CMD.ALIGN_CENTER;
  const d = new Date(bill.createdAt || Date.now());
  const dateStr = `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  content += dateStr + CMD.LINE_FEED;

  // 2. KOT Number Centered & Bold
  let rawKot = (kotNumber || bill.kotNumber || '1').toString().trim();
  let numOnly = rawKot.replace(/^[A-Za-z\s-]+/i, '').trim();
  const kotLabel = rawKot.toUpperCase().includes('UPDATE') ? rawKot : (numOnly ? `KOT No: ${numOnly}` : `KOT No: ${rawKot}`);
  content += CMD.TEXT_DOUBLE_HEIGHT + CMD.BOLD_ON + kotLabel + CMD.LINE_FEED + CMD.TEXT_NORMAL + CMD.BOLD_OFF;

  // 3. Station Badge immediately below KOT No (Matches right slip in user photo)
  const kitchenTitle = (printerConfig.name || printerConfig.assignTo || '').trim().toUpperCase();
  const locationSub = printerConfig.location ? ` - ${printerConfig.location.trim().toUpperCase()}` : '';
  if (kitchenTitle && kitchenTitle !== 'KITCHEN') {
    content += CMD.BOLD_ON + `[ ${kitchenTitle}${locationSub} ]` + CMD.BOLD_OFF + CMD.LINE_FEED;
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

  // 5. Table Number Centered (Bold)
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
    content += CMD.ALIGN_CENTER + CMD.BOLD_ON + tableLabel + CMD.LINE_FEED + CMD.BOLD_OFF;
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
    content += CMD.BOLD_ON + 'Item                    Special Note        Qty.' + CMD.LINE_FEED + CMD.BOLD_OFF;
  }
  content += lineDivider + CMD.LINE_FEED;

  // 10. Items Rows with BOLD item names, BOLD quantities, and clean whole-word wrapping
  const maxItem = is58mm ? 16 : 22;
  const maxNote = is58mm ? 9 : 18;
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
export const printKOTToPrinters = async (req, bill, kotNumber, kotItems, queueNumber) => {
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

      // If running on cloud (Render or Vercel) and printer IP is a private LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x, 127.0.0.1):
      // The cloud server cannot reach the local LAN printer directly via TCP. Local POS Desktop app handles printing.
      if (isNetwork) {
        const isPrivateLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|localhost)/.test(printer.ipAddress);
        const isCloudEnv = process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' && !process.env.APP_USER_DATA_PATH);
        if (isCloudEnv && isPrivateLanIp) {
          console.log(`[PrinterService] Cloud environment (Render/Vercel) cannot reach private LAN printer '${printer.name}' (${printer.ipAddress}). Skipping cloud TCP.`);
          return;
        }
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
      const buffer = generateKOTESCPOSBuffer(bill, itemsToPrint, kotNumber, printer, queueNumber, restaurantDetails);

      const targetDestination = isUsb
        ? `USB Port: ${printer.usbPort}`
        : isBluetooth
          ? `Bluetooth: ${printer.bluetoothAddress || printer.deviceName || printer.name}`
          : `${printer.ipAddress}:${printer.port || 9100}`;
      console.log(`[PrinterService] Streaming KOT #${kotNumber} to '${printer.name}' (${targetDestination})`);

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

    const widthBytes = Math.ceil(pixelWidth / 8);
    const dataBuffer = Buffer.alloc(widthBytes * pixelHeight, 0);

    for (let y = 0; y < pixelHeight; y++) {
      const moduleY = Math.floor(y / scale) - margin;
      for (let x = 0; x < pixelWidth; x++) {
        const moduleX = Math.floor(x / scale) - margin;

        let isBlack = false;
        if (moduleX >= 0 && moduleX < moduleCount && moduleY >= 0 && moduleY < moduleCount) {
          isBlack = modules[moduleY * moduleCount + moduleX] === 1;
        }

        if (isBlack) {
          const byteIndex = y * widthBytes + Math.floor(x / 8);
          const bitIndex = 7 - (x % 8);
          dataBuffer[byteIndex] |= (1 << bitIndex);
        }
      }
    }

    const xL = widthBytes & 0xFF;
    const xH = (widthBytes >> 8) & 0xFF;
    const yL = pixelHeight & 0xFF;
    const yH = (pixelHeight >> 8) & 0xFF;

    const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);

    return Buffer.concat([
      Buffer.from(CMD.ALIGN_CENTER, 'utf-8'),
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
 * Generate a formatted Bill Receipt ESC/POS Buffer for thermal printers (80mm & 58mm)
 * Pixel-accurate layout matching on-screen MS Billings Invoice
 */
export const generateESCPOSBillReceipt = (bill, printerConfig = {}, restaurantDetails = {}) => {
  const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };

  // Dynamic Paper Width from Settings or Printer Config (80mm vs 58mm)
  const is58mm = printerConfig.paperWidth === '58mm' || s.printFormat === '58mm';
  const width = is58mm ? 32 : 48;
  const lineDivider = '-'.repeat(width);

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

  let content = '';
  content += CMD.INIT;

  // Apply dynamic font style (Monospace Font B vs Standard Font A)
  if (isMonospace) {
    content += CMD.FONT_B;
  } else {
    content += CMD.FONT_A;
  }

  // Apply dynamic line spacing based on font size setting
  if (fontSize === 'small') {
    content += CMD.LINE_SPACING_COMPACT;
  } else if (fontSize === 'large' || fontSize === 'extra-large') {
    content += CMD.LINE_SPACING_RELAXED;
  } else {
    content += CMD.LINE_SPACING_DEFAULT;
  }

  // Apply global BOLD_ON for darker print in a single thermal pass (no double-strike speed penalty)
  content += CMD.BOLD_ON;

  // 1. Header - Restaurant Branding
  content += CMD.ALIGN_CENTER;
  if (printerConfig.printHeader && printerConfig.printHeader.trim()) {
    content += printerConfig.printHeader.trim() + CMD.LINE_FEED;
  }
  content += CMD.TEXT_DOUBLE_HEIGHT + CMD.BOLD_ON + restName.toUpperCase() + CMD.LINE_FEED + CMD.TEXT_NORMAL + CMD.BOLD_OFF;

  if (restAddress) {
    const addrLines = wrapTextLines(restAddress, width);
    addrLines.forEach(l => {
      content += l + CMD.LINE_FEED;
    });
  }
  if (gstin) {
    content += `GSTIN : ${gstin}` + CMD.LINE_FEED;
  }
  if (restPhone) {
    content += `PH : ${restPhone}` + CMD.LINE_FEED;
  }
  if (fssai) {
    content += `FSSAI : ${fssai}` + CMD.LINE_FEED;
  }

  content += lineDivider + CMD.LINE_FEED;

  // 2. Invoice Title
  const invoiceTitle = bill.status === 'Unpaid' 
    ? 'Unpaid (Khata)' 
    : (bill.discountType === 'complimentary' ? 'Complimentary Bill' : 'Tax Invoice');
  content += CMD.BOLD_ON + invoiceTitle + CMD.LINE_FEED + CMD.BOLD_OFF;
  content += lineDivider + CMD.LINE_FEED;

  // 3. Order & Table Details (Matching On-Screen Layout)
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
  content += CMD.ALIGN_CENTER + CMD.BOLD_ON + tableLabel + CMD.LINE_FEED + CMD.BOLD_OFF;

  content += CMD.ALIGN_LEFT;
  const dateObj = new Date(bill.settledAt || bill.billedAt || bill.createdAt || Date.now());
  const dateStr = `Date: ${dateObj.toLocaleDateString('en-GB')}`;
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  content += formatTwoCols(dateStr, timeStr, width) + CMD.LINE_FEED;

  const cashierStr = `Cashier: ${bill.cashierName || 'admin'}`;
  const billCleanNo = (bill.billNumber || bill._id?.toString().slice(-6) || 'PREVIEW').replace(/^#/, '');
  const billNoStr = `Bill No.: ${billCleanNo}`;
  content += formatTwoCols(cashierStr, billNoStr, width) + CMD.LINE_FEED;

  if (bill.captainName) {
    content += `Assign to: ${bill.captainName}` + CMD.LINE_FEED;
  }
  if (bill.tokenNumber || bill.tokenNo || bill.queueNumber) {
    const tNum = bill.tokenNumber || bill.tokenNo || bill.queueNumber;
    content += CMD.BOLD_ON + `Token No.: ${tNum}` + CMD.BOLD_OFF + CMD.LINE_FEED;
  }
  if (bill.customerName || bill.customerPhone) {
    const custStr = [bill.customerName, bill.customerPhone].filter(Boolean).join(' | ');
    content += `Customer: ${custStr.substring(0, width - 10)}` + CMD.LINE_FEED;
  }

  content += lineDivider + CMD.LINE_FEED;

  // 4. Items Table Header
  if (is58mm) {
    content += CMD.BOLD_ON + 'Item             Qty.     Amount' + CMD.LINE_FEED + CMD.BOLD_OFF;
  } else {
    // 48 chars: Item (22) + space + Qty. (6) + space + Price (8) + space + Amount (10) = 48
    content += CMD.BOLD_ON + 'Item                    Qty.    Price     Amount' + CMD.LINE_FEED + CMD.BOLD_OFF;
  }
  content += lineDivider + CMD.LINE_FEED;

  // 5. Items List
  const activeItems = (bill.items || []).filter(i => !i.isCancelled);
  let totalQty = 0;

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
      content += CMD.BOLD_ON + firstLineItem + CMD.BOLD_OFF + ' ' + CMD.BOLD_ON + qStr + CMD.BOLD_OFF + ' ' + CMD.BOLD_ON + aStr + CMD.BOLD_OFF + CMD.LINE_FEED;
      for (let l = 1; l < itemLines.length; l++) {
        content += CMD.BOLD_ON + `  ${itemLines[l]}` + CMD.BOLD_OFF + CMD.LINE_FEED;
      }
    } else {
      // 48 chars: Item (22) + space + Qty. (6) + space + Price (8) + space + Amount (9) = 48
      const maxLen = 22;
      const itemLines = wrapTextLines(name, maxLen);
      const firstLineItem = (itemLines[0] || '').padEnd(maxLen, ' ');
      const qStr = String(qty).padStart(6, ' ');
      const pStr = price.padStart(8, ' ');
      const aStr = amount.padStart(9, ' ');
      content += CMD.BOLD_ON + firstLineItem + CMD.BOLD_OFF + ' ' + CMD.BOLD_ON + qStr + CMD.BOLD_OFF + ' ' + pStr + ' ' + CMD.BOLD_ON + aStr + CMD.BOLD_OFF + CMD.LINE_FEED;
      for (let l = 1; l < itemLines.length; l++) {
        content += CMD.BOLD_ON + `  ${itemLines[l]}` + CMD.BOLD_OFF + CMD.LINE_FEED;
      }
    }

    if (item.specialNote) {
      content += `  * Note: ${item.specialNote.substring(0, width - 10)}` + CMD.LINE_FEED;
    }
  });

  content += lineDivider + CMD.LINE_FEED;

  // 6. Totals & Breakdown
  const sub = Number(bill.subtotal || activeItems.reduce((acc, curr) => acc + (Number(curr.price || 0) * ((curr.quantity || 1) - (curr.cancelledQuantity || 0))), 0) || 0);
  const disc = Number(bill.discount || 0);
  const taxable = Math.max(0, sub - disc);

  // Subtotal with Total Qty
  if (is58mm) {
    content += formatTwoCols(`Total Qty: ${totalQty}`, `Sub Total: ${sub.toFixed(2)}`, width) + CMD.LINE_FEED;
    if (disc > 0) {
      const discPct = bill.discountType === 'percentage' && bill.discountValue 
        ? ` (${bill.discountValue}%)` 
        : (bill.discountType === 'complimentary' ? ' (100%)' : (bill.discountName ? ` (${bill.discountName})` : ''));
      content += CMD.BOLD_ON + formatTwoCols(`Discount${discPct}:`, `-${disc.toFixed(2)}`, width) + CMD.LINE_FEED + CMD.BOLD_OFF;
    }
  } else {
    const leftSide = `Total Qty: ${totalQty}`;
    const rightSide = `Sub Total          ${sub.toFixed(2)}`;
    content += formatTwoCols(leftSide, rightSide, width) + CMD.LINE_FEED;

    if (disc > 0) {
      const discPct = bill.discountType === 'percentage' && bill.discountValue 
        ? ` (${bill.discountValue}%)` 
        : (bill.discountType === 'complimentary' ? ' (100%)' : (bill.discountName ? ` (${bill.discountName})` : ''));
      const discRight = `Discount${discPct}     -${disc.toFixed(2)}`;
      content += CMD.BOLD_ON + formatTwoCols('', discRight, width) + CMD.LINE_FEED + CMD.BOLD_OFF;
    }
  }

  // Tax Breakdown (CGST, SGST, IGST) - Strictly honor Individual Tax Options toggles
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
      content += formatTwoCols(`CGST@${cRate.toFixed(1)}%:`, cAmt.toFixed(2), width) + CMD.LINE_FEED;
      content += formatTwoCols(`SGST@${sRate.toFixed(1)}%:`, sAmt.toFixed(2), width) + CMD.LINE_FEED;
    } else if (gRate > 0) {
      content += formatTwoCols(`GST@${gRate.toFixed(1)}%:`, computedTaxRupees.toFixed(2), width) + CMD.LINE_FEED;
    } else {
      content += formatTwoCols(`GST/Tax:`, computedTaxRupees.toFixed(2), width) + CMD.LINE_FEED;
    }
  }

  // Delivery & Container Charge
  if (Number(bill.deliveryCharge || 0) > 0) {
    content += formatTwoCols('Delivery Charge:', Number(bill.deliveryCharge).toFixed(2), width) + CMD.LINE_FEED;
  }
  if (Number(bill.containerCharge || 0) > 0) {
    content += formatTwoCols('Container Charge:', Number(bill.containerCharge).toFixed(2), width) + CMD.LINE_FEED;
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
    content += formatTwoCols('Round off:', `${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}`, width) + CMD.LINE_FEED;
  }

  content += lineDivider + CMD.LINE_FEED;

  // 7. Grand Total - Prominent Bold Double Height
  content += CMD.TEXT_DOUBLE_HEIGHT + CMD.BOLD_ON;
  content += formatTwoCols('Grand Total', `Rs.${roundedTotal.toFixed(2)}`, width) + CMD.LINE_FEED;
  content += CMD.TEXT_NORMAL + CMD.BOLD_OFF;
  content += lineDivider + CMD.LINE_FEED;

  // 8. Payment Status (Only when bill has payment details or is unpaid)
  const hasSplit = bill.paymentMode === 'Mixed' || (bill.splitPayments && (Number(bill.splitPayments.cash || 0) > 0 || Number(bill.splitPayments.upi || 0) > 0 || Number(bill.splitPayments.card || 0) > 0));
  if (hasSplit) {
    content += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'PAID VIA MIXED PAYMENT' + CMD.LINE_FEED + CMD.BOLD_OFF;
    const parts = [];
    if (Number(bill.splitPayments?.cash || 0) > 0) parts.push(`Cash: Rs.${Number(bill.splitPayments.cash).toFixed(2)}`);
    if (Number(bill.splitPayments?.upi || 0) > 0) parts.push(`UPI: Rs.${Number(bill.splitPayments.upi).toFixed(2)}`);
    if (Number(bill.splitPayments?.card || 0) > 0) parts.push(`Card: Rs.${Number(bill.splitPayments.card).toFixed(2)}`);
    content += parts.join(' | ') + CMD.LINE_FEED;
    content += lineDivider + CMD.LINE_FEED;
  } else if (bill.status === 'Unpaid') {
    content += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'UNPAID (KHATA BILL)' + CMD.LINE_FEED + CMD.BOLD_OFF;
    content += lineDivider + CMD.LINE_FEED;
  } else if (bill.paymentMode) {
    const isUpiMode = bill.paymentMode === 'UPI' || bill.paymentMode === 'QR' || bill.paymentMode === 'Online';
    const appSuffix = isUpiMode && (bill.upiApp || bill.paymentMethod) ? ` [${bill.upiApp || bill.paymentMethod}]` : '';
    content += CMD.ALIGN_CENTER + CMD.BOLD_ON + `Paid via ${bill.paymentMode}${appSuffix}` + CMD.LINE_FEED + CMD.BOLD_OFF;
    content += lineDivider + CMD.LINE_FEED;
  }

  // 9. UPI Scan to Pay QR Code (Universal 1-bit Monochrome ESC/POS Raster)
  const pa = (s.upiId || '').trim();
  let qrBlock = Buffer.alloc(0);
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
    postQr += lineDivider + CMD.LINE_FEED;

    qrBlock = Buffer.concat([
      Buffer.from(preQr, 'utf-8'),
      qrRasterBuffer,
      Buffer.from(postQr, 'utf-8')
    ]);
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

  return Buffer.concat([
    Buffer.from(content, 'utf-8'),
    qrBlock,
    Buffer.from(footer, 'utf-8')
  ]);
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

      if (isNetwork) {
        const isPrivateLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|localhost)/.test(printer.ipAddress);
        const isCloudEnv = process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' && !process.env.APP_USER_DATA_PATH);
        if (isCloudEnv && isPrivateLanIp) {
          results.push({
            printer: printer.name,
            success: false,
            message: `Cloud environment (Render/Vercel) cannot reach private LAN printer '${printer.name}' (${printer.ipAddress}).`
          });
          continue;
        }
      }

      let buffer;
      if (rasterBufferBase64 && typeof rasterBufferBase64 === 'string') {
        buffer = Buffer.from(rasterBufferBase64, 'base64');
      } else {
        buffer = generateESCPOSBillReceipt(bill, printer, restaurantDetails);
      }
      const targetDestination = isUsb
        ? `USB Port: ${printer.usbPort}`
        : isBluetooth
          ? `Bluetooth: ${printer.bluetoothAddress || printer.deviceName || printer.name}`
          : `${printer.ipAddress}:${printer.port || 9100}`;
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
