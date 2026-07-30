import mongoose from 'mongoose';

const onlineConfigSchema = new mongoose.Schema({
  isOnlineEnabled: {
    type: Boolean,
    default: false
  },
  domainName: {
    type: String,
    trim: true,
    default: ''
  },
  minOrderValue: {
    type: Number,
    default: 0
  },
  deliveryRadiusKm: {
    type: Number,
    default: 5
  },
  prepTimeMinutes: {
    type: Number,
    default: 30
  },
  contactPhone: {
    type: String,
    trim: true,
    default: ''
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  storeStatus: {
    type: String,
    enum: ['open', 'closed', 'busy'],
    default: 'open'
  }
}, {
  timestamps: true
});

export default mongoose.model('OnlineConfig', onlineConfigSchema);
