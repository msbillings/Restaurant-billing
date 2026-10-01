import PrinterConfigDefault from '../../models/PrinterConfig.js';
import MenuDefault from '../../models/Menu.js';
import SettingDefault from '../../models/Setting.js';
import FloorDefault from '../../models/Floor.js';
import { getTenantModel } from '../../utils/tenantHelper.js';
import { emitNotification } from '../../utils/notificationHelper.js';
import { sendRawToUSBPrinter } from './connections/usb.js';
import { sendRawToBluetoothPrinter } from './connections/bluetooth.js';
import { sendRawToNetworkPrinter } from './connections/lan.js';

import { generateKOTESCPOSBuffer58mm } from './formatters/kot-58mm.js';
import { generateKOTESCPOSBuffer80mm } from './formatters/kot-80mm.js';
import { generateESCPOSBillReceipt58mm } from './formatters/bill-58mm.js';
import { generateESCPOSBillReceipt80mm } from './formatters/bill-80mm.js';
import { categoryMapCache } from './utils/escposHelpers.js';

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

    const activePrinters = await PrinterConfig.find({ isActive: true });
    if (!activePrinters || activePrinters.length === 0) {
      return;
    }

    const kotPrinters = activePrinters.filter(p => p.type === 'kot' || p.type === 'general' || p.type === 'both');
    if (kotPrinters.length === 0) {
      return;
    }

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

    const printPromises = kotPrinters.map(async (printer) => {
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

        if (!tableFloorMatches) return;
      }

      const isNetwork = printer.connectionType === 'network' && printer.ipAddress;
      const isUsb = printer.connectionType === 'usb' && (printer.usbPort || printer.deviceName || printer.name);
      const isBluetooth = printer.connectionType === 'bluetooth' && (printer.bluetoothAddress || printer.deviceName || printer.name);

      if (!isNetwork && !isUsb && !isBluetooth) return;

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
      }

      const hasSpecificFilter = isItemMode || isCatMode || isDeptFilter;
      if (targetItems.length === 0 && hasSpecificFilter) return;

      const itemsToPrint = targetItems.length > 0 ? targetItems : kotItems;
      
      const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };
      const is58mm = printer.paperWidth === '58mm' || s.printFormat === '58mm';
      
      let buffer;
      if (rasterBufferBase64 && typeof rasterBufferBase64 === 'string') {
        buffer = Buffer.from(rasterBufferBase64, 'base64');
      } else {
        buffer = is58mm 
          ? generateKOTESCPOSBuffer58mm(bill, itemsToPrint, kotNumber, printer, queueNumber, restaurantDetails)
          : generateKOTESCPOSBuffer80mm(bill, itemsToPrint, kotNumber, printer, queueNumber, restaurantDetails);
      }

      if (printer.numberOfCopies && printer.numberOfCopies > 1) {
        buffer = Buffer.concat(Array(printer.numberOfCopies).fill(buffer));
      }

      const targetDestination = isUsb ? `USB Port: ${printer.usbPort}` : isBluetooth ? `Bluetooth: ${printer.bluetoothAddress || printer.deviceName || printer.name}` : `${printer.ipAddress}:${printer.port || 9100}`;
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
        
        emitNotification(req, '🖨️ KOT Printed', `KOT #${kotNumber} sent to ${printer.name} (${targetDestination})`, 'success', ['Admin', 'Captain', 'Manager']);
      } catch (err) {
        let friendlyMsg = err.message || 'Unknown error';
        if (/PRINTER_OFFLINE|no active COM|not reachable|not connected|not responding/i.test(friendlyMsg)) friendlyMsg = `Printer "${printer.name}" is OFF or not connected. Please turn it ON and try again.`;
        else if (/timeout|timed out/i.test(friendlyMsg)) friendlyMsg = `Printer "${printer.name}" is not responding. Check the connection and try again.`;
        else if (/TCP connection failed|ECONNREFUSED/i.test(friendlyMsg)) friendlyMsg = `Cannot reach printer "${printer.name}" on the network. Check the IP address and connection.`;
        else if (friendlyMsg.length > 120) friendlyMsg = friendlyMsg.substring(0, 120).trim() + '…';

        emitNotification(req, '🖨️ Printer Not Connected', friendlyMsg, 'warning', ['Admin', 'Captain', 'Manager']);
      }
    });

    await Promise.allSettled(printPromises);
  } catch (error) {
    console.error('[PrinterService] Critical error during multi-printer routing:', error.message);
  }
};

export const printBillToPrinters = async (req, bill, specificPrinterId = null, rasterBufferBase64 = null) => {
  try {
    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    const Setting = getTenantModel(req, 'Setting', SettingDefault);

    let dbSettings = {};
    try {
      const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
      if (settingsDoc?.value) {
        dbSettings = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
      }
    } catch (e) {}
    const restaurantDetails = { ...dbSettings, ...(bill.restaurantDetails || {}) };

    let query = { isActive: true };
    if (specificPrinterId) query._id = specificPrinterId;
    else query.type = { $in: ['receipt', 'general', 'both'] };

    const receiptPrinters = await PrinterConfig.find(query);
    if (!receiptPrinters || receiptPrinters.length === 0) {
      return { success: false, message: 'No active Receipt printer configured.' };
    }

    const targetPrinters = receiptPrinters.filter(p =>
      (p.connectionType === 'network' && p.ipAddress) ||
      (p.connectionType === 'usb' && (p.usbPort || p.deviceName || p.name)) ||
      (p.connectionType === 'bluetooth' && (p.bluetoothAddress || p.deviceName || p.name))
    );

    if (targetPrinters.length === 0) {
      return { success: false, message: 'No receipt printers are correctly configured.' };
    }

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
    } catch (e) {}

    const results = [];
    for (const printer of targetPrinters) {
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

        if (!tableFloorMatches) continue;
      }

      const isUsb = printer.connectionType === 'usb' && (printer.usbPort || printer.deviceName || printer.name);
      const isNetwork = printer.connectionType === 'network' && printer.ipAddress;
      const isBluetooth = printer.connectionType === 'bluetooth' && (printer.bluetoothAddress || printer.deviceName || printer.name);

      const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };
      const is58mm = printer.paperWidth === '58mm' || s.printFormat === '58mm';
      
      let buffer;
      if (!isBluetooth && rasterBufferBase64 && typeof rasterBufferBase64 === 'string') {
        buffer = Buffer.from(rasterBufferBase64, 'base64');
      } else {
        buffer = is58mm 
          ? await generateESCPOSBillReceipt58mm(bill, printer, restaurantDetails)
          : await generateESCPOSBillReceipt80mm(bill, printer, restaurantDetails);
      }

      if (printer.numberOfCopies && printer.numberOfCopies > 1) {
        buffer = Buffer.concat(Array(printer.numberOfCopies).fill(buffer));
      }

      try {
        let actualUsbPort = printer.usbPort;
        if (isUsb) {
          const res = await sendRawToUSBPrinter(printer.usbPort || printer.deviceName || printer.name, buffer, printer.deviceName || printer.name);
          if (res.actualPort && res.actualPort !== printer.usbPort) {
            actualUsbPort = res.actualPort;
            printer.usbPort = res.actualPort;
            try {
              const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
              await PrinterConfig.findByIdAndUpdate(printer._id, { usbPort: res.actualPort });
            } catch (_) { }
          }
        } else if (isBluetooth) {
          await sendRawToBluetoothPrinter(printer.bluetoothAddress || printer.deviceName || printer.name, buffer);
        } else {
          await sendRawToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
        }

        results.push({
          printer: printer.name,
          ip: printer.ipAddress || null,
          usbPort: isUsb ? actualUsbPort : null,
          port: printer.port || 9100,
          success: true,
          message: `Bill printed successfully to ${printer.name}`
        });
        
        emitNotification(req, '🖨️ Bill Printed', `Bill #${bill.billNumber || ''} printed to ${printer.name}`, 'success', ['Admin', 'Cashier', 'Manager']);
      } catch (err) {
        let friendlyMsg = err.message || 'Unknown error';
        if (/PRINTER_OFFLINE|no active COM|not reachable|not connected|not responding/i.test(friendlyMsg)) friendlyMsg = `Printer "${printer.name}" is OFF or not connected. Please turn it ON and try again.`;
        else if (/timeout|timed out/i.test(friendlyMsg)) friendlyMsg = `Printer "${printer.name}" is not responding. Check the connection and try again.`;
        else if (/TCP connection failed|ECONNREFUSED/i.test(friendlyMsg)) friendlyMsg = `Cannot reach printer "${printer.name}" on the network. Check the IP address and connection.`;
        else if (friendlyMsg.length > 120) friendlyMsg = friendlyMsg.substring(0, 120).trim() + '…';

        results.push({
          printer: printer.name,
          ip: printer.ipAddress || null,
          usbPort: printer.usbPort || null,
          success: false,
          message: `Failed to print to ${printer.name}: ${friendlyMsg}`
        });
        emitNotification(req, '🖨️ Printer Not Connected', friendlyMsg, 'warning', ['Admin', 'Cashier', 'Manager']);
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
    return { success: false, message: error.message };
  }
};
