// Backwards compatibility layer for controllers importing from printerService.js
// This file delegates all real work to the modular /print/ directory.

import { printKOTToPrinters, printBillToPrinters } from './print/printOrchestrator.js';
import { sendRawToNetworkPrinter } from './print/connections/lan.js';
import { sendRawToUSBPrinter } from './print/connections/usb.js';
import { sendRawToBluetoothPrinter } from './print/connections/bluetooth.js';
import { getAvailableUSBAndCOMPorts } from './print/connections/usb.js';
import { scanNetworkThermalPrinters } from './networkPrinterScanner.js';

import { 
  generateESCPOSQRCodeRaster, 
  generateESCPOSSolidLine, 
  generateESCPOSLogoRaster,
  wrapTextLines,
  formatTwoCols,
  CMD
} from './print/utils/escposHelpers.js';

import { generateKOTESCPOSBuffer58mm } from './print/formatters/kot-58mm.js';
import { generateKOTESCPOSBuffer80mm } from './print/formatters/kot-80mm.js';
import { generateESCPOSBillReceipt58mm } from './print/formatters/bill-58mm.js';
import { generateESCPOSBillReceipt80mm } from './print/formatters/bill-80mm.js';

/**
 * Legacy wrapper for KOT Buffer Generator (determines 58 vs 80mm internally)
 */
export const generateKOTESCPOSBuffer = (bill, items, kotNumber, printerConfig = {}, queueNumber, restaurantDetails = {}) => {
  const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };
  const is58mm = printerConfig.paperWidth === '58mm' || s.printFormat === '58mm';
  
  if (is58mm) {
    return generateKOTESCPOSBuffer58mm(bill, items, kotNumber, printerConfig, queueNumber, restaurantDetails);
  }
  return generateKOTESCPOSBuffer80mm(bill, items, kotNumber, printerConfig, queueNumber, restaurantDetails);
};

/**
 * Legacy wrapper for Bill Receipt Buffer Generator
 */
export const generateESCPOSBillReceipt = async (bill, printerConfig = {}, restaurantDetails = {}) => {
  const s = { ...restaurantDetails, ...(bill?.restaurantDetails || {}) };
  const is58mm = printerConfig.paperWidth === '58mm' || s.printFormat === '58mm';
  
  if (is58mm) {
    return await generateESCPOSBillReceipt58mm(bill, printerConfig, restaurantDetails);
  }
  return await generateESCPOSBillReceipt80mm(bill, printerConfig, restaurantDetails);
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

export {
  printKOTToPrinters,
  printBillToPrinters,
  sendRawToNetworkPrinter,
  sendRawToUSBPrinter,
  getAvailableUSBAndCOMPorts,
  scanNetworkThermalPrinters,
  generateESCPOSQRCodeRaster,
  generateESCPOSSolidLine,
  generateESCPOSLogoRaster,
  wrapTextLines,
  formatTwoCols
};
