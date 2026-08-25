import mongoose from 'mongoose';
import BillDefault from '../models/Bill.js';
import SettingDefault from '../models/Setting.js';
import ServiceRequestDefault from '../models/ServiceRequest.js';
import { NotificationDefault } from '../models/Notification.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';

export const getActiveNotifications = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const Settings = getTenantModel(req, 'Setting', SettingDefault);
    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestDefault);
    const NotificationModel = getTenantModel(req, 'Notification', NotificationDefault);
    
    const settings = await Settings.findOne().lean();
    const shopName = settings?.restaurantName || 'Restaurant';

    let notifications = [];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 0. Fetch persistent notifications from the DB model (last 24 hours)
    try {
      const persistentNotifs = await NotificationModel.find({
        createdAt: { $gte: oneDayAgo }
      }).sort({ createdAt: -1 }).limit(100).lean();
      
      persistentNotifs.forEach(n => {
        notifications.push({
          id: n.data?.id || n._id.toString(),
          type: n.type,
          title: n.title,
          message: n.message,
          time: n.createdAt,
          timestamp: new Date(n.createdAt),
          targetRoles: n.targetRoles || ['Admin'],
          data: n.data || {}
        });
      });
    } catch (dbErr) {
      console.error('Error fetching persistent notifications:', dbErr);
    }

    // 1. Query open and billed orders that have pending cancellation requests (fallback for interactive Accept/Reject actions)
    const activeCancelBills = await Bill.find({
      status: { $in: ['Open', 'Billed'] },
      'items.cancellationRequested': true,
      updatedAt: { $gte: oneDayAgo }
    }).select('tableNo items createdAt updatedAt').lean();

    activeCancelBills.forEach(bill => {
      const cleanTable = (bill.tableNo || '').replace('Table ', '');
      if (Array.isArray(bill.items)) {
        bill.items.forEach(item => {
          if (item.cancellationRequested) {
            // Only add if not already present in persistent notifications (avoids double notifications)
            const alreadyPresent = notifications.some(n =>
              (n.data?.type === 'cancel_item_request' || n.title?.includes('Cancel Req')) &&
              n.data?.orderId?.toString() === bill._id?.toString() &&
              n.data?.itemId?.toString() === item._id?.toString()
            );

            if (!alreadyPresent) {
              notifications.push({
                id: `cancel-${bill._id}-${item._id}`,
                type: 'error',
                title: `${shopName} | Table ${cleanTable} Cancel Req`,
                message: `${item.cancellationRequestedQty || item.quantity}x ${item.name}`,
                time: item.updatedAt || bill.updatedAt || bill.createdAt || new Date(),
                timestamp: new Date(item.updatedAt || bill.updatedAt || bill.createdAt || Date.now()),
                targetRoles: ['Admin', 'Manager', 'Captain'],
                data: {
                  orderId: bill._id,
                  itemId: item._id,
                  type: 'cancel_item_request',
                  itemName: item.name,
                  cancelQty: item.cancellationRequestedQty || item.quantity,
                  tableNo: bill.tableNo
                }
              });
            }
          }
        });
      }
    });

    // 2. Query recent pending Service Requests (Call Waiter, Need Water, Pay the Bill) from last 24 hours
    const serviceRequests = await ServiceRequest.find({
      createdAt: { $gte: oneDayAgo },
      status: { $ne: 'Completed' }
    }).sort({ createdAt: -1 }).limit(30).lean();

    serviceRequests.forEach(reqItem => {
      const cleanTable = (reqItem.tableNumber || '').replace('Table ', '');
      const reqType = reqItem.requestType || 'Service';
      const isPayBill = reqType === 'Pay the Bill';
      
      notifications.push({
        id: `service-${reqItem._id}`,
        type: isPayBill ? 'warning' : 'info',
        title: `Table ${cleanTable} Service`,
        message: reqType,
        time: reqItem.createdAt || new Date(),
        timestamp: new Date(reqItem.createdAt || Date.now()),
        targetRoles: isPayBill 
          ? ['Cashier', 'Captain', 'Manager', 'Admin'] 
          : ['Captain', 'Manager', 'Admin'],
        data: {
          serviceRequestId: reqItem._id,
          type: 'service_request',
          requestType: reqType,
          tableNo: reqItem.tableNumber,
          status: reqItem.status
        }
      });
    });

    // Deduplicate notifications by ID
    const uniqueMap = new Map();
    notifications.forEach(n => {
      if (!uniqueMap.has(n.id)) {
        uniqueMap.set(n.id, n);
      }
    });

    // Sort all notifications newest first
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
      const timeA = new Date(a.timestamp || a.time || 0);
      const timeB = new Date(b.timestamp || b.time || 0);
      return timeB - timeA;
    });

    res.json(sorted);
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete a single notification permanently from the backend database


export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Notification ID is required' });

    const NotificationModel = getTenantModel(req, 'Notification', NotificationDefault);
    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestDefault);
    const Bill = getTenantModel(req, 'Bill', BillDefault);

    // 1. If valid MongoDB ID or matched by data.id / data.itemId
    if (mongoose.Types.ObjectId.isValid(id)) {
      await NotificationModel.findByIdAndDelete(id);
    }
    await NotificationModel.deleteMany({
      $or: [
        { 'data.id': id },
        { 'data.itemId': id }
      ]
    });

    // 2. If it is a service request notification (service-<id>)
    if (id.startsWith('service-')) {
      const sId = id.replace('service-', '');
      if (mongoose.Types.ObjectId.isValid(sId)) {
        await ServiceRequest.findByIdAndUpdate(sId, { status: 'Completed' });
      }
    }

    // 3. If it is a cancel request notification (cancel-<orderId>-<itemId>)
    if (id.startsWith('cancel-')) {
      const parts = id.split('-');
      if (parts.length >= 3) {
        const orderId = parts[1];
        const itemId = parts[2];
        if (mongoose.Types.ObjectId.isValid(orderId)) {
          const bill = await Bill.findById(orderId);
          if (bill && bill.items) {
            const item = bill.items.id ? bill.items.id(itemId) : bill.items.find(i => String(i._id) === itemId);
            if (item) {
              item.cancellationRequested = false;
              bill.markModified('items');
              await bill.save();
            }
          }
        }
      }
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: error.message });
  }
};

// Clear all active notifications permanently from the database


export const deleteAllNotifications = async (req, res) => {
  try {
    const NotificationModel = getTenantModel(req, 'Notification', NotificationDefault);
    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestDefault);

    await NotificationModel.deleteMany({});
    await ServiceRequest.updateMany({ status: { $ne: 'Completed' } }, { status: 'Completed' });

    res.json({ success: true, message: 'All notifications cleared successfully' });
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    res.status(500).json({ message: error.message });
  }
};