import mongoose from 'mongoose';

const stockLogSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  itemName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Stock-In', 'POS Deduction', 'Wastage/Adjustment', 'Audit', 'Initial Stock', 'Staff Withdrawal'],
    required: true
  },
  quantityChange: {
    type: Number,
    required: true
  },
  finalStock: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    default: 'kg'
  },
  notes: {
    type: String,
    default: ''
  },
  performedBy: {
    type: String,
    default: 'System / Admin'
  }
}, {
  timestamps: true
});

export default mongoose.model('StockLog', stockLogSchema);
