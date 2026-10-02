import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

// BullMQ natively prefers an ioredis connection instance
export const connection = new Redis(REDIS_URI, {
  maxRetriesPerRequest: null,
});

// 1. WhatsApp Dispatch Queue
// Handles sending PDFs/Images over WhatsApp via Baileys
export const WhatsAppQueue = new Queue('WhatsAppQueue', {
  prefix: process.env.BULLMQ_PREFIX || 'bull',
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000 // initial delay of 5 seconds
    },
    removeOnComplete: {
      age: 24 * 3600, // 24 hours
      count: 1000
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 7 days
      count: 5000
    }
  }
});

// 2. Report Generation Queue
// Handles heavy CPU tasks like generating CSVs, Excel, or PDF reports
export const ReportQueue = new Queue('ReportQueue', {
  prefix: process.env.BULLMQ_PREFIX || 'bull',
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000 // initial delay of 10 seconds
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 500
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 2000
    }
  }
});

console.log('[QueueManager] Queues initialized (WhatsAppQueue, ReportQueue)');
