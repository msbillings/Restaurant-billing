import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  tenantDb: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  targetRoles: [{
    type: String
  }],
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // TTL index: automatically delete documents 24 hours (86400 seconds) after createdAt
    expires: 86400
  }
});

// Since tenants have their own DB connections in this architecture, 
// the model will be compiled dynamically per tenant using getTenantModel
export const NotificationDefault = mongoose.model('Notification', NotificationSchema);
export default NotificationSchema;
