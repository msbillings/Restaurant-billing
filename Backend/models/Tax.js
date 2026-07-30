import mongoose from 'mongoose';

const taxSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  percentage: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    enum: ['inclusive', 'exclusive'],
    default: 'exclusive'
  }
}, {
  timestamps: true
});

export default mongoose.model('Tax', taxSchema);
