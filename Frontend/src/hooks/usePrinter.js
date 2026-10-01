import { triggerUSBPrint } from '../utils/print/connections/usbPrint.js';
import { triggerBluetoothPrint } from '../utils/print/connections/bluetoothPrint.js';
import { triggerNetworkKOT, triggerNetworkBill } from '../utils/print/connections/networkPrint.js';
import { renderKOT58mm } from '../utils/print/formatters/kotRaster-58mm.js';
import { renderKOT80mm } from '../utils/print/formatters/kotRaster-80mm.js';
import { renderBill58mm } from '../utils/print/formatters/billRaster-58mm.js';
import { renderBill80mm } from '../utils/print/formatters/billRaster-80mm.js';

/**
 * Clean React hook to handle printing operations.
 * UI Components can use this hook to trigger prints without worrying about internal connections.
 */
export const usePrinter = () => {
  const printDocument = async ({ type, size, connection, data, element }) => {
    // 1. Web -> Android Bluetooth Printing
    if (connection === 'bluetooth' || window.AndroidPrint) {
      return triggerBluetoothPrint();
    }

    // 2. Web -> Local Network Relay or Server
    if (connection === 'network') {
      if (type === 'kot') return await triggerNetworkKOT(data);
      if (type === 'bill') return await triggerNetworkBill(data);
    }

    // 3. Web -> Desktop USB
    if (connection === 'usb' || window.electronAPI) {
      if (!element) throw new Error("DOM Element required for USB Desktop printing.");
      
      console.log('--- USB Print Timing Started ---');
      const startTotal = performance.now();
      
      let rasterData;
      if (type === 'kot') {
        rasterData = size === '58mm' ? await renderKOT58mm(element) : await renderKOT80mm(element);
      } else {
        rasterData = size === '58mm' ? await renderBill58mm(element) : await renderBill80mm(element);
      }
      
      const renderEnd = performance.now();
      console.log(`[Timer] Raster Render Time: ${(renderEnd - startTotal).toFixed(2)} ms`);
      
      const printResult = await triggerUSBPrint(rasterData);
      
      const printEnd = performance.now();
      console.log(`[Timer] triggerUSBPrint Time: ${(printEnd - renderEnd).toFixed(2)} ms`);
      console.log(`[Timer] Total USB Print Time: ${(printEnd - startTotal).toFixed(2)} ms`);
      console.log('--------------------------------');

      return printResult;
    }

    throw new Error("No suitable printing connection found.");
  };

  return { printDocument };
};
