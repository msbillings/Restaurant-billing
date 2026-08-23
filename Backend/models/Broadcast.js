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
    type: String
  },
  targetClients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  }],
  targetRoles: [{
    type: String
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

export default mongoose.models.Broadcast || mongoose.model('Broadcast', broadcastSchema);
