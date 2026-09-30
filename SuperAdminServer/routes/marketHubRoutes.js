import express from 'express';
import MarketProduct from '../models/MarketProduct.js';
import MarketOrder from '../models/MarketOrder.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all orders (SuperAdmin & Vendor)
router.get('/orders', protect, async (req, res) => {
  try {
    if (req.admin && req.admin.role === 'Vendor') {
      // Find all products this vendor has access to (created by them OR in allowedVendors)
      const vendorProducts = await MarketProduct.find({
        $or: [
          { vendorId: req.admin.id },
          { allowedVendors: req.admin.id }
        ]
      }).select('_id');

      const productIds = vendorProducts.map(p => p._id);

      // Find orders that contain at least one of those products
      const orders = await MarketOrder.find({
        'items.productId': { $in: productIds }
      }).sort({ createdAt: -1 });

      return res.json(orders);
    }

    // SuperAdmin sees all orders
    const orders = await MarketOrder.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all products (Also filter if Vendor)
router.get('/products', protect, async (req, res) => {
  try {
    let query = {};
    if (req.admin && req.admin.role === 'Vendor') {
      query.$or = [
        { vendorId: req.admin.id },
        { allowedVendors: req.admin.id }
      ];
    }
    const products = await MarketProduct.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new product
router.post('/products', protect, async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.admin && req.admin.role === 'Vendor') {
      data.vendorId = req.admin.id;
      data.vendorName = req.admin.vendorCompanyName || req.admin.name;
    }
    const product = new MarketProduct(data);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST bulk new products
router.post('/products/bulk', protect, async (req, res) => {
  try {
    const productsData = req.body.products || [];
    if (!Array.isArray(productsData)) {
      return res.status(400).json({ error: 'Expected an array of products' });
    }

    const processedProducts = productsData.map(data => {
      if (req.admin && req.admin.role === 'Vendor') {
        data.vendorId = req.admin.id;
        data.vendorName = req.admin.vendorCompanyName || req.admin.name;
      }
      return data;
    });

    const products = await MarketProduct.insertMany(processedProducts);
    res.status(201).json({ message: `${products.length} products added successfully`, products });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update product
router.put('/products/:id', protect, async (req, res) => {
  try {
    const product = await MarketProduct.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE product
router.delete('/products/:id', protect, async (req, res) => {
  try {
    await MarketProduct.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT upload shipping proof and update status (For Vendor)
router.put('/orders/:id/dispatch', protect, async (req, res) => {
  try {
    const { shippingProofImage, trackingId, deliveryETA } = req.body;
    const update = { 
      status: 'Dispatched',
      trackingId,
      deliveryETA
    };
    if (shippingProofImage) {
      update.$push = { shippingProofImages: shippingProofImage };
    }
    
    // Only let vendor update their own order, or superadmin
    let query = { _id: req.params.id };
    if (req.admin && req.admin.role === 'Vendor') {
      query.vendorId = req.admin.id;
    }

    const order = await MarketOrder.findOneAndUpdate(query, update, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found or unauthorized' });

    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @desc    Update order status
// @route   PUT /api/markethub/orders/:id/status
// @access  Private (SuperAdmin or Vendor)
router.put('/orders/:id/status', protect, async (req, res) => {
  try {
    const { status, location, note } = req.body;

    // Find the order first
    const order = await MarketOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // For vendors: verify they have access to at least one product in this order
    if (req.admin && req.admin.role === 'Vendor') {
      const orderProductIds = order.items.map(item => item.productId);
      const accessibleProduct = await MarketProduct.findOne({
        _id: { $in: orderProductIds },
        $or: [
          { vendorId: req.admin.id },
          { allowedVendors: req.admin.id }
        ]
      });
      if (!accessibleProduct) {
        return res.status(403).json({ message: 'Not authorized to update this order' });
      }
    }

    order.status = status;

    if (!order.trackingHistory) {
      order.trackingHistory = [];
    }

    order.trackingHistory.push({
      status,
      location,
      date: new Date(),
      note
    });

    await order.save();
    res.json(order);
  } catch (error) {
    console.error('Error updating market order status:', error);
    res.status(500).json({ message: 'Server error while updating status' });
  }
});

// @desc    Delete all orders (or vendor specific)
// @route   DELETE /api/markethub/orders
// @access  Private (SuperAdmin or Vendor)
router.delete('/orders', protect, async (req, res) => {
  try {
    let query = {};
    if (req.admin && req.admin.role === 'Vendor') {
      query.vendorId = req.admin.id;
    }
    
    const result = await MarketOrder.deleteMany(query);
    res.json({ message: `Successfully deleted ${result.deletedCount} orders.` });
  } catch (error) {
    console.error('Error deleting orders:', error);
    res.status(500).json({ message: 'Server error while deleting orders' });
  }
});

export default router;
