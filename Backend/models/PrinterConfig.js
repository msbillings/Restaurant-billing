import mongoose from 'mongoose';

const printerConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['receipt', 'kot', 'general'],
    required: true
  },
  assignTo: {
    type: String, // e.g. "Kitchen", "Bar", "Pantry"
    trim: true
  },
  ipAddress: {
    type: String,
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
