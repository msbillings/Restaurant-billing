import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['SuperAdmin', 'Support', 'Sales'],
    default: 'SuperAdmin'
  },
  // WebAuthn Passkey Credentials
  passkeys: [{
    credentialID: String,
    credentialPublicKey: String,
    counter: Number,
    transports: [String]
  }],
  currentChallenge: String
}, { timestamps: true });

export default mongoose.model('Admin', adminSchema);
