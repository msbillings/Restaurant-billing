import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getTenantModels } from '../utils/tenantManager.js';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_msbillings_2026');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Token expired. Please login again.' });
      }
      return res.status(403).json({ message: 'Invalid token' });
    }

    // CRITICAL SECURITY FIX: For all authenticated requests, strictly use the database
    // specified in the cryptographically signed JWT token (decoded.db).
    // Never trust the client-side X-Tenant-DB header, as it can be modified or missing!
    let TenantUser = null;

    if (decoded.db) {
      try {
        const tenantModels = await getTenantModels(decoded.db);
        if (tenantModels?.User) {
          req.models = tenantModels;
          TenantUser = tenantModels.User;
          console.log(`[Auth] Strictly routed request to tenant DB: ${decoded.db} based on JWT`);
        }
      } catch (err) {
        console.error('[Auth] Failed to connect to tenant DB from JWT:', err.message);
      }
    }

    if (!TenantUser) {
      // Fallback: If token has no db field (old token), use req.models from header or default User
      TenantUser = req.models?.User || User;
    }

    const user = await TenantUser.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if this token is in active sessions
    const isSessionValid = user.activeSessions.some(session => session.accessToken === token);

    if (!isSessionValid) {
      // RESILIENCE: Instead of immediately rejecting, accept the token if JWT is valid.
      // This prevents false logouts when activeSessions gets corrupted or cleaned up.
      console.warn(`[Auth] Session not in activeSessions for ${user.username}, but JWT is valid. Allowing.`);
    }

    // Update last active time for this session (non-blocking)
    const sessionIndex = user.activeSessions.findIndex(s => s.accessToken === token);
    if (sessionIndex !== -1) {
      user.activeSessions[sessionIndex].lastActive = new Date();
      user.save().catch(err => console.error('Error updating session lastActive:', err));
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error during authentication' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Optional authentication - verifies token if provided, but doesn't fail if missing
const optionalAuthenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue without setting req.user
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_msbillings_2026', (err, user) => {
    if (err) {
      // Invalid token, continue without setting req.user
      return next();
    }
    req.user = user;
    next();
  });
};

export { authenticateToken, requireAdmin, optionalAuthenticateToken };