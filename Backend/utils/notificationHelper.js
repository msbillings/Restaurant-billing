import jwt from 'jsonwebtoken';

import { getTenantModel } from './tenantHelper.js';
import { NotificationDefault } from '../models/Notification.js';
import UserDefault from '../models/User.js';

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
    } catch (e) { }
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
      const notifId = (data && data.id) ? data.id : `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const enrichedData = { ...(data || {}), id: notifId };
      const immediateNotification = {
        id: notifId,
        title,
        message,
        time: new Date().toISOString(),
        type,
        targetRoles,
        tenantDb,
        data: enrichedData
      };

      // ⚡ FAST-PATH: Broadcast immediately with 0ms delay to all connected sockets
      if (io) {
        if (tenantDb) {
          io.to(tenantDb).emit('new_notification', immediateNotification);
        } else {
          io.emit('new_notification', immediateNotification);
        }
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
          data: enrichedData
        }).then(savedDoc => {
          sendFcmPushNotification(req, tenantDb, title, message, targetRoles, enrichedData);
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

export const isNotificationForRole = (notification, role = 'Admin') => {
  if (!notification) return false;
  const userRole = (role || 'Admin').trim().toLowerCase();
  if (userRole === 'admin' || userRole === 'manager') return true;

  const targetRoles = Array.isArray(notification.targetRoles)
    ? notification.targetRoles.map(r => String(r).toLowerCase())
    : [];

  const title = (notification.title || '').toLowerCase();
  const msg = (notification.message || '').toLowerCase();
  const notifType = (notification.data?.type || notification.type || '').toLowerCase();

  if (userRole === 'chef' || userRole === 'kds') {
    if (title.includes('water') || title.includes('call waiter') || title.includes('pay the bill') || title.includes('cancel') || title.includes('withdrawn') || msg.includes('need water') || msg.includes('call waiter') || msg.includes('pay the bill') || msg.includes('cancel') || msg.includes('withdrawn') || notifType === 'service_request' || notifType === 'cancel_item_request' || notifType === 'cancel_item_withdrawn') {
      return false;
    }
    if (targetRoles.includes('chef') || targetRoles.includes('kds') || title.includes('kot') || title.includes('order placed') || title.includes('order updated') || title.includes('item quantity') || title.includes('kitchen') || title.includes('food') || notifType.includes('kot') || notifType.includes('kitchen') || notifType.includes('order')) {
      return true;
    }
    return false;
  }

  if (userRole === 'captain' || userRole === 'waiter') {
    if (targetRoles.includes('captain') || targetRoles.includes('waiter') || title.includes('service') || title.includes('waiter') || title.includes('water') || title.includes('cutlery') || title.includes('food ready') || title.includes('kot accepted') || title.includes('cancel') || title.includes('withdrawn') || notifType.includes('cancel') || notifType.includes('service')) {
      return true;
    }
    return false;
  }

  if (userRole === 'cashier') {
    if (targetRoles.includes('cashier') || title.includes('pay the bill') || title.includes('bill') || title.includes('payment') || title.includes('settle') || title.includes('due') || title.includes('cancel') || msg.includes('pay the bill') || notifType.includes('bill') || notifType.includes('cancel')) {
      return true;
    }
    return false;
  }

  return targetRoles.length === 0 || targetRoles.includes(userRole);
};

export const sendFcmPushNotification = async (req, tenantDb, title, message, targetRoles = ['Admin'], data = {}) => {
  try {
    if (global.firebaseAdmin) {
      // Find all users in the specified tenant database that match the target roles
      let User;
      try {
        User = getTenantModel(req, 'User', UserDefault);
      } catch (e) {
        console.warn('[FCM Push] Could not resolve User model for tenant:', tenantDb);
        return;
      }

      // Fetch ALL users who have FCM tokens
      const users = await User.find({ fcmTokens: { $exists: true, $not: { $size: 0 } } }).select('fcmTokens role');
      let tokens = [];

      // Create a mock notification object to pass to the filtering logic
      const mockNotification = { title, message, targetRoles, data };

      users.forEach(u => {
        // Evaluate if THIS specific user should receive the push notification based on their role
        if (isNotificationForRole(mockNotification, u.role)) {
          if (u.fcmTokens && Array.isArray(u.fcmTokens)) {
            tokens.push(...u.fcmTokens);
          }
        }
      });

      // Filter out invalid/empty tokens
      tokens = [...new Set(tokens.filter(t => t && t.trim() !== ''))];

      if (tokens.length === 0) {
        return; // No devices to notify
      }

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
        tokens: tokens
      };

      const response = await global.firebaseAdmin.messaging().sendEachForMulticast(payload);

      // Optional: Cleanup invalid tokens (NotRegistered)
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (errCode === 'messaging/invalid-registration-token' || errCode === 'messaging/registration-token-not-registered') {
              failedTokens.push(tokens[idx]);
            }
          }
        });

        if (failedTokens.length > 0) {
          await User.updateMany(
            { fcmTokens: { $in: failedTokens } },
            { $pull: { fcmTokens: { $in: failedTokens } } }
          );
        }
      }
    }
  } catch (fcmErr) {
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

