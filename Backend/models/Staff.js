import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['Waiter', 'Chef', 'Manager', 'Cleaner', 'Other'],
    default: 'Waiter'
  },
  phone: {
    type: String,
    trim: true
  },
  pin: {
    type: String, // 4-digit PIN for clock-in/out
    required: true
  },
  baseSalary: {
    type: Number,
    default: 0
  },
  salaryType: {
    type: String,
    enum: ['Monthly', 'Hourly', 'Daily'],
    default: 'Monthly'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  faceDescriptor: {
    type: [Number],
    default: []
  },
  attendance: [{
    date: { type: Date, required: true }, // Start of the day
    clockIn: { type: Date },
    clockOut: { type: Date },
    clockInPhoto: { type: String }, // Base64 image
    clockOutPhoto: { type: String }, // Base64 image
    status: { type: String, enum: ['Present', 'Absent', 'Half-Day', 'Leave'], default: 'Present' }
  }]
}, {
  timestamps: true
});

export default mongoose.model('Staff', staffSchema);
