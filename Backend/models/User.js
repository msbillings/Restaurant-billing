import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Admin', 'Manager', 'Cashier', 'Captain', 'Chef'],
    default: 'Cashier'
  },
  activeSessions: [{
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    deviceId: { type: String }, // Optional
    lastActive: { type: Date, default: Date.now }
  }],
  fcmTokens: [{ type: String }] // Store Firebase Cloud Messaging tokens for Push Notifications
}, {
  timestamps: true
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
