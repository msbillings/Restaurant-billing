import { createClient } from 'redis';

import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

class RedisManager {
  constructor() {
    this.client = null;
    this.pubClient = null;
    this.subClient = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    try {
      this.client = createClient({ url: REDIS_URI });

      // Setup dedicated clients for Socket.IO adapter
      this.pubClient = this.client.duplicate();
      this.subClient = this.client.duplicate();

      const handleReady = () => { this.isConnected = true; };
      const handleError = (err) => {
        this.isConnected = false;
        console.error('[Redis] Client Error:', err.message);
      };
      const handleEnd = () => { this.isConnected = false; };

      this.client.on('ready', handleReady);
      this.client.on('error', handleError);
      this.client.on('end', handleEnd);

      this.pubClient.on('error', (err) => console.error('[Redis] PubClient Error:', err.message));
      this.subClient.on('error', (err) => console.error('[Redis] SubClient Error:', err.message));

      await Promise.all([
        this.client.connect(),
        this.pubClient.connect(),
        this.subClient.connect()
      ]);

      this.isConnected = true;
      console.log(`[Redis] Successfully connected to Redis`);
    } catch (error) {
      console.error('[Redis] Initial connection failed:', error.message);
      // We don't throw here to allow the app to fallback to no-cache mode if Redis is down
    }
  }

  // Graceful shutdown
  async disconnect() {
    try {
      await Promise.all([
        this.client?.quit(),
        this.pubClient?.quit(),
        this.subClient?.quit()
      ]);
      this.isConnected = false;
      console.log('[Redis] Disconnected gracefully');
    } catch (err) {
      console.error('[Redis] Disconnect error:', err.message);
    }
  }

  // Helper for caching
  async getOrSetCache(key, fetchCallback, ttlSeconds = 3600) {
    if (!this.isConnected || !this.client) {
      // Fallback: If Redis is down, just fetch from DB
      return await fetchCallback();
    }

    try {
      const cached = await this.client.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      const freshData = await fetchCallback();
      // Only cache valid data
      if (freshData) {
        await this.client.setEx(key, ttlSeconds, JSON.stringify(freshData));
      }
      return freshData;
    } catch (err) {
      console.warn(`[Redis] Cache error for key ${key}:`, err.message);
      return await fetchCallback();
    }
  }

  async invalidateCache(keyPattern) {
    if (!this.isConnected || !this.client) return;
    try {
      // Use SCAN in production, but KEYS is okay for targeted small sweeps or single keys
      const keys = await this.client.keys(keyPattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`[Redis] Invalidated cache keys matching pattern`);
      }
    } catch (err) {
      console.warn(`[Redis] Invalidation error:`, err.message);
    }
  }

  // Helper for distributed cron locking
  async acquireLock(lockName, ttlSeconds = 60) {
    if (!this.isConnected || !this.client) {
      if (process.env.ALLOW_LOCAL_REDIS_FALLBACK === 'true') {
        return 'local-fallback-token';
      }
      console.warn(`[Redis] Lock acquisition failed: Redis unavailable and fallback not explicitly allowed`);
      return false;
    }

    try {
      const lockToken = crypto.randomUUID();
      const result = await this.client.set(lockName, lockToken, {
        NX: true,
        EX: ttlSeconds
      });
      return result === 'OK' ? lockToken : false;
    } catch (err) {
      console.error(`[Redis] Error acquiring lock:`, err.message);
      return false; // Safely fail to prevent double execution if error occurs
    }
  }

  async releaseLock(lockName, lockToken) {
    if (!this.isConnected || !this.client) return;
    if (lockToken === 'local-fallback-token') return;

    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
      `;
      await this.client.eval(script, {
        keys: [lockName],
        arguments: [lockToken]
      });
    } catch (err) {
      console.error(`[Redis] Error releasing lock:`, err.message);
    }
  }
}

const redisManager = new RedisManager();
export default redisManager;
