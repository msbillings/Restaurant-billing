import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reportId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  tenantDb: { 
    type: String, 
    required: true, 
    index: true 
  },
  filePath: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['generating', 'ready', 'expired'],
    default: 'generating'
  },
  filename: {
    type: String,
    required: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 86400 // Automatically delete document after 24 hours (86400 seconds)
  }
});

// Use global compilation so we can fetch it across the system. 
// Since reports are a system-level resource spanning tenants, we store them in the primary DB (default connection), 
// but strictly associate them via the tenantDb field.
export default mongoose.models.Report || mongoose.model('Report', reportSchema);
