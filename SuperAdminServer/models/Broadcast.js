import mongoose from 'mongoose';

const broadcastSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  fileUrl: {
    type: String
  },
  fileType: {
    type: String // e.g., 'image', 'apk', 'ipa', 'document'
  },
  targetClients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  }],
  targetRoles: [{
    type: String // 'Admin', 'Cashier', 'Captain', etc. If empty, all roles.
  }],
  allowReplies: {
    type: Boolean,
    default: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Broadcast = mongoose.model('Broadcast', broadcastSchema);
export default Broadcast;
