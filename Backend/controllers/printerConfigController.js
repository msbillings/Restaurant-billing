import PrinterConfigDefault from '../models/PrinterConfig.js';
import BillDefault from '../models/Bill.js';
import SettingDefault from '../models/Setting.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { sendRawToNetworkPrinter, sendRawToUSBPrinter, getAvailableUSBAndCOMPorts, scanNetworkThermalPrinters, generateESCPOSTestReceipt, printBillToPrinters, generateKOTESCPOSBuffer } from '../services/printerService.js';
import { checkNetworkConnectivity, scanBluetoothDevices, sendRawToBluetoothPrinter, getPrinterBatteryStatus } from '../services/usbPrinterService.js';
import { emitSocketEvent } from '../utils/socket.js';

// Get all printer configs
export const getPrinterConfigs = async (req, res) => {
  try {
    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    const configs = await PrinterConfig.find();
    res.status(200).json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching printer configs', error: error.message });
  }
};

// Create a new printer config
export const createPrinterConfig = async (req, res) => {
  try {
    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    const newConfig = new PrinterConfig(req.body);
    await newConfig.save();
    res.status(201).json(newConfig);
  } catch (error) {
    res.status(500).json({ message: 'Error creating printer config', error: error.message });
  }
};

// Update a printer config
export const updatePrinterConfig = async (req, res) => {
  try {
    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    const { id } = req.params;
    const updatedConfig = await PrinterConfig.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!updatedConfig) {
      return res.status(404).json({ message: 'Printer config not found' });
    }
    
    res.status(200).json(updatedConfig);
  } catch (error) {
    res.status(500).json({ message: 'Error updating printer config', error: error.message });
  }
};

// Delete a printer config
export const deletePrinterConfig = async (req, res) => {
  try {
    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    const { id } = req.params;
    const deletedConfig = await PrinterConfig.findByIdAndDelete(id);
    
    if (!deletedConfig) {
      return res.status(404).json({ message: 'Printer config not found' });
    }
    
    res.status(200).json({ message: 'Printer config deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting printer config', error: error.message });
  }
};

// Scan and return available USB and COM ports for plug-and-play setup
export const getAvailablePorts = async (req, res) => {
  try {
    const ports = await getAvailableUSBAndCOMPorts();
    res.status(200).json({ success: true, ports });
  } catch (error) {
    console.error('Error in getAvailablePorts controller:', error);
    res.status(500).json({ success: false, message: 'Error scanning printer ports', error: error.message });
  }
};

// Scan and return available network/WiFi thermal printers on local subnet
export const getAvailableNetworkPrinters = async (req, res) => {
  try {
    const targetPort = Number(req.query.port) || 9100;
    const printers = await scanNetworkThermalPrinters(targetPort);
    res.status(200).json({ success: true, printers });
  } catch (error) {
    console.error('Error scanning network printers:', error);
    res.status(500).json({ success: false, message: 'Error scanning network printers', error: error.message });
  }
};

// Check if LAN / WiFi is physically connected on the server machine
export const getNetworkStatus = async (req, res) => {
  try {
    const status = await checkNetworkConnectivity();
    res.status(200).json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error checking network connectivity', error: error.message });
  }
};

// Scan for Bluetooth devices currently paired / connected
export const getBluetoothDevices = async (req, res) => {
  try {
    const result = await scanBluetoothDevices();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error scanning Bluetooth devices:', error);
    res.status(500).json({ success: false, message: 'Error scanning Bluetooth devices', error: error.message });
  }
};

export const getBluetoothBattery = async (req, res) => {
  try {
    const { address } = req.params;
    if (!address) return res.status(400).json({ success: false, message: 'Bluetooth address required' });
    const result = await getPrinterBatteryStatus(address);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error checking battery', error: error.message });
  }
};

// Print test page (Real TCP Socket for Network Printer)
export const testPrinter = async (req, res) => {
  try {
    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    const { id } = req.params;
    const config = await PrinterConfig.findById(id);
    
    if (!config) {
      return res.status(404).json({ message: 'Printer config not found' });
    }
    
    if (config.connectionType === 'network' && config.ipAddress) {
      // Dynamically verify network connectivity right now
      try {
        const netStatus = await checkNetworkConnectivity();
        if (!netStatus || !netStatus.connected) {
          return res.status(400).json({ message: `No network connection! Please check your internet or Wi-Fi connection.` });
        }
      } catch (e) {
        console.warn('Could not verify network state before test:', e);
      }

      const buffer = generateESCPOSTestReceipt(config);
      try {
        const result = await sendRawToNetworkPrinter(config.ipAddress, config.port || 9100, buffer);
        return res.status(200).json({ message: `Test receipt printed to ${config.name} (${config.ipAddress})` });
      } catch (err) {
        return res.status(400).json({ message: `Failed to print to ${config.name}: ${err.message}` });
      }
    }

    if (config.connectionType === 'usb' && config.usbPort) {
      const buffer = generateESCPOSTestReceipt(config);
      try {
        const result = await sendRawToUSBPrinter(config.usbPort, buffer, config.deviceName || config.name);
        const actualPort = result.actualPort || config.usbPort;
        if (actualPort !== config.usbPort) {
          try {
            const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
            await PrinterConfig.findByIdAndUpdate(config._id, { usbPort: actualPort });
          } catch (_) {}
        }
        return res.status(200).json({ message: `Test receipt printed to ${config.name} on USB port ${actualPort}` });
      } catch (err) {
        return res.status(400).json({ message: `Failed to print to ${config.name} on ${config.usbPort}: ${err.message}` });
      }
    }

    if (config.connectionType === 'bluetooth') {
      const targetDest = config.bluetoothAddress || config.deviceName || config.name;
      if (!targetDest) {
        return res.status(400).json({ message: `No Bluetooth address or device name configured for '${config.name}'.` });
      }

      const buffer = generateESCPOSTestReceipt(config);
      try {
        const result = await sendRawToBluetoothPrinter(targetDest, buffer);
        return res.status(200).json({ message: `Test receipt printed to ${config.name} (${targetDest})` });
      } catch (err) {
        console.error(`[BluetoothTestPrint] Error on '${config.name}':`, err.message);
        return res.status(400).json({ message: `Failed to print to Bluetooth printer: ${err.message}` });
      }
    }

    return res.status(400).json({ message: `Unknown or unconfigured printer connection type: ${config.connectionType}` });
    
  } catch (error) {
    res.status(500).json({ message: 'Error testing printer', error: error.message });
  }
};

// Print bill receipt to active network receipt printer(s)
export const printBill = async (req, res) => {
  try {
    const { bill, billId, printerId, rasterBufferBase64 } = req.body;
    let targetBill = bill;

    if (!targetBill && billId) {
      const Bill = getTenantModel(req, 'Bill', BillDefault);
      targetBill = await Bill.findById(billId).lean();
    }

    if (!targetBill) {
      return res.status(400).json({ success: false, message: 'Bill data or billId is required to print receipt.' });
    }

    const result = await printBillToPrinters(req, targetBill, printerId, rasterBufferBase64);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in printBill controller:', error);
    res.status(500).json({ success: false, message: 'Internal error printing bill', error: error.message });
  }
};

// Print KOT to active network KOT / Both printer(s)
export const printKOT = async (req, res) => {
  try {
    const { bill, items, kotNumber, queueNumber, printerId, rasterBufferBase64 } = req.body;
    const targetBill = bill || {};
    const targetItems = (items && items.length > 0) ? items : (targetBill.items || []);
    const targetKotNumber = kotNumber || 'KOT-1';
    const targetQueue = queueNumber || targetBill.tokenNo || targetBill.queueNumber || '1';

    if (!targetItems || targetItems.length === 0) {
      return res.status(400).json({ success: false, message: 'KOT items are required to print KOT.' });
    }

    const PrinterConfig = getTenantModel(req, 'PrinterConfig', PrinterConfigDefault);
    let query = { isActive: true, connectionType: { $in: ['network', 'usb', 'bluetooth'] } };
    if (printerId) {
      query._id = printerId;
    } else {
      query.type = { $in: ['kot', 'general', 'both'] };
    }

    const printers = await PrinterConfig.find(query);
    if (!printers || printers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active Network, USB, or Bluetooth KOT printer configured.'
      });
    }

    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    let dbSettings = {};
    try {
      const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
      if (settingsDoc?.value) {
        dbSettings = typeof settingsDoc.value === 'string' ? JSON.parse(settingsDoc.value) : settingsDoc.value;
      }
    } catch (e) {}
    const restaurantDetails = { ...dbSettings, ...(targetBill.restaurantDetails || {}) };

    const results = [];
    for (const printer of printers) {
      const isUsb = printer.connectionType === 'usb' && printer.usbPort;
      const isNetwork = printer.connectionType === 'network' && printer.ipAddress;
      const isBluetooth = printer.connectionType === 'bluetooth' && (printer.bluetoothAddress || printer.deviceName || printer.name);
      if (!isUsb && !isNetwork && !isBluetooth) continue;

      let buffer;
      if (rasterBufferBase64 && typeof rasterBufferBase64 === 'string') {
        buffer = Buffer.from(rasterBufferBase64, 'base64');
      } else {
        buffer = generateKOTESCPOSBuffer(targetBill, targetItems, targetKotNumber, printer, targetQueue, restaurantDetails);
      }
      const targetDestination = isUsb ? `USB Port: ${printer.usbPort}` : isNetwork ? `${printer.ipAddress}:${printer.port || 9100}` : `Bluetooth: ${printer.bluetoothAddress || printer.deviceName || printer.name}`;
      
      // If running on cloud (Render or Vercel) and printer is on a private local Wi-Fi/LAN IP:
      // The cloud server cannot reach the local LAN IP directly via TCP. Relay the print job via Socket.IO to local station.
      const isPrivateLanIp = isNetwork && /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|localhost)/i.test(printer.ipAddress);
      const isCloudEnv = !!(process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' && !process.env.APP_USER_DATA_PATH));

      if (isNetwork && isPrivateLanIp && isCloudEnv) {
        const relayPayload = {
          jobId: `kot_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          bill: targetBill,
          items: targetItems,
          kotNumber: targetKotNumber,
          queueNumber: targetQueue,
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
        };

        emitSocketEvent(req, 'relayPrintKOT', relayPayload);
        console.log(`[PrinterService] ⚡ Relayed KOT #${targetKotNumber} via Socket.IO to local station for '${printer.name}' (${targetDestination})`);

        results.push({
          printer: printer.name,
          destination: targetDestination,
          success: true,
          relayed: true,
          message: `KOT #${targetKotNumber} sent to ${printer.name} via local Wi-Fi print station`
        });
        continue;
      }

      try {
        if (isUsb) {
          const res = await sendRawToUSBPrinter(printer.usbPort, buffer, printer.deviceName || printer.name);
          if (res.actualPort && res.actualPort !== printer.usbPort) {
            try {
              await PrinterConfig.findByIdAndUpdate(printer._id, { usbPort: res.actualPort });
            } catch (_) {}
            printer.usbPort = res.actualPort;
          }
        } else if (isNetwork) {
          await sendRawToNetworkPrinter(printer.ipAddress, printer.port || 9100, buffer);
        } else if (isBluetooth) {
          await sendRawToBluetoothPrinter(printer.bluetoothAddress || printer.deviceName || printer.name, buffer);
        }
        results.push({
          printer: printer.name,
          destination: targetDestination,
          success: true,
          message: `KOT #${targetKotNumber} printed successfully to ${printer.name} (${targetDestination})`
        });
      } catch (err) {
        console.error(`[PrinterService] KOT print error on '${printer.name}' (${targetDestination}):`, err.message);

        // Fallback: If direct send failed on local station, relay via socket in case another station is connected to printer
        if (isNetwork) {
          try {
            emitSocketEvent(req, 'relayPrintKOT', {
              jobId: `kot_fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              bill: targetBill,
              items: targetItems,
              kotNumber: targetKotNumber,
              queueNumber: targetQueue,
              printer,
              rasterBufferBase64: (buffer ? buffer.toString('base64') : null),
              restaurantDetails
            });
            results.push({
              printer: printer.name,
              destination: targetDestination,
              success: true,
              relayed: true,
              message: `KOT #${targetKotNumber} relayed to Wi-Fi network print station`
            });
            continue;
          } catch (_) {}
        }

        results.push({
          printer: printer.name,
          destination: targetDestination,
          success: false,
          message: `Failed to print KOT to ${printer.name} (${targetDestination}): ${err.message}`
        });
      }
    }

    const anySuccess = results.some(r => r.success);
    return res.status(anySuccess ? 200 : 400).json({
      success: anySuccess,
      results,
      message: anySuccess
        ? results.filter(r => r.success).map(r => r.message).join(', ')
        : results.map(r => r.message).join('; ')
    });
  } catch (error) {
    console.error('Error in printKOT controller:', error);
    res.status(500).json({ success: false, message: 'Internal error printing KOT', error: error.message });
  }
};

