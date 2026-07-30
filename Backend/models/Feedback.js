import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  foodQuality: {
    type: Number,
    min: 1,
    max: 5
  },
  service: {
    type: Number,
    min: 1,
    max: 5
  },
  ambience: {
    type: Number,
    min: 1,
    max: 5
  },
  comments: {
    type: String,
    trim: true
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  }
}, {
  timestamps: true
});

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ rating: 1 });

export default mongoose.model('Feedback', feedbackSchema);
