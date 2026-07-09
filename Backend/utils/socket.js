export const emitSocketEvent = (req, eventName, data) => {
  try {
    const io = req.app?.locals?.io;
    if (io) {
      const tenantDb = req.models?.connection?.name || req.headers['x-tenant-db'];
      if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
        io.to(tenantDb).emit(eventName, data);
      } else {
        io.emit(eventName, data);
      }
    }
  } catch (err) {
    console.error('Socket emit error:', err);
  }
};
