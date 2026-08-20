import PushOrderDefault from '../models/PushOrder.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { emitNotification } from '../utils/notificationHelper.js';

// Get all push orders (can filter by status)
export const getPushOrders = async (req, res) => {
  try {
    const PushOrder = getTenantModel(req, 'PushOrder', PushOrderDefault);
    const { status, platform } = req.query;
    let query = {};
    if (status) query.status = status;
    if (platform) query.platform = platform;
    
    const orders = await PushOrder.find(query).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching push orders', error: error.message });
  }
};

// Webhook endpoint to receive mock orders from aggregators
export const receivePushOrder = async (req, res) => {
  try {
    const PushOrder = getTenantModel(req, 'PushOrder', PushOrderDefault);
    const newOrder = new PushOrder(req.body);
    await newOrder.save();
    
    // Emit a tenant-scoped notification so the frontend dings
    console.log('New online order received:', newOrder._id);
    emitNotification(
      req,
      'New Online Order',
      `Order ${newOrder.platformOrderId || ''} received from website!`,
      'info',
      ['Admin', 'Manager', 'Cashier'],
      { orderId: newOrder._id }
    );
    
    res.status(201).json({ message: 'Order received successfully', orderId: newOrder._id });
  } catch (error) {
    res.status(500).json({ message: 'Error receiving order', error: error.message });
  }
};

// Update order status (accept, prepare, dispatch)
export const updateOrderStatus = async (req, res) => {
  try {
    const PushOrder = getTenantModel(req, 'PushOrder', PushOrderDefault);
    const { id } = req.params;
    const { status } = req.body;
    
    const updatedOrder = await PushOrder.findByIdAndUpdate(id, { status }, { new: true });
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};
