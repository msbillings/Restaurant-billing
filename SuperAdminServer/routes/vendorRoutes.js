import express from 'express';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private (SuperAdmin)
router.get('/', protect, async (req, res) => {
  try {
    if (req.admin.role === 'Vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const vendors = await Admin.find({ role: 'Vendor' }).select('-password -passkeys').sort({ createdAt: -1 });
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Create a new vendor
// @route   POST /api/vendors
// @access  Private (SuperAdmin)
router.post('/', protect, async (req, res) => {
  try {
    if (req.admin.role === 'Vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { email, password, name, vendorCompanyName } = req.body;
    console.log('Vendor creation request:', { email, name, vendorCompanyName });

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const vendor = new Admin({
      email,
      password: hashedPassword,
      name,
      vendorCompanyName,
      role: 'Vendor',
      plainTextPassword: password
    });

    await vendor.save();
    res.status(201).json({
      _id: vendor._id,
      email: vendor.email,
      name: vendor.name,
      vendorCompanyName: vendor.vendorCompanyName,
      role: vendor.role
    });
  } catch (error) {
    console.error('Error in vendor creation:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Delete a vendor
// @route   DELETE /api/vendors/:id
// @access  Private (SuperAdmin)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.admin.role === 'Vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: 'Vendor removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update a vendor
// @route   PUT /api/vendors/:id
// @access  Private (SuperAdmin)
router.put('/:id', protect, async (req, res) => {
  try {
    if (req.admin.role === 'Vendor') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { email, password, name, vendorCompanyName } = req.body;
    const vendor = await Admin.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    if (email && email !== vendor.email) {
      const existing = await Admin.findOne({ email });
      if (existing) return res.status(400).json({ message: 'Email already in use' });
      vendor.email = email;
    }

    if (name) vendor.name = name;
    if (vendorCompanyName) vendor.vendorCompanyName = vendorCompanyName;
    
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      vendor.password = await bcrypt.hash(password, salt);
      vendor.plainTextPassword = password;
    }

    await vendor.save();
    res.json({ message: 'Vendor updated' });
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
