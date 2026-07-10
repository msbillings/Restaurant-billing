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
  attendance: [{
    date: { type: Date, required: true }, // Start of the day
    clockIn: { type: Date },
    clockOut: { type: Date },
    status: { type: String, enum: ['Present', 'Absent', 'Half-Day', 'Leave'], default: 'Present' }
  }]
}, {
  timestamps: true
});

export default mongoose.model('Staff', staffSchema);
