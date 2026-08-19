import BillDefault from '../models/Bill.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { updateTableStatusHelper } from './floorController.js';
import { emitSocketEvent } from '../utils/socket.js';

// Webhook for Swiggy/Zomato to push an order
export const receiveOnlineOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { 
      orderId, 
      platform, // 'Zomato', 'Swiggy', 'Talabat'
      customerName, 
      customerPhone,
      items, 
      totalAmount,
      kitchenNotes
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    // Generate a unique dummy table/order number for the aggregator
    // e.g. "Zomato-1249"
    const tableNo = `${platform}-${orderId.substring(orderId.length - 4)}`;

    const newOrder = new Bill({
      tableNo: tableNo,
      items: items.map(i => ({
        menuItemId: null, // Online items might not perfectly match local IDs initially
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        printedQuantity: 0
      })),
      total: totalAmount,
      subtotal: totalAmount,
      discount: 0,
      tax: 0,
      customerName: customerName || platform,
      customerPhone: customerPhone || '',
      status: 'Open',
      billType: 'Delivery',
      orderSource: platform,
      kots: []
    });

    await newOrder.save();

    // Trigger instant UI updates for the KDS and Dashboard
    emitSocketEvent(req, 'orderUpdated', { tableNo: newOrder.tableNo, status: 'Open' });

    res.status(200).json({ 
      message: `Order received successfully from ${platform}`,
      order: newOrder
    });
  } catch (error) {
    console.error('Error receiving aggregator order:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
