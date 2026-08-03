import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  guests: {
    type: Number,
    required: true,
    min: 1
  },
  tableType: {
    type: String, // e.g., 'Indoor', 'Outdoor', 'VIP', 'Any'
    default: 'Any'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'seated', 'cancelled', 'no-show'],
    default: 'pending'
  },
  specialRequests: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

reservationSchema.index({ date: 1 });
reservationSchema.index({ status: 1 });

export default mongoose.model('Reservation', reservationSchema);
