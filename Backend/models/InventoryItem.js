import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: 'Other'
  },
  unit: {
    type: String,
    enum: ['kg', 'g', 'L', 'ml', 'pcs', 'packs'],
    default: 'kg'
  },
  currentStock: {
    type: Number,
    default: 0
  },
  totalPurchased: {
    type: Number,
    default: 0
  },
  totalUsed: {
    type: Number,
    default: 0
  },
  minStockAlert: {
    type: Number,
    default: 5
  },
  unitCost: {
    type: Number,
    default: 0
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model('InventoryItem', inventoryItemSchema);
