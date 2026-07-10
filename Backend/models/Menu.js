import mongoose from 'mongoose';

const menuSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  type: {
    type: String,
    enum: ['veg', 'non-veg'],
    default: 'veg'
  },
  description: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    trim: true,
    default: ''
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0
  },
  hsnCode: {
    type: String,
    trim: true,
    default: ''
  },
  variants: [{
    name: String, // e.g. "Half", "Full"
    price: Number
  }],
  modifiers: [{
    name: String, // e.g. "Extra Cheese"
    price: Number // e.g. 20
  }],
  recipe: [{
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true
    },
    quantityRequired: {
      type: Number,
      required: true,
      min: 0
    }
  }]
}, {
  timestamps: true
});

// Add indexes for better performance
menuSchema.index({ isAvailable: 1 });
menuSchema.index({ category: 1 });
menuSchema.index({ name: 1 });
menuSchema.index({ isAvailable: 1, category: 1 });

export default mongoose.model('Menu', menuSchema);
