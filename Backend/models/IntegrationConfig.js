import mongoose from 'mongoose';

const integrationConfigSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming User represents the tenant/restaurant
    required: true,
    index: true
  },
  integrationType: {
    type: String,
    enum: ['ZOMATO', 'SWIGGY', 'PETPOOJA', 'TALLY', 'ZOHO', 'WHATSAPP'],
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'PENDING_SETUP'],
    default: 'PENDING_SETUP'
  },
  credentials: {
    // We will encrypt these values in Phase 2
    apiKey: { type: String },
    storeId: { type: String },
    apiSecret: { type: String }
  },
  syncSettings: {
    autoAcceptOrders: { type: Boolean, default: false },
    syncInventory: { type: Boolean, default: false },
    syncMenu: { type: Boolean, default: false }
  },
  lastSync: {
    type: Date
  }
}, {
  timestamps: true
});

// Ensure a tenant can only have one configuration per integration type
integrationConfigSchema.index({ tenantId: 1, integrationType: 1 }, { unique: true });

const IntegrationConfig = mongoose.model('IntegrationConfig', integrationConfigSchema);

export default IntegrationConfig;
