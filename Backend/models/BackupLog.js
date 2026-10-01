import mongoose from 'mongoose';

const backupLogSchema = new mongoose.Schema({
  backupId: {
    type: String,
    required: true,
    unique: true
  },
  tenantId: {
    type: String,
    required: true
  },
  objectKey: {
    type: String,
    required: false
  },
  status: {
    type: String,
    required: true,
    enum: [
      'STARTED',
      'GENERATING',
      'ENCRYPTED',
      'UPLOADING',
      'VERIFIED',
      'COMPLETED',
      'FAILED_GENERATION',
      'FAILED_UPLOAD',
      'FAILED_VERIFICATION'
    ],
    default: 'STARTED'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  size: {
    type: Number // in bytes
  },
  checksum: {
    type: String
  },
  storageProvider: {
    type: String,
    default: 'local'
  },
  failureReason: {
    type: String
  }
});

backupLogSchema.index({ backupId: 1 }, { unique: true });
backupLogSchema.index({ tenantId: 1, createdAt: -1 });
backupLogSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export default mongoose.models.BackupLog || mongoose.model('BackupLog', backupLogSchema);
