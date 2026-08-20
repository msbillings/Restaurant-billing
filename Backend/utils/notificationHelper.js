import jwt from 'jsonwebtoken';

import { getTenantModel } from './tenantHelper.js';
import { NotificationDefault } from '../models/Notification.js';

/**
 * Utility to reliably extract the tenant database ID from any Express request
 */
export const getTenantDbFromReq = (req) => {
  if (!req) return null;
  if (req.tenantDb && req.tenantDb !== 'undefined' && req.tenantDb !== 'null') return req.tenantDb;
  if (req.user?.db && req.user.db !== 'undefined' && req.user.db !== 'null') return req.user.db;
  if (req.models?.connection?.name && req.models.connection.name !== 'undefined' && req.models.connection.name !== 'null') return req.models.connection.name;
  if (req.headers?.['x-tenant-db'] && req.headers['x-tenant-db'] !== 'undefined' && req.headers['x-tenant-db'] !== 'null') return req.headers['x-tenant-db'];
  if (req.headers?.['x-tenant-id'] && req.headers['x-tenant-id'] !== 'undefined' && req.headers['x-tenant-id'] !== 'null') return req.headers['x-tenant-id'];
  if (req.query?.tenant && req.query.tenant !== 'undefined' && req.query.tenant !== 'null') return req.query.tenant;
  if (req.body?.tenant && req.body.tenant !== 'undefined' && req.body.tenant !== 'null') return req.body.tenant;
  if (req.headers?.authorization) {
    try {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2) {
        const decoded = jwt.decode(parts[1]);
        if (decoded?.db && decoded.db !== 'undefined' && decoded.db !== 'null') return decoded.db;
      }
    } catch (e) {}
  }
  return null;
};

/**
 * Utility to broadcast real-time notifications STRICTLY to tenant-scoped connected clients and save to DB
 */
export const emitNotification = (req, title, message, type = 'info', targetRoles = ['Admin'], data = {}) => {
  try {
    const io = req?.app?.locals?.io;
    const tenantDb = getTenantDbFromReq(req);

    if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
      const notification = {
        id: Date.now() + Math.random().toString(36).substring(7),
        title,
        message,
        time: new Date().toISOString(),
        type, // 'info', 'success', 'warning', 'error'
        targetRoles,
        tenantDb,
        data
      };

      if (io) {
        io.to(tenantDb).emit('new_notification', notification);
        console.log(`[Notification] Broadcasted real-time notification (${title}) strictly to tenant room: ${tenantDb}`);
      }

      // Save to database
      try {
        const NotificationModel = getTenantModel(req, 'Notification', NotificationDefault);
        NotificationModel.create({
          tenantDb,
          type,
          title,
          message,
          targetRoles,
          data
        }).catch(err => console.error('[Notification] Failed to save to DB:', err));
      } catch (dbErr) {
        console.error('[Notification] DB save setup error:', dbErr);
      }
    } else {
      console.warn(`[Notification] Blocked global emit for (${title}): No tenant database resolved`);
    }
  } catch (err) {
    console.error('Notification emit error:', err);
  }
};

/**
 * Utility to broadcast notification dismissal / removal strictly to tenant-scoped connected clients
 */
export const emitDismissNotification = (req, criteria = {}) => {
  try {
    const io = req?.app?.locals?.io;
    if (io) {
      const tenantDb = getTenantDbFromReq(req);
      if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
        io.to(tenantDb).emit('dismiss_notification', {
          ...criteria,
          tenantDb
        });
        console.log(`[Notification] Broadcasted dismiss notification to tenant room ${tenantDb}`, criteria);
      }
    }
  } catch (err) {
    console.error('Notification dismiss emit error:', err);
  }
};
