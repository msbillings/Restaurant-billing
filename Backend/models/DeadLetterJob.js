import mongoose from 'mongoose';

const DeadLetterJobSchema = new mongoose.Schema({
  originalQueue: { type: String, required: true },
  originalJobId: { type: String, required: true },
  jobName: { type: String, required: true },
  tenantDb: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  failureReason: { type: String },
  errorClass: { type: String },
  attemptsMade: { type: Number, default: 0 },
  firstFailedAt: { type: Date },
  lastFailedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['FAILED', 'REPLAY_QUEUED', 'REPLAYED', 'BLOCKED'], default: 'FAILED' },
  replayCount: { type: Number, default: 0 },
  maxReplays: { type: Number, default: 3 },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

DeadLetterJobSchema.index({ originalQueue: 1, originalJobId: 1 }, { unique: true });

// Prevent sensitive data leak in DLQ records
export const redactSensitiveData = function(next) {
  if (this.isModified('failureReason')) {
    let sanitizedReason = this.failureReason || '';

    // Targeted redaction for key-value pair secrets
    const regex = /(?:password|secret|token|key|jwt|redis:\/\/[^\s]+|mongodb:\/\/[^\s]+|api[_-]?key)\s*(?:[:=]|is)\s*([^\s]+)/gi;
    sanitizedReason = sanitizedReason.replace(regex, (match, p1) => {
      return match.replace(p1, '***');
    });

    // Scrub inline URIs
    sanitizedReason = sanitizedReason.replace(/redis:\/\/[^@]+@/gi, 'redis://***@');
    sanitizedReason = sanitizedReason.replace(/mongodb(?:\+srv)?:\/\/[^@]+@/gi, 'mongodb://***@');

    this.failureReason = sanitizedReason;
  }

  if (this.isModified('payload')) {
    // Redact sensitive keys if accidentally present
    if (this.payload) {
      const sanitized = JSON.parse(JSON.stringify(this.payload));
      const redact = (obj) => {
        for (const k in obj) {
          if (k.toLowerCase().match(/password|token|secret|key|jwt/)) {
            obj[k] = '[REDACTED]';
          } else if (typeof obj[k] === 'object' && obj[k] !== null) {
            redact(obj[k]);
          }
        }
      };
      redact(sanitized);
      this.payload = sanitized;
    }
  }
  next();
};

DeadLetterJobSchema.pre('save', redactSensitiveData);

export default mongoose.model('DeadLetterJob', DeadLetterJobSchema);
