/**
 * Utility to broadcast real-time notifications to connected clients via Socket.io
 */

export const emitNotification = (req, title, message, type = 'info', targetRoles = ['Admin']) => {
  try {
    const io = req.app?.locals?.io;
    if (io) {
      const notification = {
        id: Date.now() + Math.random().toString(36).substring(7),
        title,
        message,
        time: new Date().toISOString(),
        type, // 'info', 'success', 'warning', 'error'
        targetRoles
      };

      const tenantDb = req.models?.connection?.name || req.headers['x-tenant-db'];
      if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
        io.to(tenantDb).emit('new_notification', notification);
        console.log(`[Notification] Broadcasted to tenant ${tenantDb}: ${title}`);
      } else {
        io.emit('new_notification', notification);
      }
    }
  } catch (err) {
    console.error('Notification emit error:', err);
  }
};
