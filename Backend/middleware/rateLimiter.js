import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisManager from '../utils/redisClient.js';

const defaultMessage = {
  status: "error",
  message: "Too many requests. Please try again later."
};

const handler = (req, res, next, options) => {
  res.status(options.statusCode).json({
    ...defaultMessage,
    retryAfter: Math.ceil(options.windowMs / 1000)
  });
};

const createRedisStore = (prefix) => {
  return new RedisStore({
    sendCommand: async (...args) => {
      if (!redisManager.isConnected || !redisManager.client) {
        // Anti-fragility fix: If express-rate-limit calls SCRIPT LOAD before Redis connects,
        // it permanently breaks the store's internal loadedPromise. By returning a dummy SHA,
        // we force it to try EVALSHA later. When it does, Redis will return NOSCRIPT, and
        // rate-limit-redis will automatically heal itself by re-running SCRIPT LOAD on the fly.
        if (args[0] === 'SCRIPT' && args[1] === 'LOAD') {
          return 'dummy_sha';
        }
        throw new Error('RateLimiterStoreError');
      }
      return await redisManager.client.sendCommand(args);
    },
    prefix: prefix
  });
};

// 1. AUTH: 10 requests / 15 minutes, IP, FAIL CLOSED
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  store: createRedisStore('ratelimit:auth:ip:'),
  passOnStoreError: false, // FAIL CLOSED
});

// 2. PUBLIC: 60 requests / 1 minute, tenant + IP, FAIL OPEN
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: (req, res) => `${req.tenantDb || 'unknown'}:${ipKeyGenerator(req.ip)}`,
  store: createRedisStore('ratelimit:public:tenant:'),
  passOnStoreError: true, // FAIL OPEN
});

// 3. TENANT API: 300 requests / 1 minute, tenant + user, FAIL OPEN
export const tenantApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: (req, res) => {
    // Authenticated routes have req.user from JWT
    const userId = req.user && req.user.id ? req.user.id : (req.user && req.user.username ? req.user.username : ipKeyGenerator(req.ip));
    return `${req.tenantDb || 'unknown'}:${userId}`;
  },
  store: createRedisStore('ratelimit:api:tenant:'),
  passOnStoreError: true, // FAIL OPEN
});

// 4. ADMIN: 100 requests / 1 minute, tenant + user, FAIL OPEN
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: (req, res) => {
    const userId = req.user && req.user.id ? req.user.id : ipKeyGenerator(req.ip);
    return `${req.tenantDb || 'unknown'}:${userId}`;
  },
  store: createRedisStore('ratelimit:admin:tenant:'),
  passOnStoreError: true, // FAIL OPEN
});

// 5. WEBHOOK: 500 requests / 1 minute, tenant + IP/Source, FAIL OPEN
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: (req, res) => {
    if (req.webhookVerifiedTenant) {
      return `webhook:${req.webhookVerifiedTenant}:${ipKeyGenerator(req.ip)}`;
    }
    return `webhook:unverified:${ipKeyGenerator(req.ip)}`;
  },
  store: createRedisStore('ratelimit:webhook:tenant:'),
  passOnStoreError: true, // FAIL OPEN
});

// 6. HEALTH: 60 requests / 1 minute, IP, FAIL OPEN
export const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: (req, res) => ipKeyGenerator(req.ip),
  store: createRedisStore('ratelimit:health:ip:'),
  passOnStoreError: true, // FAIL OPEN
});

// Global error handler wrapper for auth fail closed
export const handleRateLimitError = (err, req, res, next) => {
  if (err.message === 'RateLimiterStoreError') {
    // Return generic response without leaking Redis details
    return res.status(503).json({
      status: "error",
      message: "Authentication service temporarily unavailable. Please try again later.",
      retryAfter: 60
    });
  }
  next(err);
};
