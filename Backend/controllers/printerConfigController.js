import PrinterConfig from '../models/PrinterConfig.js';

// Get all printer configs
export const getPrinterConfigs = async (req, res) => {
  try {
    const configs = await PrinterConfig.find();
    res.status(200).json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching printer configs', error: error.message });
  }
};

// Create a new printer config
export const createPrinterConfig = async (req, res) => {
  try {
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

// Print test page (Mock)
export const testPrinter = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await PrinterConfig.findById(id);
    
    if (!config) {
      return res.status(404).json({ message: 'Printer config not found' });
    }
    
    // In a real scenario, this would send an ESC/POS command to the printer IP
    console.log(`[Printer] Simulating test print to ${config.type} printer at ${config.ipAddress || 'USB'}`);
    
    // Simulate slight delay to mimic network request
    setTimeout(() => {
      res.status(200).json({ message: 'Test page sent to printer successfully' });
    }, 1000);
    
  } catch (error) {
    res.status(500).json({ message: 'Error testing printer', error: error.message });
  }
};
