import mongoose from 'mongoose';

const broadcastReplySchema = new mongoose.Schema({
  broadcastId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broadcast',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  shopName: {
    type: String,
    required: true
  },
  senderUsername: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const BroadcastReply = mongoose.model('BroadcastReply', broadcastReplySchema);
export default BroadcastReply;
