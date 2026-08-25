import { getTenantDbFromReq } from './notificationHelper.js';

export const emitSocketEvent = (req, eventName, data) => {
  try {
    const io = req?.app?.locals?.io;
    if (io) {
      const tenantDb = getTenantDbFromReq(req);
      if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
        io.to(tenantDb).emit(eventName, { ...data, tenantDb });
        console.log(`[Socket] ⚡ Broadcasted event "${eventName}" to tenant: ${tenantDb}`);
      } else {
        io.emit(eventName, data);
        console.log(`[Socket] Broadcasted event "${eventName}" globally`);
      }
    }
  } catch (err) {
    console.error('Socket emit error:', err);
  }
};
