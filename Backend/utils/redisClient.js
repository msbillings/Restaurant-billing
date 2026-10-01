import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  constructor() {
    this.pubClient = null;
    this.subClient = null;
  }

  async connect() {
    try {
      this.pubClient = createClient({ url: REDIS_URL });
      this.subClient = this.pubClient.duplicate();

      // Handle errors so the server doesn't crash on connection failure
      this.pubClient.on('error', (err) => {
        // Just suppress errors for local/desktop usage without Redis
      });
      this.subClient.on('error', (err) => {
        // Just suppress errors for local/desktop usage without Redis
      });

      // Try connecting with a very short timeout so it fails fast locally
      await Promise.race([
        Promise.all([this.pubClient.connect(), this.subClient.connect()]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
      ]);
      console.log('Redis connected successfully');
    } catch (err) {
      this.pubClient = null;
      this.subClient = null;
    }
  }
}

export default new RedisClient();
