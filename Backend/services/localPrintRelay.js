/**
 * localPrintRelay.js
 * 
 * Runs on the local restaurant server (Admin PC).
 * Connects outbound to the cloud Socket.IO server (Render) and listens for print jobs
 * fired by Captains / Cashiers / Waiters from their mobile devices.
 * 
 * Dispatches the raw ESC/POS buffer directly to the local Wi-Fi thermal printer (e.g. 192.168.1.2:9100)
 * or local USB/Bluetooth printer attached to this machine.
 */
import { io } from 'socket.io-client';
import { sendRawToNetworkPrinter, sendRawToUSBPrinter, generateKOTESCPOSBuffer, generateESCPOSBillReceipt } from './printerService.js';
import { sendRawToBluetoothPrinter } from './usbPrinterService.js';

// Cache recent job IDs to prevent duplicate prints
const recentJobs = new Set();
const cleanOldJobs = () => {
  if (recentJobs.size > 200) recentJobs.clear();
};

export const initLocalPrintRelay = () => {
  // Only activate on local premises, never inside cloud hosting
  const isCloud = !!(process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV);
  if (isCloud) {
    return null;
  }

  const cloudUrl = process.env.CLOUD_SOCKET_URL || process.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'https://msbillings-backend-x9qw.onrender.com';
  console.log(`[LocalPrintRelay] 🔌 Initializing local background print listener connecting to cloud: ${cloudUrl}`);

  const socket = io(cloudUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 15000
  });

  socket.on('connect', () => {
    console.log(`[LocalPrintRelay] ✅ Connected to cloud print queue (Socket ID: ${socket.id})`);
    // Join default and known tenant rooms
    const defaultTenant = process.env.DEFAULT_TENANT_DB || 'mscurechain';
    socket.emit('joinTenant', { tenantDb: defaultTenant });
  });

  socket.on('reconnect', (attempt) => {
    console.log(`[LocalPrintRelay] 🔄 Reconnected to cloud print queue (attempt ${attempt})`);
    const defaultTenant = process.env.DEFAULT_TENANT_DB || 'mscurechain';
    socket.emit('joinTenant', { tenantDb: defaultTenant });
  });

  socket.on('disconnect', (reason) => {
    console.warn(`[LocalPrintRelay] ⚠️ Cloud print queue disconnected: ${reason}`);
  });

  // Handle incoming KOT print jobs relayed from mobile devices
  socket.on('relayPrintKOT', async (job) => {
    if (!job || !job.printer) return;
    
    // Deduplicate jobs
    if (job.jobId) {
      if (recentJobs.has(job.jobId)) return;
      recentJobs.add(job.jobId);
      cleanOldJobs();
    }

    console.log(`[LocalPrintRelay] 🖨️ Received Mobile KOT #${job.kotNumber || 'Ticket'} for printer '${job.printer.name}' (${job.printer.connectionType})`);

    try {
      let buffer;
      if (job.rasterBufferBase64) {
        buffer = Buffer.from(job.rasterBufferBase64, 'base64');
      } else {
        buffer = generateKOTESCPOSBuffer(
          job.bill || {},
          job.items || [],
          job.kotNumber || 'KOT-1',
          job.printer,
          job.queueNumber || '1',
          job.restaurantDetails || {}
        );
      }

      if (job.printer.connectionType === 'network' && job.printer.ipAddress) {
        const port = job.printer.port || 9100;
        await sendRawToNetworkPrinter(job.printer.ipAddress, port, buffer);
        console.log(`[LocalPrintRelay] ✅ Successfully printed KOT #${job.kotNumber} to Wi-Fi printer ${job.printer.ipAddress}:${port}`);
      } else if (job.printer.connectionType === 'usb' && job.printer.usbPort) {
        await sendRawToUSBPrinter(job.printer.usbPort, buffer, job.printer.deviceName || job.printer.name);
        console.log(`[LocalPrintRelay] ✅ Successfully printed KOT #${job.kotNumber} to USB printer on port ${job.printer.usbPort}`);
      } else if (job.printer.connectionType === 'bluetooth') {
        const dest = job.printer.bluetoothAddress || job.printer.deviceName || job.printer.name;
        await sendRawToBluetoothPrinter(dest, buffer);
        console.log(`[LocalPrintRelay] ✅ Successfully printed KOT #${job.kotNumber} to Bluetooth printer ${dest}`);
      }

      // Notify cloud that the local station executed the print job
      if (job.jobId) {
        socket.emit('relayPrintAck', { jobId: job.jobId, success: true, station: 'Admin-Local-PC' });
      }
    } catch (err) {
      console.error(`[LocalPrintRelay] ❌ Failed to print relayed KOT #${job.kotNumber}:`, err.message);
    }
  });

  // Handle incoming Bill receipt print jobs relayed from mobile devices
  socket.on('relayPrintBill', async (job) => {
    if (!job || !job.printer) return;
    
    if (job.jobId) {
      if (recentJobs.has(job.jobId)) return;
      recentJobs.add(job.jobId);
      cleanOldJobs();
    }

    console.log(`[LocalPrintRelay] 🧾 Received Mobile Bill #${job.bill?.billNumber || 'Receipt'} for printer '${job.printer.name}'`);

    try {
      let buffer;
      if (job.rasterBufferBase64) {
        buffer = Buffer.from(job.rasterBufferBase64, 'base64');
      } else {
        buffer = await generateESCPOSBillReceipt(job.bill || {}, job.printer, job.restaurantDetails || {});
      }

      if (job.printer.connectionType === 'network' && job.printer.ipAddress) {
        const port = job.printer.port || 9100;
        await sendRawToNetworkPrinter(job.printer.ipAddress, port, buffer);
        console.log(`[LocalPrintRelay] ✅ Successfully printed Bill to Wi-Fi printer ${job.printer.ipAddress}:${port}`);
      } else if (job.printer.connectionType === 'usb' && job.printer.usbPort) {
        await sendRawToUSBPrinter(job.printer.usbPort, buffer, job.printer.deviceName || job.printer.name);
        console.log(`[LocalPrintRelay] ✅ Successfully printed Bill to USB printer on port ${job.printer.usbPort}`);
      } else if (job.printer.connectionType === 'bluetooth') {
        const dest = job.printer.bluetoothAddress || job.printer.deviceName || job.printer.name;
        await sendRawToBluetoothPrinter(dest, buffer);
        console.log(`[LocalPrintRelay] ✅ Successfully printed Bill to Bluetooth printer ${dest}`);
      }

      if (job.jobId) {
        socket.emit('relayPrintAck', { jobId: job.jobId, success: true, station: 'Admin-Local-PC' });
      }
    } catch (err) {
      console.error(`[LocalPrintRelay] ❌ Failed to print relayed Bill:`, err.message);
    }
  });

  return socket;
};
