import mongoose from 'mongoose';

const pushOrderItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  specialInstructions: {
    type: String
  }
});

const pushOrderSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['Zomato', 'Swiggy', 'UberEats', 'Direct', 'Other'],
    required: true
  },
  platformOrderId: {
    type: String,
    required: true,
    unique: true
  },
  customerDetails: {
    name: String,
    phone: String,
    address: String
  },
  items: [pushOrderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'accepted', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled'],
    default: 'new'
  },
  paymentStatus: {
    type: String,
    enum: ['paid_online', 'cod'],
    required: true
  }
}, {
  timestamps: true
});

pushOrderSchema.index({ status: 1 });

export default mongoose.model('PushOrder', pushOrderSchema);

