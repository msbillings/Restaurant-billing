import mongoose from 'mongoose';

const serviceRequestSchema = new mongoose.Schema({
  tableNumber: {
    type: String,
    required: true
  },
  requestType: {
    type: String,
    enum: ['Call Waiter', 'Need Water', 'Pay the Bill'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Resolved'],
    default: 'Pending'
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Auto-delete documents older than 2 days (172800 seconds)
serviceRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

export default mongoose.model('ServiceRequest', serviceRequestSchema);
