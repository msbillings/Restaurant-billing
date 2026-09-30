import MarketProduct from '../models/MarketProduct.js';
import MarketOrder from '../models/MarketOrder.js';
import PDFDocument from 'pdfkit';

// @desc    Get all active products in the Market Hub (For Restaurants)
// @route   GET /api/markethub/products
// @access  Private (Any logged-in restaurant owner)
export const getProducts = async (req, res) => {
  try {
    let query = { isActive: true };
    
    // If the logged in user is a vendor, show only their products
    if (req.user && req.user.role === 'vendor') {
      query.$or = [
        { vendorId: req.user._id },
        { allowedVendors: req.user._id }
      ];
    }

    // Fetch products based on the constructed query
    const products = await MarketProduct.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching market products:', error);
    res.status(500).json({ message: 'Server error while fetching Market Hub products' });
  }
};

// @desc    Add a new product to Market Hub (For Super Admin Only)
// @route   POST /api/markethub/products
// @access  Private/SuperAdmin
export const addProduct = async (req, res) => {
  try {
    const { name, description, category, price, originalPrice, gstRate, hsnCode, stockCount, images, features, allowedVendors } = req.body;
    
    const product = new MarketProduct({
      name, description, category, price, originalPrice, gstRate, hsnCode, stockCount, images, features,
      vendorId: req.user._id,
      vendorName: req.user.username || req.user.name || 'Vendor',
      allowedVendors: allowedVendors || []
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error creating market product:', error);
    res.status(500).json({ message: 'Server error while creating Market Hub product' });
  }
};

// @desc    Update a product in Market Hub
// @route   PUT /api/markethub/products/:id
// @access  Private
export const updateProduct = async (req, res) => {
  try {
    const { name, description, category, price, originalPrice, gstRate, hsnCode, stockCount, images, features, isActive, allowedVendors } = req.body;
    
    const product = await MarketProduct.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    // Authorization check
    if (req.user.role === 'vendor' && product.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this product' });
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (category) product.category = category;
    if (price !== undefined) product.price = price;
    if (originalPrice !== undefined) product.originalPrice = originalPrice;
    if (gstRate !== undefined) product.gstRate = gstRate;
    if (hsnCode) product.hsnCode = hsnCode;
    if (stockCount !== undefined) product.stockCount = stockCount;
    if (images) product.images = images;
    if (features) product.features = features;
    if (isActive !== undefined) product.isActive = isActive;
    
    if (req.user.role === 'superadmin' || req.user.role === 'admin') {
      if (allowedVendors && Array.isArray(allowedVendors)) {
        product.allowedVendors = allowedVendors;
      }
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating market product:', error);
    res.status(500).json({ message: 'Server error while updating Market Hub product' });
  }
};

// @desc    Place a new B2B Order in Market Hub
// @route   POST /api/markethub/orders
// @access  Private (Restaurant owner)
export const placeOrder = async (req, res) => {
  try {
    const { items, totalAmount, gstAmount, grandTotal, shippingAddress, paymentMethod } = req.body;
    
    // Assign order to the vendor of the first item (V1 logic)
    const orderVendorId = items.length > 0 ? items[0].vendorId : undefined;
    
    // Strict E-commerce Stock Validation
    for (const item of items) {
      const product = await MarketProduct.findById(item.productId);
      if (!product) {
        return res.status(400).json({ message: `Product ${item.name} not found.` });
      }
      if (!product.isActive) {
        return res.status(400).json({ message: `Product ${item.name} is currently inactive.` });
      }
      if (product.stockCount < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${item.name}. Available: ${product.stockCount}, Requested: ${item.quantity}.` });
      }
    }
    
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
      invoiceUrl: `/api/markethub/orders/###ID###/invoice`,
      status: 'Processing'
    });

    const savedOrder = await order.save();

    // Deduct stock
    for (let item of items) {
      await MarketProduct.findByIdAndUpdate(item.productId, {
        $inc: { stockCount: -item.quantity }
      });
    }

    // Set actual invoice URL now that we have _id
    savedOrder.invoiceUrl = `/api/markethub/orders/${savedOrder._id}/invoice`;
    await savedOrder.save();

    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Error placing market order:', error);
    res.status(500).json({ message: 'Server error while placing order' });
  }
};

// @desc    Get all orders for the logged-in restaurant
// @route   GET /api/markethub/orders
// @access  Private
export const getOrders = async (req, res) => {
  try {
    // If admin, return all orders. Otherwise, return only restaurant's orders.
    const query = req.user.role === 'admin' ? {} : { restaurantId: req.user._id };
    const orders = await MarketOrder.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching market orders:', error);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
};

// @desc    Download high-end PDF invoice for an order
// @route   GET /api/markethub/orders/:id/invoice
// @access  Public (Uses Un-guessable Object ID)
export const downloadInvoice = async (req, res) => {
  try {
    const order = await MarketOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order._id}.pdf`);
    doc.pipe(res);

    // Header - Company Details
    doc.fillColor('#4f46e5').fontSize(28).font('Helvetica-Bold').text('MSBILLING', 50, 50, { align: 'left' });
    doc.fillColor('#444444').fontSize(10).font('Helvetica').text('B2B Enterprise Solutions', 50, 80, { align: 'left' });
    
    // Header - Invoice Details
    doc.fontSize(20).fillColor('#111111').font('Helvetica-Bold').text('TAX INVOICE', 300, 50, { align: 'right', width: 245 });
    doc.fontSize(10).fillColor('#666666').font('Helvetica')
       .text(`Invoice Number: INV-${order._id.toString().substring(0, 8).toUpperCase()}`, 350, 85, { align: 'right', width: 195 })
       .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 350, 100, { align: 'right', width: 195 })
       .text(`Payment Mode: ${order.paymentMethod || 'Online'}`, 350, 115, { align: 'right', width: 195 });
    
    doc.moveTo(50, 150).lineTo(545, 150).strokeColor('#e5e7eb').stroke();

    const customerDetailsTop = 165;

    // Bill To
    doc.fontSize(12).fillColor('#111111').font('Helvetica-Bold').text('Bill To:', 50, customerDetailsTop);
    doc.fontSize(10).fillColor('#444444').font('Helvetica')
       .text(order.restaurantName || 'Restaurant Partner', 50, customerDetailsTop + 15)
       .text(order.shippingAddress?.street || 'N/A', 50, customerDetailsTop + 30)
       .text(`${order.shippingAddress?.city || ''} ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zipCode || ''}`, 50, customerDetailsTop + 45)
       .text(`Phone: ${order.shippingAddress?.contactNumber || 'N/A'}`, 50, customerDetailsTop + 60);

    // Ship To (Same as Bill To for now)
    doc.fontSize(12).fillColor('#111111').font('Helvetica-Bold').text('Ship To:', 300, customerDetailsTop);
    doc.fontSize(10).fillColor('#444444').font('Helvetica')
       .text(order.restaurantName || 'Restaurant Partner', 300, customerDetailsTop + 15)
       .text(order.shippingAddress?.street || 'N/A', 300, customerDetailsTop + 30)
       .text(`${order.shippingAddress?.city || ''} ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zipCode || ''}`, 300, customerDetailsTop + 45)
       .text(`Phone: ${order.shippingAddress?.contactNumber || 'N/A'}`, 300, customerDetailsTop + 60);

    // Table Header
    const tableTop = 270;
    doc.font('Helvetica-Bold').fillColor('#ffffff');
    
    // Header Background
    doc.rect(50, tableTop - 5, 495, 25).fill('#4f46e5');
    doc.fillColor('#ffffff');
    
    doc.text('S.No.', 60, tableTop);
    doc.text('Item Description', 100, tableTop);
    doc.text('Category', 280, tableTop);
    doc.text('Qty', 370, tableTop, { width: 30, align: 'center' });
    doc.text('Unit Price', 410, tableTop, { width: 60, align: 'right' });
    doc.text('Total', 480, tableTop, { width: 60, align: 'right' });
    
    // Table Rows
    doc.font('Helvetica').fillColor('#111111');
    let y = tableTop + 30;
    order.items.forEach((item, index) => {
      doc.text((index + 1).toString(), 60, y);
      doc.text(item.name, 100, y, { width: 170 });
      doc.text(item.category || 'Product', 280, y, { width: 80 });
      doc.text(item.quantity.toString(), 370, y, { width: 30, align: 'center' });
      doc.text(`Rs. ${item.price.toLocaleString()}`, 410, y, { width: 60, align: 'right' });
      doc.text(`Rs. ${(item.price * item.quantity).toLocaleString()}`, 480, y, { width: 60, align: 'right' });
      
      // Line separator for each row
      doc.moveTo(50, y + 15).lineTo(545, y + 15).strokeColor('#e5e7eb').stroke();
      
      y += 25;
    });

    // Totals Box
    const totalsTop = y + 10;
    
    doc.rect(350, totalsTop, 195, 80).fill('#f9fafb').strokeColor('#e5e7eb').stroke();
    
    y = totalsTop + 10;
    doc.font('Helvetica-Bold').fillColor('#444444');
    doc.text('Subtotal:', 360, y, { width: 80, align: 'left' });
    doc.font('Helvetica').text(`Rs. ${order.totalAmount.toLocaleString()}`, 450, y, { width: 85, align: 'right' });
    y += 20;
    
    doc.font('Helvetica-Bold');
    doc.text('GST (18%):', 360, y, { width: 80, align: 'left' });
    doc.font('Helvetica').text(`Rs. ${order.gstAmount.toLocaleString()}`, 450, y, { width: 85, align: 'right' });
    y += 20;

    doc.moveTo(355, y).lineTo(540, y).strokeColor('#e5e7eb').stroke();
    y += 5;

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#4f46e5');
    doc.text('Grand Total:', 360, y, { width: 80, align: 'left' });
    doc.text(`Rs. ${order.grandTotal.toLocaleString()}`, 450, y, { width: 85, align: 'right' });

    // Terms and Conditions
    const footerTop = totalsTop + 120;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Terms & Conditions:', 50, footerTop);
    doc.font('Helvetica').fontSize(9).fillColor('#444444')
       .text('1. Goods once sold will not be taken back.', 50, footerTop + 15)
       .text('2. Warranty as per manufacturer terms.', 50, footerTop + 28)
       .text('3. Subject to local jurisdiction.', 50, footerTop + 41);

    doc.font('Helvetica').fontSize(9).fillColor('#999999').text('Thank you for your business! This is a computer generated invoice and requires no physical signature.', 50, doc.page.height - 70, { align: 'center', width: 500, lineBreak: false });

    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};

// @desc    Update order status and add tracking history
// @route   PUT /api/markethub/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, location, note } = req.body;
    const order = await MarketOrder.findById(req.params.id);
    
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
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
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Server error while updating order status' });
  }
};

// @desc    Delete all orders for the logged-in restaurant
// @route   DELETE /api/markethub/orders
// @access  Private (Restaurant owner)
export const deleteOrdersForRestaurant = async (req, res) => {
  try {
    const restaurantId = req.user._id;
    const result = await MarketOrder.deleteMany({ restaurantId });
    res.json({ message: `Successfully deleted ${result.deletedCount} orders for your restaurant.` });
  } catch (error) {
    console.error('Error deleting orders:', error);
    res.status(500).json({ message: 'Server error while deleting orders' });
  }
};
