import mongoose from 'mongoose';

const whatsappAuthSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  data: { type: String, required: true }
}, { timestamps: true });

// High-Speed Indexes for Query Optimization
whatsappAuthSchema.index({ createdAt: -1 });
whatsappAuthSchema.index({ updatedAt: -1 });

export default mongoose.models.WhatsAppAuth || mongoose.model('WhatsAppAuth', whatsappAuthSchema);
