import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'payment'], // credit = customer took something on credit (adds to due). payment = customer paid some amount (reduces due).
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  date: {
    type: Date,
    default: Date.now
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill', // Optional link to a specific bill
  },
  note: {
    type: String
  }
});

const creditAccountSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  balance: {
    type: Number, // Total amount the customer owes
    default: 0
  },
  transactions: [transactionSchema]
}, {
  timestamps: true
});

creditAccountSchema.index({ phoneNumber: 1 });

export default mongoose.model('CreditAccount', creditAccountSchema);
