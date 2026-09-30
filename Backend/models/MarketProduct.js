import mongoose from 'mongoose';

const marketProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['HARDWARE', 'SOFTWARE', 'SERVICES', 'SUPPLIES'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number, // For showing strike-through discounts
    min: 0
  },
  vendorName: {
    type: String,
    trim: true,
    default: 'Internal' // e.g. Passiflow, Shreyans
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin' // Points to the Vendor user account
  },
  allowedVendors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }],
  supplierPrice: {
    type: Number,
    min: 0
  },
  gstRate: {
    type: Number,
    required: true,
    default: 18
  },
  hsnCode: {
    type: String,
  },
  stockCount: {
    type: Number,
    required: true,
    default: 0
  },
  images: [{
    type: String // URLs to images
  }],
  features: [{
    type: String // Array of bullet points like "High Speed", "Wifi Enabled"
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Note: This schema does NOT have a tenantId because it is a global catalog managed by Super Admin

const MarketProduct = mongoose.model('MarketProduct', marketProductSchema);

export default MarketProduct;
