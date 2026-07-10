import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  restaurantName: {
    type: String,
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  // Security Note: Storing plainTextPassword strictly because the Super Admin requested 
  // direct visibility into user passwords to fix mistakes/support clients directly.
  plainTextPassword: {
    type: String,
    required: true
  },
  databaseName: {
    type: String,
    unique: true,
    sparse: true
  },
  licenseKey: {
    type: String,
    default: null
  },
  hardwareId: {
    type: String,
    default: null // Binds to the computer MAC address on first login
  },
  status: {
    type: String,
    enum: ['Active', 'Suspended', 'Expired'],
    default: 'Active'
  },
  features: {
    type: Object,
    default: {
      kds: true,
      inventory: true,
      crm: true,
      staff: true,
      analytics: true,
      daybook: true,
      qrcode: true,
      delivery: true,
      expenses: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Client', clientSchema);
