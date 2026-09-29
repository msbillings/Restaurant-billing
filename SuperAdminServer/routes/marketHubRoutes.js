import express from 'express';
import MarketProduct from '../models/MarketProduct.js';
import MarketOrder from '../models/MarketOrder.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all orders (SuperAdmin & Vendor)
router.get('/orders', protect, async (req, res) => {
  try {
    let query = {};
    if (req.admin && req.admin.role === 'Vendor') {
      // Find orders that contain products belonging to this vendor
      // (This requires finding products first, or assuming vendorId is on the order)
      // Since an order might have multiple vendors, let's simplify: 
      // If vendorId is set on the order, we filter by it. Or we check order.items.
      query = { vendorId: req.admin._id }; 
    }
    const orders = await MarketOrder.find(query).sort({ createdAt: -1 }).populate('restaurantId', 'restaurantName email phone');
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
      query.vendorId = req.admin._id;
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
      data.vendorId = req.admin._id;
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
        data.vendorId = req.admin._id;
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
      query.vendorId = req.admin._id;
    }

    const order = await MarketOrder.findOneAndUpdate(query, update, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found or unauthorized' });

    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
