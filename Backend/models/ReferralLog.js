import mongoose from 'mongoose';

const referralLogSchema = new mongoose.Schema({
  referrerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client', 
    required: true 
  },
  refereeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client', 
    required: true 
  },
  referrerRewardDays: { 
    type: Number, 
    required: true 
  },
  refereeRewardDays: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Completed', 'Revoked'], 
    default: 'Completed' 
  }
}, { timestamps: true });

// Prevent duplicate referrals (a referee can only be referred once)
referralLogSchema.index({ refereeId: 1 }, { unique: true });

export default mongoose.models.ReferralLog || mongoose.model('ReferralLog', referralLogSchema);
