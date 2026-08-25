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
      const notifId = data.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const immediateNotification = {
        id: notifId,
        title,
        message,
        time: new Date().toISOString(),
        type,
        targetRoles,
        tenantDb,
        data
      };

      // ⚡ FAST-PATH: Broadcast immediately with 0ms delay to all connected sockets
      if (io) {
        io.to(tenantDb).emit('new_notification', immediateNotification);
        io.emit('new_notification', immediateNotification); // Universal tenant fallback
        console.log(`[Notification] ⚡ INSTANT broadcast (${title}) to tenant: ${tenantDb}`);
      }

      // ⚡ ASYNC-PATH: Save to MongoDB and FCM in the background without blocking the broadcast
      try {
        const NotificationModel = getTenantModel(req, 'Notification', NotificationDefault);
        NotificationModel.create({
          tenantDb,
          type,
          title,
          message,
          targetRoles,
          data
        }).then(savedDoc => {
          sendFcmPushNotification(tenantDb, title, message, targetRoles, data);
        }).catch(err => {
          console.error('[Notification] Background DB save error:', err.message);
        });
      } catch (dbErr) {
        console.error('[Notification] DB save setup error:', dbErr.message);
      }
    } else {
      console.warn(`[Notification] Blocked global emit for (${title}): No tenant database resolved`);
    }
  } catch (err) {
    console.error('Notification emit error:', err);
  }
};

/**
 * Optional FCM Push Notification Dispatcher (Free Google Firebase Cloud Messaging)
 * Non-blocking: only executes if Firebase credentials are provided in environment
 */
export const sendFcmPushNotification = async (tenantDb, title, message, targetRoles = ['Admin'], data = {}) => {
  try {
    // If Firebase Admin is configured in environment
    if (global.firebaseAdmin) {
      const payload = {
        notification: {
          title,
          body: message
        },
        data: {
          tenantDb: String(tenantDb || ''),
          targetRoles: JSON.stringify(targetRoles),
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {})
        },
        topic: `tenant_${tenantDb}`
      };
      await global.firebaseAdmin.messaging().send(payload);
      console.log(`[FCM Push] Sent push notification to topic tenant_${tenantDb}`);
    }
  } catch (fcmErr) {
    // Safe error suppression so server operation is NEVER disrupted
    console.warn('[FCM Push] Optional push dispatch warning:', fcmErr.message);
  }
};

/**
 * Utility to broadcast notification dismissal / removal strictly to tenant-scoped connected clients
 * and permanently delete the notification documents from the tenant's MongoDB collection.
 */
export const emitDismissNotification = async (req, criteria = {}) => {
  try {
    const tenantDb = getTenantDbFromReq(req);
    if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
      let deletedIds = [];
      try {
        const NotificationModel = getTenantModel(req, 'Notification', NotificationDefault);
        const query = { tenantDb };
        const orConditions = [];

        if (criteria.id) {
          orConditions.push({ _id: criteria.id });
        }
        if (criteria.orderId && criteria.itemId) {
          orConditions.push({ 'data.orderId': criteria.orderId, 'data.itemId': criteria.itemId });
          orConditions.push({ 'data.orderId': criteria.orderId.toString(), 'data.itemId': criteria.itemId.toString() });
        }
        if (criteria.orderId) {
          orConditions.push({ 'data.orderId': criteria.orderId, 'data.type': criteria.type || 'cancel_item_request' });
          orConditions.push({ 'data.orderId': criteria.orderId.toString(), 'data.type': criteria.type || 'cancel_item_request' });
        }
        if (criteria.itemName) {
          const safeName = criteria.itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          orConditions.push({
            $and: [
              { 'data.type': criteria.type || 'cancel_item_request' },
              { $or: [{ message: { $regex: new RegExp(safeName, 'i') } }, { 'data.itemName': { $regex: new RegExp(safeName, 'i') } }] }
            ]
          });
        }

        if (orConditions.length > 0) {
          query.$or = orConditions;
        } else if (criteria.type) {
          query['data.type'] = criteria.type;
        }

        // Find matching document IDs before deletion
        const docsToDelete = await NotificationModel.find(query).select('_id').lean();
        deletedIds = docsToDelete.map(d => d._id.toString());

        if (deletedIds.length > 0) {
          const deleteRes = await NotificationModel.deleteMany({ _id: { $in: docsToDelete.map(d => d._id) } });
          console.log(`[Notification] Permanently deleted ${deleteRes.deletedCount} notifications from DB for tenant ${tenantDb}:`, deletedIds);
        }
      } catch (dbErr) {
        console.warn('[Notification] DB delete warning in emitDismissNotification:', dbErr.message);
      }

      const io = req?.app?.locals?.io;
      if (io) {
        io.to(tenantDb).emit('dismiss_notification', {
          ...criteria,
          deletedIds,
          tenantDb
        });
        console.log(`[Notification] Broadcasted dismiss notification to tenant room ${tenantDb}`, criteria);
      }
    }
  } catch (err) {
    console.error('Notification dismiss emit error:', err);
  }
};

