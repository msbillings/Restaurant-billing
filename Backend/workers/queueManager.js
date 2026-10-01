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
export const WhatsAppQueue = new Queue('WhatsAppQueue', { connection });

// 2. Report Generation Queue
// Handles heavy CPU tasks like generating CSVs, Excel, or PDF reports
export const ReportQueue = new Queue('ReportQueue', { connection });

console.log('[QueueManager] Queues initialized (WhatsAppQueue, ReportQueue)');
