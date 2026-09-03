import mongoose from 'mongoose';

const whatsappAuthSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  data: { type: String, required: true }
});

export default mongoose.models.WhatsAppAuth || mongoose.model('WhatsAppAuth', whatsappAuthSchema);
