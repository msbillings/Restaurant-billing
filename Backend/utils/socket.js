import { getTenantDbFromReq } from './notificationHelper.js';

export const emitSocketEvent = (req, eventName, data) => {
  try {
    const io = req?.app?.locals?.io;
    if (io) {
      const tenantDb = getTenantDbFromReq(req);
      if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
        io.to(tenantDb).emit(eventName, data);
        console.log(`[Socket] Broadcasted event "${eventName}" strictly to tenant room: ${tenantDb}`);
      } else {
        console.warn(`[Socket] Blocked global emit for event "${eventName}": No tenant database resolved`);
      }
    }
  } catch (err) {
    console.error('Socket emit error:', err);
  }
};
