import mongoose from 'mongoose';

const globalSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.models.GlobalSettings || mongoose.model('GlobalSettings', globalSettingsSchema);
