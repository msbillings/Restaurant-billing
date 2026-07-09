// Simple in-memory cache for frequently accessed data
// This helps reduce database load for 150+ orders/day scenarios

const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds cache

const getCacheKey = (prefix, ...args) => {
  return `${prefix}:${args.join(':')}`;
};

const get = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  
  // Check if expired
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
};

const set = (key, value, ttl = CACHE_TTL) => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl
  });
};

const clear = (pattern) => {
  if (!pattern) {
    cache.clear();
    return;
  }
  
  // Clear keys matching pattern
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
};

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of cache.entries()) {
    if (now > item.expiresAt) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export default {
  get,
  set,
  clear,
  getCacheKey
};

