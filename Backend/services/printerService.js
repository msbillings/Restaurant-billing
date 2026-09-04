import net from 'net';
import PrinterConfigDefault from '../models/PrinterConfig.js';
import MenuDefault from '../models/Menu.js';
import CategoryDefault from '../models/Category.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { emitNotification } from '../utils/notificationHelper.js';

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
  BOLD_ON: ESC + 'E\x01',            // Bold text ON
  BOLD_OFF: ESC + 'E\x00',           // Bold text OFF
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
        }, 150);
      });
    });

    socket.on('error', (err) => {
      if (!isHandled) {
        isHandled = true;
        socket.destroy();
        reject(new Error(`Printer socket error (${ipAddress}:${port}): ${err.message}`));
      }
    });

    socket.on('timeout', () => {
      if (!isHandled) {
        isHandled = true;
        socket.destroy();
        reject(new Error(`Printer connection timed out (${ipAddress}:${port})`));
      }
    });
  });
};

/**
 * Generate a Test Receipt ESC/POS buffer
 */
export const generateESCPOSTestReceipt = (config) => {
  const lineDivider = config.paperWidth === '58mm'
    ? '--------------------------------'
    : '------------------------------------------------';

  let content = '';
  
  content += CMD.INIT;
  content += CMD.ALIGN_CENTER;
  content += CMD.TEXT_LARGE + CMD.BOLD_ON + 'TEST PRINT' + CMD.LINE_FEED;
  content += CMD.TEXT_NORMAL + CMD.BOLD_OFF + lineDivider + CMD.LINE_FEED;
  content += CMD.ALIGN_LEFT;
  content += `Printer Name : ${config.name}` + CMD.LINE_FEED;
  content += `Printer Type : ${config.type?.toUpperCase()}` + CMD.LINE_FEED;
  content += `Connection   : ${config.connectionType?.toUpperCase()}` + CMD.LINE_FEED;
  content += `IP Address   : ${config.ipAddress || 'USB / Local'}:${config.port || 9100}` + CMD.LINE_FEED;
  content += `Department   : ${config.assignTo || 'All Departments'}` + CMD.LINE_FEED;
  content += `Paper Width  : ${config.paperWidth || '80mm'}` + CMD.LINE_FEED;
  content += `Date & Time  : ${new Date().toLocaleString()}` + CMD.LINE_FEED;
  content += CMD.ALIGN_CENTER;
  content += lineDivider + CMD.LINE_FEED;
  content += CMD.BOLD_ON + 'Hardware Communication OK!' + CMD.LINE_FEED + CMD.BOLD_OFF;
  content += CMD.LINE_FEED + CMD.LINE_FEED + CMD.LINE_FEED;
  content += CMD.CUT_PAPER;

  return Buffer.from(content, 'utf-8');
};

/**
 * Generate a formatted KOT ESC/POS Buffer for thermal printers
 */
export const generateKOTESCPOSBuffer = (bill, items, kotNumber, printerConfig, queueNumber) => {
  const is58mm = printerConfig.paperWidth === '58mm';
  const lineDivider = is58mm
    ? '--------------------------------'
    : '------------------------------------------------';

  let content = '';
  
  content += CMD.INIT;
  content += CMD.ALIGN_CENTER;
  content += CMD.TEXT_LARGE + CMD.BOLD_ON + 'KITCHEN ORDER (KOT)' + CMD.LINE_FEED;
  content += CMD.TEXT_DOUBLE_HEIGHT + `KOT NO: ${kotNumber}` + CMD.LINE_FEED;
  if (kotNumber && !kotNumber.toUpperCase().includes('UPDATE')) {
    const queueNo = queueNumber || bill.tokenNo || bill.queueNumber || '1';
    content += CMD.TEXT_DOUBLE_HEIGHT + CMD.BOLD_ON + `QUEUE NO: #${queueNo}` + CMD.LINE_FEED;
  }
  content += CMD.TEXT_NORMAL + CMD.BOLD_OFF;
  content += lineDivider + CMD.LINE_FEED;
  
  content += CMD.ALIGN_LEFT;
  const bType = bill.billType || bill.orderType || (bill.tableNo?.startsWith('DEL') ? 'Delivery' : (bill.tableNo?.startsWith('TAK') ? 'Takeaway' : 'Dine In'));
  if (bType === 'Delivery') {
    const partner = (bill.orderSource || '').trim() || 'DIRECT';
    content += CMD.TEXT_DOUBLE_HEIGHT + CMD.BOLD_ON + `DELIVERY: ${partner.toUpperCase()}` + CMD.LINE_FEED;
    content += CMD.BOLD_ON + `Order #${bill.tableNo || 'DEL'}` + CMD.BOLD_OFF + CMD.LINE_FEED;
  } else if (bType === 'Takeaway') {
    content += CMD.TEXT_DOUBLE_HEIGHT + CMD.BOLD_ON + `TAKEAWAY ${bill.tableNo ? `(${bill.tableNo})` : ''}` + CMD.LINE_FEED;
  } else {
    content += CMD.BOLD_ON + `TABLE: ${bill.tableNo || 'Dine In'}` + CMD.BOLD_OFF + CMD.LINE_FEED;
  }
  content += `Time: ${new Date(bill?.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` + CMD.LINE_FEED;
  content += lineDivider + CMD.LINE_FEED;

  // Header for items
  content += CMD.BOLD_ON + 'QTY  ITEM NAME' + CMD.LINE_FEED;
  content += lineDivider + CMD.LINE_FEED + CMD.BOLD_OFF;

  // Items list
  items.forEach((item) => {
    const isCancelled = item.status === 'Cancelled' || item.isCancelled;
    const isReduced = !isCancelled && (item.reducedQuantity > 0);
    const cancelQty = item.cancelledQuantity || item.quantity || 1;
    const qtyNum = isCancelled ? `-${cancelQty}` : `${item.quantity || 0}`;
    const qtyStr = qtyNum.padStart(3, ' ');
    let itemName = item.name || item.itemName || 'Item';
    if (isCancelled) itemName += ' [CANCELLED]';
    else if (isReduced) itemName += ` [-${item.reducedQuantity}x REDUCED]`;

    content += CMD.TEXT_DOUBLE_HEIGHT + CMD.BOLD_ON + `${qtyStr}  ${itemName}` + CMD.LINE_FEED + CMD.TEXT_NORMAL + CMD.BOLD_OFF;
    if (item.specialNote) {
      content += `     * Note: ${item.specialNote}` + CMD.LINE_FEED;
    }
  });

  content += lineDivider + CMD.LINE_FEED;
  if (printerConfig.assignTo && printerConfig.assignTo.trim() !== '') {
    content += CMD.ALIGN_CENTER + `[ DEPT: ${printerConfig.assignTo.toUpperCase()} ]` + CMD.LINE_FEED;
  }
  content += CMD.LINE_FEED + CMD.LINE_FEED + CMD.LINE_FEED;
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

    // Fetch active printers
    const activePrinters = await PrinterConfig.find({ isActive: true });
    if (!activePrinters || activePrinters.length === 0) {
      console.log('[PrinterService] No active printers configured.');
      return;
    }

    const kotPrinters = activePrinters.filter(p => p.type === 'kot' || p.type === 'general');
    if (kotPrinters.length === 0) {
      console.log('[PrinterService] No active KOT/General printers found.');
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

    // Process all configured KOT printers in parallel
    const printPromises = kotPrinters.map(async (printer) => {
      if (printer.connectionType !== 'network' || !printer.ipAddress) {
        console.log(`[PrinterService] Printer '${printer.name}' is ${printer.connectionType} (Browser/OS driver mode).`);
        return;
      }

      // If running on cloud (Render or Vercel) and printer IP is a private LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x, 127.0.0.1):
      // The cloud server cannot reach the local LAN printer directly via TCP. Local POS Desktop app handles printing.
      const isPrivateLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|localhost)/.test(printer.ipAddress);
      const isCloudEnv = process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' && !process.env.APP_USER_DATA_PATH);
      if (isCloudEnv && isPrivateLanIp) {
        console.log(`[PrinterService] Cloud environment (Render/Vercel) cannot reach private LAN printer '${printer.name}' (${printer.ipAddress}). Skipping cloud TCP.`);
        return;
      }

      // Department Filtering Logic
      const assignedDept = (printer.assignTo || '').trim().toLowerCase();
      let targetItems = kotItems;

      if (assignedDept !== '' && assignedDept !== 'all' && assignedDept !== 'general') {
        const deptTokens = assignedDept.split(',').map(d => d.trim()).filter(Boolean);

        targetItems = kotItems.filter(item => {
          const itemLower = (item.name || '').toLowerCase();
          const catLower = categoryMap[itemLower] || (item.category?.name || item.category || '').toLowerCase();

          return deptTokens.some(token => catLower.includes(token) || itemLower.includes(token));
        });
      }

      // If specific department is assigned but no items matched this department, skip printing on this specific printer
      if (targetItems.length === 0 && assignedDept !== '' && assignedDept !== 'all' && assignedDept !== 'general') {
        console.log(`[PrinterService] Skipping printer '${printer.name}' (${printer.assignTo}) - no items matched department.`);
        return;
      }

      const itemsToPrint = targetItems.length > 0 ? targetItems : kotItems;
      const buffer = generateKOTESCPOSBuffer(bill, itemsToPrint, kotNumber, printer, queueNumber);

      console.log(`[PrinterService] Streaming KOT #${kotNumber} to '${printer.name}' (${printer.ipAddress}:${printer.port || 9100})`);

      try {
        const res = await sendRawToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
        console.log(`[PrinterService] Success: ${res.message}`);
        emitNotification(
          req,
          '🖨️ KOT Printed',
          `KOT #${kotNumber} sent to ${printer.name} (${printer.ipAddress})`,
          'success',
          ['Admin', 'Captain', 'Manager']
        );
      } catch (err) {
        console.error(`[PrinterService] Error on '${printer.name}' (${printer.ipAddress}): ${err.message}`);
        emitNotification(
          req,
          '⚠️ Printer Offline',
          `Could not print KOT #${kotNumber} to ${printer.name} (${printer.ipAddress}): ${err.message}`,
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
