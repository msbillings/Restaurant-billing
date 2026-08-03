import UserDefault from '../models/User.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';

export const getUsers = async (req, res) => {
  try {
    const User = getTenantModel(req, 'User', UserDefault);
    const users = await User.find({}, '-password'); // Exclude passwords
    res.status(200).json(users);
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const User = getTenantModel(req, 'User', UserDefault);
    const { username, password, role } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const newUser = new User({
      username,
      password, // Password will be hashed by the pre-save hook
      role: role || 'Cashier'
    });

    await newUser.save();
    
    // Return user without password
    const userToReturn = newUser.toObject();
    delete userToReturn.password;
    
    res.status(201).json(userToReturn);
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const User = getTenantModel(req, 'User', UserDefault);
    const { username, role, password } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent changing the last admin's role
    if (user.role === 'Admin' && role !== 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot demote the last Admin' });
      }
    }

    if (username) user.username = username;
    if (role) user.role = role;
    if (password) user.password = password; // Pre-save hook will hash it

    await user.save();
    
    const userToReturn = user.toObject();
    delete userToReturn.password;
    
    res.status(200).json(userToReturn);
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const User = getTenantModel(req, 'User', UserDefault);
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    
    // Prevent deleting the last admin
    if (user.role === 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last Admin' });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};
