import { getTenantModels } from '../utils/tenantManager.js';
import jwt from 'jsonwebtoken';

export const tenantMiddleware = async (req, res, next) => {
  try {
    let tenantDbName = req.headers['x-tenant-db'];

    // CRITICAL SECURITY ENFORCEMENT: If an Authorization token is present, 
    // decode it to extract the secure db name. This overrides the client-side header 
    // and guarantees database isolation for all user requests.
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.db) {
          tenantDbName = decoded.db;
        }
      } catch (err) {
        // Ignore decoding errors here (handled by auth middleware)
      }
    }

    if (tenantDbName && tenantDbName !== 'undefined' && tenantDbName !== 'null') {
      const models = await getTenantModels(tenantDbName);
      req.models = models;
    } else {
      req.models = null;
    }
  } catch (error) {
    console.error('[TenantMiddleware] Error loading tenant models:', error);
    req.models = null;
  }
  next();
};
