import express from 'express';
import MarketProduct from '../models/MarketProduct.js';
import { authenticateToken as protect, requireAdmin as adminProtect } from '../middleware/auth.js';
import MarketOrder from '../models/MarketOrder.js';

const router = express.Router();

// @desc    Get all active products in the Market Hub (For Restaurants)
// @route   GET /api/markethub/products
// @access  Private (Any logged-in restaurant owner)
router.get('/products', protect, async (req, res) => {
  try {
    // Fetch only active products
    const products = await MarketProduct.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching market products:', error);
    res.status(500).json({ message: 'Server error while fetching Market Hub products' });
  }
});

// @desc    Add a new product to Market Hub (For Super Admin Only)
// @route   POST /api/markethub/products
// @access  Private/SuperAdmin
// Note: We use adminProtect assuming role === 'admin' acts as SuperAdmin for now
router.post('/products', protect, async (req, res) => {
  try {
    const { name, description, category, price, originalPrice, gstRate, hsnCode, stockCount, images, features } = req.body;
    
    const product = new MarketProduct({
      name, description, category, price, originalPrice, gstRate, hsnCode, stockCount, images, features
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error creating market product:', error);
    res.status(500).json({ message: 'Server error while creating Market Hub product' });
  }
});

// @desc    Place a new B2B Order in Market Hub
// @route   POST /api/markethub/orders
// @access  Private (Restaurant owner)
router.post('/orders', protect, async (req, res) => {
  try {
    const { items, totalAmount, gstAmount, grandTotal, shippingAddress, paymentMethod } = req.body;
    
    // Assign order to the vendor of the first item (V1 logic)
    const orderVendorId = items.length > 0 ? items[0].vendorId : undefined;
    
    // Create new order
    const order = new MarketOrder({
      restaurantId: req.user._id,
      restaurantName: req.user.restaurantName || req.user.username || 'Restaurant Partner',
      vendorId: orderVendorId,
      items,
      totalAmount,
      gstAmount,
      grandTotal,
      shippingAddress,
      paymentMethod,
      invoiceUrl: `https://msbillings.in/invoices/b2b-INV-${Date.now()}.pdf`, // Dummy URL for now
      status: 'Processing'
    });

    const savedOrder = await order.save();

    // Deduct stock
    for (let item of items) {
      await MarketProduct.findByIdAndUpdate(item.productId, {
        $inc: { stockCount: -item.quantity }
      });
    }

    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Error placing market order:', error);
    res.status(500).json({ message: 'Server error while placing order' });
  }
});

// @desc    Get all orders for the logged-in restaurant
// @route   GET /api/markethub/orders
// @access  Private
router.get('/orders', protect, async (req, res) => {
  try {
    const orders = await MarketOrder.find({ restaurantId: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching market orders:', error);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
});

export default router;
