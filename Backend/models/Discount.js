import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['percentage', 'flat', 'bogo'],
    required: true
  },
  value: {
    type: Number,
    min: 0,
    default: 0
  },
  buyQty: {
    type: Number,
    min: 1,
    default: 2
  },
  getQty: {
    type: Number,
    min: 1,
    default: 1
  },
  applicableTo: {
    type: String,
    enum: ['all', 'category', 'items'],
    default: 'all'
  },
  targetCategory: {
    type: String,
    default: ''
  },
  targetItems: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  hasTimeline: {
    type: Boolean,
    default: false
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  startTime: {
    type: String,
    default: '00:00'
  },
  endTime: {
    type: String,
    default: '23:59'
  },
  validityDays: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('Discount', discountSchema);
