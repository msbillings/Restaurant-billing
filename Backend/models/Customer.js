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
  }
}, {
  timestamps: true
});

// Indexes for fast customer search and leaderboards
customerSchema.index({ phone: 1 });
customerSchema.index({ lastVisit: -1 });
customerSchema.index({ totalSpend: -1 });

export default mongoose.model('Customer', customerSchema);
