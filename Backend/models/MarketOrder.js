import mongoose from 'mongoose';

const marketOrderSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client', // Or whatever model represents the restaurant
    required: true
  },
  restaurantName: {
    type: String,
    required: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MarketProduct',
        required: true
      },
      name: String,
      price: Number,
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      category: String
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  gstAmount: {
    type: Number,
    required: true
  },
  grandTotal: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  trackingHistory: [{
    status: String,
    location: String,
    date: Date,
    note: String
  }],
  trackingId: {
    type: String
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin' // If a specific vendor needs to fulfill this
  },
  shippingProofImages: [{
    type: String // URLs uploaded by vendor
  }],
  deliveryETA: {
    type: Date
  },
  invoiceUrl: {
    type: String
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    contactNumber: String
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['Credit Card', 'UPI', 'Bank Transfer', 'Loan'], // Loan for future Fintech integration
    default: 'UPI'
  }
}, { timestamps: true });

export default mongoose.model('MarketOrder', marketOrderSchema);
