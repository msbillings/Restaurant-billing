import PrinterConfigDefault from '../models/PrinterConfig.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { sendRawToNetworkPrinter, generateESCPOSTestReceipt } from '../services/printerService.js';

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
      const buffer = generateESCPOSTestReceipt(config);
      try {
        const result = await sendRawToNetworkPrinter(config.ipAddress, config.port || 9100, buffer);
        return res.status(200).json({ message: `Test receipt printed to ${config.name} (${config.ipAddress})` });
      } catch (err) {
        return res.status(400).json({ message: `Failed to print to ${config.name}: ${err.message}` });
      }
    }

    // Fallback response for non-network printers
    res.status(200).json({ message: `Test command sent to ${config.name} (${config.connectionType})` });
    
  } catch (error) {
    res.status(500).json({ message: 'Error testing printer', error: error.message });
  }
};
