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
  }]
}, {
  timestamps: true
});

export default mongoose.model('Customer', customerSchema);
