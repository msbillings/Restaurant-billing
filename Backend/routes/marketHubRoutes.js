import express from 'express';
import { tenantApiLimiter, adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken as protect, requireAdmin as adminProtect } from '../middleware/auth.js';
import { 
  getProducts, 
  addProduct, 
  updateProduct,
  placeOrder, 
  getOrders, 
  downloadInvoice,
  updateOrderStatus,
  deleteOrdersForRestaurant
} from '../controllers/marketHubController.js';

const router = express.Router();

// @desc    Get all active products in the Market Hub (For Restaurants)
// @route   GET /api/markethub/products
// @access  Private (Any logged-in restaurant owner)
router.get('/products', protect, getProducts);

// @desc    Add a new product to Market Hub (For Super Admin Only)
// @route   POST /api/markethub/products
// @access  Private/SuperAdmin
router.post('/products', protect, addProduct);

// @desc    Update a product in Market Hub
// @route   PUT /api/markethub/products/:id
// @access  Private
router.put('/products/:id', protect, updateProduct);

// @desc    Place a new B2B Order in Market Hub
// @route   POST /api/markethub/orders
// @access  Private (Restaurant owner)
router.post('/orders', protect, placeOrder);

// @desc    Get all orders for the logged-in restaurant
// @route   GET /api/markethub/orders
// @access  Private
router.get('/orders', protect, getOrders);

// @desc    Download high-end PDF invoice for an order
// @route   GET /api/markethub/orders/:id/invoice
// @access  Public (Uses Un-guessable Object ID)
router.get('/orders/:id/invoice', downloadInvoice);

// @desc    Update order status
// @route   PUT /api/markethub/orders/:id/status
// @access  Private/Admin
router.put('/orders/:id/status', protect, adminProtect, updateOrderStatus);

// @desc    Delete all orders for the logged-in restaurant
// @route   DELETE /api/markethub/orders
// @access  Private
router.delete('/orders', protect, deleteOrdersForRestaurant);

export default router;
