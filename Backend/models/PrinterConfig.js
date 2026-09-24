import mongoose from 'mongoose';

const printerConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['receipt', 'kot', 'general', 'both'],
    required: true
  },
  assignTo: {
    type: String, // e.g. "Kitchen 1", "Bar", "Pantry"
    trim: true
  },
  location: {
    type: String, // e.g. "Ground Floor", "First Floor"
    trim: true
  },
  assignmentMode: {
    type: String,
    enum: ['category', 'item'],
    default: 'category'
  },
  assignedCategories: [{
    type: String,
    trim: true
  }],
  assignedItems: [{
    type: String,
    trim: true
  }],
  ipAddress: {
    type: String,
    trim: true
  },
  bluetoothAddress: {
    type: String,
    trim: true
  },
  deviceName: {
    type: String,
    trim: true
  },
  usbPort: {
    type: String, // e.g. "USB009", "USB001", "COM3"
    trim: true
  },
  port: {
    type: Number,
    default: 9100
  },
  connectionType: {
    type: String,
    enum: ['usb', 'network', 'bluetooth'],
    default: 'network'
  },
  paperWidth: {
    type: String,
    enum: ['58mm', '80mm'],
    default: '80mm'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  silentPrinting: {
    type: Boolean,
    default: true
  },
  // KOT specific options
  autoPrintKOT: {
    type: Boolean,
    default: true
  },
  // Receipt specific options
  printHeader: {
    type: String,
    trim: true
  },
  printFooter: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model('PrinterConfig', printerConfigSchema);
