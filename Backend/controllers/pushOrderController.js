import PushOrder from '../models/PushOrder.js';

// Get all push orders (can filter by status)
export const getPushOrders = async (req, res) => {
  try {
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
    const newOrder = new PushOrder(req.body);
    await newOrder.save();
    
    // In a real app, emit a socket.io event here so the frontend dings
    console.log('New mock order received:', newOrder._id);
    
    res.status(201).json({ message: 'Order received successfully', orderId: newOrder._id });
  } catch (error) {
    res.status(500).json({ message: 'Error receiving order', error: error.message });
  }
};

// Update order status (accept, prepare, dispatch)
export const updateOrderStatus = async (req, res) => {
  try {
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
