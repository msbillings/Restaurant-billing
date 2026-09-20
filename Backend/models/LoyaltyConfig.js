import mongoose from 'mongoose';

const itemBonusRuleSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  bonusPoints: { type: Number, required: true, min: 0 }
}, { _id: false });

const tierSchema = new mongoose.Schema({
  name: { type: String, required: true }, // 'Silver', 'Gold', 'Platinum VIP'
  minVisits: { type: Number, default: 0 },
  minSpend: { type: Number, default: 0 },
  pointMultiplier: { type: Number, default: 1.0 }, // e.g. 1.25x for Gold, 1.5x for Platinum VIP
  perks: { type: String, default: '' },
  color: { type: String, default: '#94a3b8' }
}, { _id: false });

const milestoneRewardSchema = new mongoose.Schema({
  visitNumber: { type: Number, required: true }, // e.g. 5th visit, 10th visit
  rewardPoints: { type: Number, default: 50 },
  rewardDescription: { type: String, default: '' }
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
  // Automatically expire inactive points/wallet balances
  autoExpiryEnabled: {
    type: Boolean,
    default: true
  },
  // Days before expiration to send pre-expiry warning WhatsApp alert (e.g. 7 days before)
  expiryWarningDays: {
    type: Number,
    default: 7
  },
  // Send WhatsApp notification before points expire
  expiryWarningNotify: {
    type: Boolean,
    default: true
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
  },
  // Reelo-grade 3-Tier VIP Club
  tiers: {
    type: [tierSchema],
    default: [
      { name: 'Silver', minVisits: 0, minSpend: 0, pointMultiplier: 1.0, perks: 'Standard 1x Points Earning', color: '#94a3b8' },
      { name: 'Gold', minVisits: 5, minSpend: 5000, pointMultiplier: 1.25, perks: '1.25x Points + Priority Booking', color: '#f59e0b' },
      { name: 'Platinum VIP', minVisits: 15, minSpend: 15000, pointMultiplier: 1.5, perks: '1.5x Points + Complimentary Dessert + Chef Greeting', color: '#10b981' }
    ]
  },
  // Milestone visit rewards
  milestoneRewards: {
    type: [milestoneRewardSchema],
    default: [
      { visitNumber: 5, rewardPoints: 50, rewardDescription: '5th Visit Club Bonus' },
      { visitNumber: 10, rewardPoints: 100, rewardDescription: '10th Milestone Celebration Treat' }
    ]
  },
  // Date string of last completed automatic expiry audit (YYYY-MM-DD)
  lastExpiryAuditDate: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export default mongoose.model('LoyaltyConfig', loyaltyConfigSchema);

