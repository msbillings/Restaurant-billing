import mongoose from 'mongoose';

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  tableNo: {
    type: String,
    required: true
  },
  items: [{
    name: String,
    price: { type: Number, min: [0, 'Price cannot be negative'] },
    quantity: { type: Number, min: [0, 'Quantity cannot be negative'] },
    printedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Printed quantity cannot be negative']
    },
    hsnCode: { type: String },
    total: { type: Number, min: [0, 'Total cannot be negative'] }
  }],
  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  taxBreakdown: {
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 }
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'flat'],
    default: 'flat'
  },
  discountValue: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0,
    min: [0, 'Total cannot be negative']
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Mixed']
  },
  splitPayments: {
    cash: { type: Number, default: 0, min: [0, 'Cash cannot be negative'] },
    upi: { type: Number, default: 0, min: [0, 'UPI cannot be negative'] },
    card: { type: Number, default: 0, min: [0, 'Card cannot be negative'] }
  },
  upiApp: {
    type: String,
    enum: ['PhonePe', 'GPay', 'Paytm', 'Amazon Pay', 'BharatPe', 'Other']
  },
  status: {
    type: String,
    enum: ['Open', 'Billed', 'Paid', 'Cancelled', 'Deleted', 'Refunded'],
    default: 'Open'
  },
  cancelReason: {
    type: String
  },
  customerPhone: { type: String },
  customerName: { type: String },
  billType: {
    type: String,
    enum: ['Dine-In', 'Takeaway', 'Delivery'],
    default: 'Dine-In'
  },
  orderSource: {
    type: String,
    enum: ['Direct', 'Swiggy', 'Zomato', 'Other']
    // No default - only set for Delivery orders
  },
  customerName: String,
  customerPhone: String,
  deliveryAddress: String,
  deliveryInstructions: String,
  deliveryStatus: {
    type: String,
    enum: ['Pending', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  deliveryTime: Date,
  platformOrderId: String, // For Swiggy/Zomato order IDs
  platformCommission: {
    type: Number,
    default: 0,
    min: [0, 'Commission cannot be negative']
  },
  packagingCharges: {
    type: Number,
    default: 0,
    min: [0, 'Packaging charges cannot be negative']
  },
  kitchenNotes: String,
  kots: [{
    kotNumber: String,
    items: [{
      name: String,
      quantity: Number,
      status: {
        type: String,
        enum: ['Pending', 'Preparing', 'Ready'],
        default: 'Pending'
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    editedAt: {
      type: Date,
      default: Date.now
    },
    previousState: {
      items: [{
        name: String,
        quantity: Number,
        price: Number,
        total: Number
      }],
      subtotal: Number,
      totalDiscount: Number,
      totalTax: Number,
      total: Number
    },
    newState: {
      items: [{
        name: String,
        quantity: Number,
        price: Number,
        total: Number
      }],
      subtotal: Number,
      totalDiscount: Number,
      totalTax: Number,
      total: Number
    }
  }]
}, {
  timestamps: true
});

// Add indexes for performance optimization (critical for 150+ orders/day)
billSchema.index({ status: 1, createdAt: -1 }); // For getBills and getOpenOrders
billSchema.index({ tableNo: 1, status: 1 }); // For getActiveOrder
billSchema.index({ createdAt: -1, status: 1 }); // For analytics queries
billSchema.index({ paymentMode: 1, createdAt: -1 }); // For payment method analytics
billSchema.index({ billType: 1, createdAt: -1 }); // For bill type filtering
billSchema.index({ orderSource: 1, createdAt: -1 }); // For delivery platform analytics
billSchema.index({ deliveryStatus: 1, createdAt: -1 }); // For delivery status tracking

export default mongoose.model('Bill', billSchema);
