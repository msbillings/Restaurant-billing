import mongoose from 'mongoose';

const licenseSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  plan: {
    type: String,
    default: 'Yearly'
  },
  validUntil: {
    type: Date,
    required: true
  },
  generatedBy: {
    type: String, // Staff ID or "System"
    default: 'System'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('License', licenseSchema);
