/**
 * STRICT MULTI-TENANT MODEL RESOLVER
 * 
 * This utility ensures that every controller request is routed to the correct
 * tenant database. On cloud (Render/Vercel), if no tenant is resolved, the
 * request is REJECTED — never silently falling back to a shared default database.
 * 
 * On local Desktop (.exe), the default model IS the correct tenant (because the
 * local backend connects to a single tenant DB via client-config.json).
 */

const isCloud = () => {
  return !!(process.env.RENDER || process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production');
};

/**
 * Get a tenant-scoped model. If running on cloud and no tenant is resolved,
 * throws an error that the controller should catch and return 400.
 * 
 * @param {Object} req - Express request object
 * @param {string} modelName - Name of the model (e.g., 'Bill', 'Menu', 'User')
 * @param {Object} DefaultModel - The default Mongoose model (fallback for local Desktop)
 * @returns {Object} The tenant-scoped Mongoose model
 */
export const getTenantModel = (req, modelName, DefaultModel) => {
  // If tenant middleware resolved models, use them (this is the happy path)
  if (req.models && req.models[modelName]) {
    return req.models[modelName];
  }

  // On local Desktop .exe, the default model IS the correct tenant
  // because server.js connects to a single tenant DB via client-config.json
  if (!isCloud()) {
    return DefaultModel;
  }

  // On cloud with no tenant resolved — this is a DATA LEAK scenario.
  // REJECT the request instead of silently using the shared default database.
  const error = new Error(`Tenant database not resolved. Cannot serve request without tenant isolation.`);
  error.code = 'TENANT_NOT_RESOLVED';
  error.status = 400;
  throw error;
};

/**
 * Middleware-style error handler for tenant resolution failures.
 * Use this in catch blocks to send a proper error response.
 */
export const handleTenantError = (error, res) => {
  if (error.code === 'TENANT_NOT_RESOLVED') {
    return res.status(400).json({ 
      message: 'Database isolation error: Your session could not be linked to a restaurant. Please log out and log in again.',
      code: 'TENANT_NOT_RESOLVED'
    });
  }
  // Re-throw if not a tenant error
  throw error;
};
