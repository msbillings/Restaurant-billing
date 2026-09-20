import mongoose from 'mongoose';

const itemBonusRuleSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  bonusPoints: { type: Number, required: true, min: 0 }
}, { _id: false });

const loyaltyConfigSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true
  },
  // 'spend' = points based on ₹ spent | 'item' = points based on items ordered | 'both' = both rules apply
  loyaltyMode: {
    type: String,
    enum: ['spend', 'item', 'both'],
    default: 'spend'
  },
  // Spend-based: Rs X spent = 1 point
  conversionRate: {
    type: Number,
    default: 100
  },
  // 1 point = Rs X in wallet
  redemptionValue: {
    type: Number,
    default: 1
  },
  // Minimum bill amount to qualify for points (0 = all bills qualify)
  minBillAmount: {
    type: Number,
    default: 0
  },
  // Max % of bill total that can be paid via wallet (e.g., 50 = max 50% of bill)
  maxRedemptionPercent: {
    type: Number,
    default: 100
  },
  // Wallet balance expires after X days of inactivity
  walletExpiry: {
    type: Number,
    default: 365
  },
  // Bonus points on first visit
  welcomeBonus: {
    type: Number,
    default: 0
  },
  // Item-based bonus rules: specific items give extra points
  itemBonusRules: {
    type: [itemBonusRuleSchema],
    default: []
  },
  // Send WhatsApp notification when points are earned
  whatsappNotify: {
    type: Boolean,
    default: true
  },
  // Promotional loyalty banner / poster image URL
  loyaltyImageUrl: {
    type: String,
    default: ''
  },
  // Whether to attach the promotional loyalty banner to automatic WhatsApp receipts
  attachImageToReceipt: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('LoyaltyConfig', loyaltyConfigSchema);

