import mongoose from 'mongoose';

const spaceItemSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Keep existing string IDs for backward compatibility initially
  name: { type: String, required: true },
  type: { type: String, enum: ['table', 'cabin', 'sofa'], required: true },
  status: { type: String, enum: ['Available', 'Occupied', 'Billed', 'Reserved'], default: 'Available' },
  currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null } // Link to active order
});

const floorSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Keep existing string IDs for backward compatibility
  name: { type: String, required: true },
  tables: [spaceItemSchema],
  cabins: [spaceItemSchema],
  sofas: [spaceItemSchema]
}, { timestamps: true });

// We export the model so it can be dynamically compiled per-tenant
export default mongoose.model('Floor', floorSchema);
