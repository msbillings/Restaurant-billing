import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: ''
  },
  totalVisits: {
    type: Number,
    default: 0
  },
  totalSpend: {
    type: Number,
    default: 0
  },
  lastVisit: {
    type: Date,
    default: Date.now
  },
  isVIP: {
    type: Boolean,
    default: false
  },
  favoriteItems: [{
    itemName: String,
    count: Number
  }],
  points: {
    type: Number,
    default: 0
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  lastOrderType: {
    type: String,
    enum: ['Dine-In', 'Delivery', 'Takeaway', 'Pick Up', ''],
    default: 'Dine-In'
  },
  tier: {
    type: String,
    enum: ['Silver', 'Gold', 'Platinum VIP'],
    default: 'Silver'
  },
  pointsExpiryDate: {
    type: Date,
    default: null
  },
  expiryWarningSent: {
    type: Boolean,
    default: false
  },
  feedbackWhatsAppSent: {
    type: Boolean,
    default: false
  },
  lastWinbackSentDate: {
    type: Date,
    default: null
  },
  redemptionOtp: {
    type: String,
    default: null
  },
  redemptionOtpExpiry: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for fast customer search and leaderboards
customerSchema.index({ lastVisit: -1 });
customerSchema.index({ totalSpend: -1 });

export default mongoose.model('Customer', customerSchema);
