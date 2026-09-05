import mongoose from 'mongoose';

const calculationHistorySchema = new mongoose.Schema({
  expression: {
    type: String,
    required: true,
    trim: true
  },
  result: {
    type: String,
    required: true,
    trim: true
  },
  details: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 172800 // 48 hours (2 days) TTL index in MongoDB
  }
}, {
  timestamps: true
});

const CalculationHistory = mongoose.model('CalculationHistory', calculationHistorySchema);
export default CalculationHistory;
