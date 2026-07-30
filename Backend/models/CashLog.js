import mongoose from 'mongoose';

const cashLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['withdrawal', 'topup'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  reason: {
    type: String,
    required: true
  },
  performedBy: {
    type: String,
    required: true,
    default: 'Admin' // In a real app, this would be tied to the logged-in user
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

cashLogSchema.index({ date: -1 });
cashLogSchema.index({ type: 1, date: -1 });

export default mongoose.model('CashLog', cashLogSchema);
