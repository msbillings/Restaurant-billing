import UserDefault from '../models/User.js';
import Client from '../models/Client.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';

// Synchronize tenant users to SuperAdmin central staffAccounts
const syncStaffToSuperAdmin = async (req, UserModel) => {
  try {
    const tenantDb = req.user?.db || req.tenantDb || req.headers?.['x-tenant-db'] || req.headers?.['X-Tenant-DB'];
    if (!tenantDb || tenantDb === 'default' || tenantDb === 'mscurechain') return;

    const allUsers = await UserModel.find({}, 'username role').lean();
    const clientDoc = await Client.findOne({ databaseName: tenantDb });
    if (!clientDoc) return;

    const existingPassMap = new Map();
    (clientDoc.staffAccounts || []).forEach(s => {
      if (s.username) existingPassMap.set(s.username.toLowerCase(), s.plainTextPassword);
    });

    const updatedStaff = allUsers.map(u => ({
      role: u.role,
      username: u.username,
      plainTextPassword: existingPassMap.get(u.username.toLowerCase()) || clientDoc.plainTextPassword || '123456'
    }));

    await Client.updateOne(
      { databaseName: tenantDb },
      { $set: { staffAccounts: updatedStaff, updatedAt: new Date() } }
    );
    console.log(`[AdminController] Synchronized ${updatedStaff.length} staff accounts to central SuperAdmin for ${tenantDb}`);
  } catch (err) {
    console.warn('[AdminController] syncStaffToSuperAdmin warning:', err.message);
  }
};

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
    let { username, password, role, assignedDepartment, assignedKitchenId } = req.body;
    
    // Strict Sanitization & Validation
    const cleanUsername = (username || '').trim();
    if (!cleanUsername || cleanUsername.length < 2) {
      return res.status(400).json({ message: 'Username must be at least 2 characters long' });
    }
    if (cleanUsername.length > 30) {
      return res.status(400).json({ message: 'Username cannot exceed 30 characters' });
    }

    const validRoles = ['Admin', 'Manager', 'Cashier', 'Captain', 'Chef'];
    const assignedRole = validRoles.find(r => r.toLowerCase() === (role || '').trim().toLowerCase()) || 'Cashier';

    // Strict Case-Insensitive Duplicate Check within this tenant database
    const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${escaped}$`, 'i') }
    });
    if (existingUser) {
      return res.status(400).json({ message: `Username "${cleanUsername}" is already taken in this restaurant` });
    }

    const newUser = new User({
      username: cleanUsername,
      password, // Password will be hashed by the pre-save hook
      role: assignedRole,
      assignedDepartment: assignedDepartment || 'All',
      assignedKitchenId: assignedKitchenId || null
    });

    await newUser.save();
    
    // Synchronize to SuperAdmin central staffAccounts
    await syncStaffToSuperAdmin(req, User);

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
    let { username, role, password, assignedDepartment, assignedKitchenId } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const validRoles = ['Admin', 'Manager', 'Cashier', 'Captain', 'Chef'];
    const assignedRole = role ? (validRoles.find(r => r.toLowerCase() === role.trim().toLowerCase()) || user.role) : user.role;

    // Prevent changing the last admin's role
    if (user.role === 'Admin' && assignedRole !== 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot demote the last Admin' });
      }
    }

    // Strict Case-Insensitive Duplicate Check if username is being changed
    if (username) {
      const cleanUsername = username.trim();
      if (!cleanUsername || cleanUsername.length < 2) {
        return res.status(400).json({ message: 'Username must be at least 2 characters long' });
      }
      const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingUser = await User.findOne({
        _id: { $ne: req.params.id },
        username: { $regex: new RegExp(`^${escaped}$`, 'i') }
      });
      if (existingUser) {
        return res.status(400).json({ message: `Username "${cleanUsername}" is already taken in this restaurant` });
      }
      user.username = cleanUsername;
    }

    user.role = assignedRole;
    if (password && password.trim()) user.password = password.trim();
    if (assignedDepartment !== undefined) user.assignedDepartment = assignedDepartment;
    if (assignedKitchenId !== undefined) user.assignedKitchenId = assignedKitchenId;

    await user.save();
    
    // Synchronize to SuperAdmin central staffAccounts
    await syncStaffToSuperAdmin(req, User);

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
    if (req.user?._id && user._id.toString() === req.user._id.toString()) {
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

    // Synchronize to SuperAdmin central staffAccounts (removes deleted user)
    await syncStaffToSuperAdmin(req, User);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};
