import { jest } from '@jest/globals';
import mongoose from 'mongoose';

// Mock BullMQ completely to prevent Redis connections and provide UnrecoverableError
jest.unstable_mockModule('bullmq', () => {
  class UnrecoverableError extends Error {
    constructor(message) {
      super(message);
      this.name = 'UnrecoverableError';
    }
  }
  return {
    Worker: class Worker {},
    Queue: class Queue {
      constructor(name, opts) {
        this.name = name;
        this.defaultJobOptions = opts?.defaultJobOptions;
      }
    },
    UnrecoverableError
  };
});

// Mock Redis connection for QueueManager
jest.unstable_mockModule('ioredis', () => {
  return {
    default: class Redis {
      constructor() {}
    }
  };
});

// Mock whatsappService
const mockEnsureConnection = jest.fn();
const mockGetStatus = jest.fn().mockReturnValue({ status: 'CONNECTED', connectedNumber: '123' });
const mockSendBillMedia = jest.fn();
jest.unstable_mockModule('../../services/whatsappService.js', () => ({
  default: {
    getInstance: jest.fn().mockReturnValue({
      ensureConnection: mockEnsureConnection,
      getStatus: mockGetStatus,
      sendBillMedia: mockSendBillMedia,
      connectedNumber: '123'
    })
  }
}));

// Mock tenantManager
const mockBillModel = {
  findById: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(null),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
};
jest.unstable_mockModule('../../utils/tenantManager.js', () => ({
  getTenantModels: jest.fn().mockResolvedValue({ Bill: mockBillModel })
}));

// Mock redisClient
jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  default: {
    acquireLock: jest.fn(),
    releaseLock: jest.fn()
  }
}));

describe('Phase 5C: Queue Durability & Retention (Read-Only/Mocked)', () => {
  let WhatsAppQueue;
  let ReportQueue;
  let processWhatsAppJob;
  let tenantManager;
  let redisClient;
  let whatsappManager;
  let bullmq;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Dynamically import modules after mocks
    bullmq = await import('bullmq');
    tenantManager = await import('../../utils/tenantManager.js');
    redisClient = (await import('../../utils/redisClient.js')).default;
    whatsappManager = (await import('../../services/whatsappService.js')).default;
    const queueManager = await import('../../workers/queueManager.js');
    WhatsAppQueue = queueManager.WhatsAppQueue;
    ReportQueue = queueManager.ReportQueue;

    const workerModule = await import('../../workers/whatsappWorker.js');
    processWhatsAppJob = workerModule.processWhatsAppJob;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBillModel.findById.mockReturnThis();
    mockBillModel.lean.mockResolvedValue(null);
    mockBillModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  describe('Queue Configuration Tests', () => {
    test('WhatsAppQueue has finite attempts and exponential backoff configured', () => {
      const opts = WhatsAppQueue.defaultJobOptions;
      expect(opts).toBeDefined();
      expect(opts.attempts).toBe(5);
      expect(opts.backoff).toBeDefined();
      expect(opts.backoff.type).toBe('exponential');
      expect(opts.backoff.delay).toBe(5000);
    });

    test('ReportQueue has finite attempts and exponential backoff configured', () => {
      const opts = ReportQueue.defaultJobOptions;
      expect(opts).toBeDefined();
      expect(opts.attempts).toBe(3);
      expect(opts.backoff).toBeDefined();
      expect(opts.backoff.type).toBe('exponential');
      expect(opts.backoff.delay).toBe(10000);
    });

    test('WhatsAppQueue completed and failed job retention is bounded', () => {
      const opts = WhatsAppQueue.defaultJobOptions;
      expect(opts.removeOnComplete).toBeDefined();
      expect(opts.removeOnComplete.age).toBe(86400); // 24 hours
      expect(opts.removeOnFail).toBeDefined();
      expect(opts.removeOnFail.age).toBe(604800); // 7 days
    });

    test('ReportQueue completed and failed job retention is bounded', () => {
      const opts = ReportQueue.defaultJobOptions;
      expect(opts.removeOnComplete).toBeDefined();
      expect(opts.removeOnComplete.age).toBe(86400);
      expect(opts.removeOnFail).toBeDefined();
      expect(opts.removeOnFail.age).toBe(604800);
    });
  });

  describe('Worker Error Classification & Idempotency Tests', () => {
    test('Permanent error (missing tenantDb) throws UnrecoverableError and does not fall back to master', async () => {
      const job = {
        id: 'job-1',
        data: { tenantDb: 'default', phone: '123' }
      };

      await expect(processWhatsAppJob(job)).rejects.toThrow(bullmq.UnrecoverableError);
      expect(tenantManager.getTenantModels).not.toHaveBeenCalled();
    });

    test('Permanent error (missing Bill model) throws UnrecoverableError', async () => {
      const job = {
        id: 'job-2',
        data: { tenantDb: 'tenant_abc', phone: '123', billId: new mongoose.Types.ObjectId().toString() }
      };
      tenantManager.getTenantModels.mockResolvedValueOnce({ Bill: null });

      await expect(processWhatsAppJob(job)).rejects.toThrow(bullmq.UnrecoverableError);
    });

    test('Transient error (Redis lock failure) throws normal Error for retry', async () => {
      const billId = new mongoose.Types.ObjectId().toString();
      const job = {
        id: 'job-3',
        data: { tenantDb: 'tenant_abc', phone: '123', billId }
      };
      mockBillModel.lean.mockResolvedValueOnce({ whatsappSent: false });
      redisClient.acquireLock.mockResolvedValueOnce(null);

      await expect(processWhatsAppJob(job)).rejects.toThrow('Concurrent processing lock active');
      await expect(processWhatsAppJob(job)).rejects.not.toThrow(bullmq.UnrecoverableError);
    });

    test('Phase 5B idempotency prevents duplicate processing on retry', async () => {
      const billId = new mongoose.Types.ObjectId().toString();
      const job = {
        id: 'job-5',
        data: { tenantDb: 'tenant_abc', phone: '123', billId }
      };
      mockBillModel.lean.mockResolvedValueOnce({ whatsappSent: true });

      await processWhatsAppJob(job);

      expect(redisClient.acquireLock).not.toHaveBeenCalled();
      expect(whatsappManager.getInstance).not.toHaveBeenCalled();
    });
  });
});
