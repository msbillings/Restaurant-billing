import mongoose from 'mongoose';

const tenantMetrics = new Map();

export const recordMetrics = (tenantDb, reqSize, resSize, latency = 0, isError = false) => {
  if (!tenantDb || tenantDb === 'undefined' || tenantDb === 'null') return;
  
  if (!tenantMetrics.has(tenantDb)) {
    tenantMetrics.set(tenantDb, { requests: 0, reqBytes: 0, resBytes: 0, errors: 0, totalLatency: 0, lastActive: Date.now() });
  }
  const metrics = tenantMetrics.get(tenantDb);
  metrics.requests++;
  metrics.reqBytes += (reqSize || 0);
  metrics.resBytes += (resSize || 0);
  if (isError) metrics.errors++;
  metrics.totalLatency += latency;
  metrics.lastActive = Date.now();
};

export const startMetricsIngester = (io) => {
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return; // Wait for DB
    
    // Write global system metrics
    try {
      const activeSockets = io && io.engine ? io.engine.clientsCount : 0;
      await mongoose.connection.db.collection('system_metrics').updateOne(
        { _id: 'global' },
        { $set: { activeSockets, lastUpdated: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      console.error('Metrics Ingester Error (Global):', e.message);
    }

    if (tenantMetrics.size === 0) return;

    const metricsToFlush = new Map(tenantMetrics);
    tenantMetrics.clear(); // Reset for next window

    try {
      const collection = mongoose.connection.db.collection('clients');
      
      const bulkOps = [];
      const now = new Date();
      
      // Update each tenant's stats
      for (const [tenantDb, metrics] of metricsToFlush.entries()) {
        bulkOps.push({
          updateOne: {
            filter: { databaseName: tenantDb },
            update: {
              $inc: {
                'realtimeMetrics.totalRequests': metrics.requests,
                'realtimeMetrics.totalReqBytes': metrics.reqBytes,
                'realtimeMetrics.totalResBytes': metrics.resBytes,
                'realtimeMetrics.totalErrors': metrics.errors,
                'realtimeMetrics.totalLatency': metrics.totalLatency,
                'realtimeMetrics.currentWindowRequests': metrics.requests, // for RPM calculation
                'realtimeMetrics.currentWindowReqBytes': metrics.reqBytes,
                'realtimeMetrics.currentWindowResBytes': metrics.resBytes,
                'realtimeMetrics.currentWindowErrors': metrics.errors,
                'realtimeMetrics.currentWindowLatency': metrics.totalLatency,
              },
              $set: {
                'realtimeMetrics.lastActive': new Date(metrics.lastActive),
                'realtimeMetrics.lastUpdate': now
              }
            } // no upsert to avoid creating bad records if db name doesn't match client
          }
        });
      }

      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
      }

    } catch (err) {
      console.error('[MetricsCollector] Error flushing metrics:', err.message);
      // Restore failed metrics to retry next time
      for (const [tenantDb, metrics] of metricsToFlush.entries()) {
        if (!tenantMetrics.has(tenantDb)) {
          tenantMetrics.set(tenantDb, metrics);
        } else {
          const current = tenantMetrics.get(tenantDb);
          current.requests += metrics.requests;
          current.reqBytes += metrics.reqBytes;
          current.resBytes += metrics.resBytes;
          current.errors += metrics.errors;
          current.totalLatency += metrics.totalLatency;
          current.lastActive = Math.max(current.lastActive, metrics.lastActive);
        }
      }
    }
  }, 10000); // Flush every 10 seconds

  // A separate job to reset the "currentWindow" fields every minute to calculate RPM
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const collection = mongoose.connection.db.collection('clients');
      
      // Move currentWindow to lastMinute, then reset currentWindow
      const allClients = await collection.find({ "realtimeMetrics": { $exists: true } }).toArray();
      const bulkOps = allClients.map(c => ({
        updateOne: {
          filter: { _id: c._id },
          update: {
            $set: {
              'realtimeMetrics.lastMinuteRequests': c.realtimeMetrics?.currentWindowRequests || 0,
              'realtimeMetrics.lastMinuteReqBytes': c.realtimeMetrics?.currentWindowReqBytes || 0,
              'realtimeMetrics.lastMinuteResBytes': c.realtimeMetrics?.currentWindowResBytes || 0,
              'realtimeMetrics.lastMinuteErrors': c.realtimeMetrics?.currentWindowErrors || 0,
              'realtimeMetrics.lastMinuteLatency': c.realtimeMetrics?.currentWindowLatency || 0,
              'realtimeMetrics.currentWindowRequests': 0,
              'realtimeMetrics.currentWindowReqBytes': 0,
              'realtimeMetrics.currentWindowResBytes': 0,
              'realtimeMetrics.currentWindowErrors': 0,
              'realtimeMetrics.currentWindowLatency': 0
            }
          }
        }
      }));

      if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
      }
    } catch (err) {
      console.error('[MetricsCollector] Error resetting minute window:', err.message);
    }
  }, 60000); // Run every minute
};
