import Redis from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config();

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // good practice for some queues
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  redisClient.on('connect', () => {
    console.log('✅ Connected to Redis (SuperAdmin)');
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis Connection Error:', err);
  });
} else {
  console.warn('⚠️ No REDIS_URL found in environment variables. Redis is disabled.');
}

export default redisClient;
