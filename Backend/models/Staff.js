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
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant', // If applicable, or just a string if they prefer
    index: true
  },
  faceDescriptors: {
    type: [[Number]], // Array of 128-dimensional embeddings
    default: []
  },
  attendance: [{
    date: { type: Date, required: true }, // Start of the day
    clockIn: { type: Date },
    clockOut: { type: Date },
    clockInPhoto: { type: String }, // Base64 image
    clockOutPhoto: { type: String }, // Base64 image
    status: { type: String, enum: ['Present', 'Absent', 'Half-Day', 'Leave'], default: 'Present' },
    confidence: { type: Number } // Added confidence score for face recognition
  }]
}, {
  timestamps: true
});

// Indexes for fast staff lookups and attendance history
staffSchema.index({ status: 1, role: 1 });
staffSchema.index({ 'attendance.date': -1 });

export default mongoose.model('Staff', staffSchema);
