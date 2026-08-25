import mongoose from 'mongoose';

const cameraSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  rtspUrl: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    default: 'Main',
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline',
  },
}, { timestamps: true });

cameraSchema.index({ name: 1 });

const CameraDefault = mongoose.model('Camera', cameraSchema);
export default CameraDefault;
