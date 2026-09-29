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
  plainTextPassword: {
    type: String
  },
  role: {
    type: String,
    enum: ['SuperAdmin', 'Support', 'Sales', 'Vendor'],
    default: 'SuperAdmin'
  },
  // If role is Vendor, store their company name
  vendorCompanyName: {
    type: String
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
