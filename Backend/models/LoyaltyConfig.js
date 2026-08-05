import mongoose from 'mongoose';

const loyaltyConfigSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true
  },
  conversionRate: {
    type: Number,
    default: 100 // e.g., 100 Rs = 1 point
  },
  redemptionValue: {
    type: Number,
    default: 1 // e.g., 1 point = 1 Rs
  },
  walletExpiry: {
    type: Number,
    default: 365 // days
  }
}, {
  timestamps: true
});

export default mongoose.model('LoyaltyConfig', loyaltyConfigSchema);
