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
