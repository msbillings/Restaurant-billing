import UserDefault from '../models/User.js';
import SettingDefault from '../models/Setting.js';
import jwt from 'jsonwebtoken';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';

export const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    // PURE MULTI-TENANT: The tenant middleware has already resolved the correct
    // database from the X-Tenant-DB header (set during license activation) or
    // from the JWT token. We NEVER hardcode username→database mappings.
    let User;
    try {
      User = getTenantModel(req, 'User', UserDefault);
    } catch (err) {
      return handleTenantError(err, res);
    }

    // The database name comes from the resolved tenant connection
    const databaseName = req.models?.connection?.name || req.headers['x-tenant-db'] || '';
    const licenseKey = req.headers['x-license-key'] || '';

    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userId = user._id.toString();


    // Check current active sessions
    // Filter out expired sessions first (optional cleanup)
    // user.activeSessions = user.activeSessions.filter(session => {
    //   // Add logic here if we wanted to auto-remove expired tokens, but we rely on JWT expiry
    //   return true; 
    // });

    // Clean up expired sessions first (check both access and refresh tokens)
    const now = new Date();
    user.activeSessions = user.activeSessions.filter(session => {
      try {
        // Check if access token is expired
        const accessDecoded = jwt.decode(session.accessToken);
        if (!accessDecoded || accessDecoded.exp * 1000 < now.getTime()) {
          return false; // Remove expired access token session
        }

        // Also check if refresh token is expired
        const refreshDecoded = jwt.decode(session.refreshToken);
        if (!refreshDecoded || refreshDecoded.exp * 1000 < now.getTime()) {
          return false; // Remove expired refresh token session
        }

        return true;
      } catch (err) {
        return false; // Remove invalid sessions
      }
    });

    // Determine max concurrent logins from environment variables
    // Default: Unlimited (99999) for all roles so permanent accounts can login from ANY device simultaneously!
    const adminMaxLogins = parseInt(process.env.ADMIN_MAX_CONCURRENT_LOGINS || '99999', 10);
    const cashierMaxLogins = parseInt(process.env.CUSTOMER_MAX_CONCURRENT_LOGINS || '99999', 10);
    const captainMaxLogins = parseInt(process.env.CAPTAIN_MAX_CONCURRENT_LOGINS || '99999', 10);
    const maxLogins = user.role === 'Admin' ? adminMaxLogins : (user.role === 'Captain' ? captainMaxLogins : cashierMaxLogins);

    // Check if user has reached maximum concurrent login limit
    // This check is per-user, so different users can login simultaneously
    // User1 can login on device A, User2 can login on device B, etc.
    // But each user is limited to their max concurrent sessions
    if (user.activeSessions.length >= maxLogins) {
      return res.status(403).json({
        message: `Limited access for login: Maximum of ${maxLogins} device(s) allowed for ${user.role} users. Please logout from other devices to continue.`,
        maxLogins: maxLogins,
        currentSessions: user.activeSessions.length,
        role: user.role
      });
    }

    const accessToken = jwt.sign(
      { id: userId, role: user.role, db: databaseName },
      process.env.JWT_SECRET,
      { expiresIn: '3650d' }
    );

    const refreshToken = jwt.sign(
      { id: userId, role: user.role, db: databaseName },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '3650d' }
    );

    // Add new session to database
    user.activeSessions.push({
      accessToken,
      refreshToken,
      lastActive: new Date()
    });

    await user.save();

    // Fetch license expiry directly from settings collection as a backup/instant sync
    let licenseExpiry = '2026-07-12T23:59:59.000Z';
    try {
      const Setting = getTenantModel(req, 'Setting', SettingDefault);
      const expiryDoc = await Setting.findOne({ key: 'licenseExpiry' });
      if (expiryDoc && expiryDoc.value) {
        licenseExpiry = expiryDoc.value;
      }
    } catch (e) {
      console.warn('[Login] Failed to fetch licenseExpiry:', e.message);
    }

    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      },
      databaseName,
      licenseExpiry
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

export const logout = async (req, res) => {
  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    const userId = req.user.id || req.user._id;
    const token = req.headers['authorization']?.split(' ')[1];

    if (token && userId) {
      // Remove session from database
      const user = await User.findById(userId);
      if (user) {
        user.activeSessions = user.activeSessions.filter(
          session => session.accessToken !== token
        );
        await user.save();
      }
    }

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

export const logoutAll = async (req, res) => {
  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    const userId = req.user.id || req.user._id;

    if (userId) {
      // Remove all sessions from database
      const user = await User.findById(userId);
      if (user) {
        const sessionCount = user.activeSessions.length;
        user.activeSessions = [];
        await user.save();
        console.log(`Logged out ${sessionCount} sessions for user ${user.username}`);
      }
    }

    res.status(200).json({ message: 'All sessions logged out successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

export const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Refresh token expired. Please login again.' });
      }
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    // Check if user exists and has this refresh token in active sessions
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    // Find the session with this refresh token
    const sessionIndex = user.activeSessions.findIndex(s => s.refreshToken === token);

    if (sessionIndex === -1) {
      // Token reuse detection or valid token but session kicked/expired
      return res.status(403).json({ message: 'Invalid refresh token (session expired or logged out)' });
    }

    // Generate new access token — CRITICAL: Include db field for tenant isolation!
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role, db: decoded.db },
      process.env.JWT_SECRET,
      { expiresIn: '3650d' }
    );

    // Generate new refresh token — CRITICAL: Include db field for tenant isolation!
    const newRefreshToken = jwt.sign(
      { id: decoded.id, role: decoded.role, db: decoded.db },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '3650d' }
    );

    // Update the session with new tokens (Token Rotation)
    user.activeSessions[sessionIndex].accessToken = newAccessToken;
    user.activeSessions[sessionIndex].refreshToken = newRefreshToken;
    user.activeSessions[sessionIndex].lastActive = new Date();

    await user.save();

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    const { username } = req.body;
    const userId = req.user.id || req.user._id;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = username;
    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

export const register = async (req, res) => {
  const { username, password, role } = req.body;
  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    const user = new User({ username, password, role: role || 'Cashier' });
    await user.save();
    res.status(201).json({ message: 'User created successfully', user: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    if (req.params.id === req.user?.id) {
      return res.status(400).json({ message: 'Cannot delete your own admin account.' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Create admin user (public if no admin exists, protected if admins exist)
export const createAdmin = async (req, res) => {
  const { username, password } = req.body;

  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'Admin' });

    // If admin exists, require authentication and admin role
    if (existingAdmin) {
      // Check if user is authenticated (req.user should be set by middleware if auth passed)
      if (!req.user) {
        return res.status(401).json({ message: 'Access token required. An admin already exists.' });
      }

      // Check if user is an admin
      if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin access required to create additional admins.' });
      }
    }

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create admin user
    const adminUser = new User({
      username,
      password,
      role: 'Admin'
    });

    await adminUser.save();

    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: adminUser._id,
        username: adminUser.username,
        role: adminUser.role
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Setup initial admin (only works if no admin exists - for initial setup)
export const setupAdmin = async (req, res) => {
  const { username, password } = req.body;

  try {
    let User;
    try { User = getTenantModel(req, 'User', UserDefault); } catch (err) { return handleTenantError(err, res); }
    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'Admin' });
    if (existingAdmin) {
      return res.status(403).json({
        message: 'Admin user already exists. Use /api/auth/admin/create endpoint to create additional admins.'
      });
    }

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create initial admin user
    const adminUser = new User({
      username,
      password,
      role: 'Admin'
    });

    await adminUser.save();

    res.status(201).json({
      message: 'Initial admin user created successfully',
      user: {
        id: adminUser._id,
        username: adminUser.username,
        role: adminUser.role
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
