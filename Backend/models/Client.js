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
  plainTextPassword: {
    type: String,
    required: true
  },
  databaseName: {
    type: String,
    unique: true,
    sparse: true
  },
  staffAccounts: {
    type: [
      {
        role: String,
        username: String,
        plainTextPassword: String
      }
    ],
    default: []
  },
  licenseKey: {
    type: String,
    default: null
  },
  hardwareId: {
    type: String,
    default: null
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
  },
  location: {
    city: String,
    region: String,
    country: String,
    lat: Number,
    lon: Number,
    lastUpdated: Date,
    ip: String,
    mapsUrl: String
  }
});

export default mongoose.models.Client || mongoose.model('Client', clientSchema);
