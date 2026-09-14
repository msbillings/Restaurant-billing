import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  offerName: {
    type: String,
    default: ''
  },
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discount',
    default: null
  },
  message: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  targetSegment: {
    type: String,
    enum: ['all', 'vip', 'inactive', 'custom'],
    default: 'all'
  },
  totalRecipients: {
    type: Number,
    default: 0
  },
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'failed', 'in_progress'],
    default: 'completed'
  },
  recipients: [{
    phone: String,
    name: String,
    status: {
      type: String,
      enum: ['delivered', 'failed', 'skipped'],
      default: 'delivered'
    },
    error: String,
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

campaignSchema.index({ sentAt: -1 });

export default mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
