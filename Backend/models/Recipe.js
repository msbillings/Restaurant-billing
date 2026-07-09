import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu',
    required: true,
    unique: true
  },
  ingredients: [{
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.0001
    }
  }]
}, {
  timestamps: true
});

export default mongoose.model('Recipe', recipeSchema);
