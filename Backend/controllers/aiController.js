import MenuDefault from '../models/Menu.js';
import BillDefault from '../models/Bill.js';
import { getTenantModel } from '../utils/tenantHelper.js';

const emitSocketEvent = (req, eventName, data) => {
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

/**
 * Fuzzy match a text token against a menu item name.
 * Uses a simple substring + Levenshtein-like approach.
 */
const fuzzyMatch = (query, menuName) => {
  const q = query.toLowerCase().trim();
  const name = menuName.toLowerCase().trim();
  
  // Exact substring match
  if (name.includes(q) || q.includes(name)) return 1.0;
  
  // Word-level match (e.g. "mandi" matches "Al Mandi Chicken Full")
  const nameWords = name.split(/\s+/);
  const queryWords = q.split(/\s+/);
  
  let matchedWords = 0;
  for (const qw of queryWords) {
    for (const nw of nameWords) {
      if (nw.includes(qw) || qw.includes(nw)) {
        matchedWords++;
        break;
      }
    }
  }
  
  if (matchedWords > 0) {
    return matchedWords / Math.max(queryWords.length, nameWords.length);
  }
  
  return 0;
};

/**
 * Parse a natural language message into structured order items.
 * Examples:
 *   "I want 2 chicken mandi and 1 coke"
 *   "Send 3 biryani full, 2 pepsi"
 *   "1 butter naan 2 dal fry"
 */
const parseOrderFromText = (text, menuItems) => {
  const cleaned = text
    .toLowerCase()
    .replace(/please|i want|i need|send|order|can i get|give me|bhai|yaar|thanks/gi, '')
    .replace(/[.,!?]/g, ' ')
    .trim();

  // Split by "and", commas, or just spaces with quantities
  const segments = cleaned.split(/\s+and\s+|\s*,\s*/);
  
  const parsedItems = [];
  
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    
    // Extract quantity (default 1)
    const qtyMatch = trimmed.match(/^(\d+)\s+(.+)/) || trimmed.match(/(.+)\s+x\s*(\d+)$/);
    let quantity = 1;
    let itemText = trimmed;
    
    if (qtyMatch) {
      if (/^\d+/.test(trimmed)) {
        quantity = parseInt(qtyMatch[1]);
        itemText = qtyMatch[2];
      } else {
        quantity = parseInt(qtyMatch[2]);
        itemText = qtyMatch[1];
      }
    }
    
    // Find best matching menu item
    let bestMatch = null;
    let bestScore = 0;
    
    for (const menuItem of menuItems) {
      const score = fuzzyMatch(itemText, menuItem.name);
      if (score > bestScore && score >= 0.3) {
        bestScore = score;
        bestMatch = menuItem;
      }
    }
    
    if (bestMatch) {
      parsedItems.push({
        name: bestMatch.name,
        price: bestMatch.price,
        quantity: quantity,
        total: bestMatch.price * quantity,
        menuItemId: bestMatch._id,
        confidence: Math.round(bestScore * 100)
      });
    }
  }
  
  return parsedItems;
};

/**
 * POST /api/ai/whatsapp-order
 * Receives a text message, parses it against the menu, and creates an order.
 */
export const processWhatsAppOrder = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    
    const { message, customerName, customerPhone } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message text is required' });
    }
    
    // Get all available menu items
    const menuItems = await Menu.find({ isAvailable: true }).lean();
    
    if (menuItems.length === 0) {
      return res.status(400).json({ 
        message: 'No menu items available. Please add items to your menu first.',
        parsed: []
      });
    }
    
    // Parse the message
    const parsedItems = parseOrderFromText(message, menuItems);
    
    if (parsedItems.length === 0) {
      return res.status(200).json({
        success: false,
        message: "Sorry, I couldn't understand the order. Could you try again? Example: '2 chicken mandi and 1 coke'",
        parsed: [],
        suggestion: menuItems.slice(0, 5).map(m => m.name).join(', ')
      });
    }
    
    // Calculate totals
    const subtotal = parsedItems.reduce((sum, item) => sum + item.total, 0);
    
    // Create the order
    const tableNo = `WA-${Date.now().toString().slice(-4)}`;
    
    const newOrder = new Bill({
      tableNo,
      items: parsedItems.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        printedQuantity: item.quantity
      })),
      kots: [{
        kotNumber: 'KOT-1',
        items: parsedItems.map(item => ({
          name: item.name,
          quantity: item.quantity
        })),
        createdAt: new Date()
      }],
      subtotal,
      total: subtotal,
      tax: 0,
      discount: 0,
      status: 'Open',
      billType: 'Delivery',
      orderSource: 'Other',
      customerName: customerName || 'WhatsApp Customer',
      customerPhone: customerPhone || '',
      kitchenNotes: `WhatsApp Order: "${message}"`
    });
    
    await newOrder.save();
    
    // Emit real-time event
    emitSocketEvent(req, 'orderUpdated', { tableNo: newOrder.tableNo, status: 'Open' });
    emitSocketEvent(req, 'newKOT', { tableNo: newOrder.tableNo, kot: newOrder.kots[0] });
    
    res.status(200).json({
      success: true,
      message: `✅ Order created! ${parsedItems.length} item(s) detected.`,
      order: newOrder,
      parsed: parsedItems
    });
  } catch (error) {
    console.error('Error processing WhatsApp order:', error);
    res.status(500).json({ message: 'Failed to process order', error: error.message });
  }
};

/**
 * POST /api/ai/parse-only
 * Parse a message without creating an order (for preview/simulation).
 */
export const parseOnly = async (req, res) => {
  try {
    const Menu = getTenantModel(req, 'Menu', MenuDefault);
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message text is required' });
    }
    
    const menuItems = await Menu.find({ isAvailable: true }).lean();
    const parsedItems = parseOrderFromText(message, menuItems);
    
    res.status(200).json({
      success: parsedItems.length > 0,
      parsed: parsedItems,
      total: parsedItems.reduce((sum, item) => sum + item.total, 0)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/ai/fraud-analysis
 * "Silent Auditor" - Analyzes bills for fraudulent patterns
 */
export const runFraudAnalysis = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    
    // Get last 30 days of bills
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const bills = await Bill.find({
      createdAt: { $gte: thirtyDaysAgo }
    }).lean();

    const alerts = [];
    const userStats = {};

    bills.forEach(bill => {
      // Look for high discounts
      if (bill.discount > 0 && bill.subtotal > 0) {
        const discountPct = (bill.discount / bill.subtotal) * 100;
        if (discountPct >= 50) {
          alerts.push({
            type: 'High Discount',
            severity: 'High',
            tableNo: bill.tableNo,
            billNumber: bill.billNumber,
            date: bill.createdAt,
            details: `${discountPct.toFixed(1)}% discount given on ₹${bill.subtotal} bill.`,
            amount: bill.discount
          });
        }
      }

      // Look for cancelled bills
      if (bill.status === 'Cancelled') {
        alerts.push({
          type: 'Bill Cancelled',
          severity: 'Medium',
          tableNo: bill.tableNo,
          date: bill.createdAt,
          details: `Bill of ₹${bill.total} was cancelled.`,
          amount: bill.total
        });
      }

      // Group anomalies by user/waiter if available (assume 'admin' for now if not tracked in bill)
      const user = bill.performedBy || 'Unknown Staff';
      if (!userStats[user]) {
        userStats[user] = { cancellations: 0, highDiscounts: 0, totalOrders: 0 };
      }
      userStats[user].totalOrders += 1;
      if (bill.status === 'Cancelled') userStats[user].cancellations += 1;
      if (bill.discount > 0 && (bill.discount / bill.subtotal) >= 0.5) userStats[user].highDiscounts += 1;
    });

    // Check for systemic staff anomalies
    for (const [user, stats] of Object.entries(userStats)) {
      if (stats.cancellations > 5) {
        alerts.push({
          type: 'Staff Anomaly',
          severity: 'Critical',
          date: new Date(),
          details: `Staff member "${user}" has unusually high cancellations (${stats.cancellations} in 30 days).`
        });
      }
    }

    res.status(200).json({
      success: true,
      totalAnalyzed: bills.length,
      alerts: alerts.sort((a, b) => new Date(b.date) - new Date(a.date))
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
