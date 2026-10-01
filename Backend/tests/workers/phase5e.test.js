import { jest } from '@jest/globals';

jest.unstable_mockModule('bullmq', () => ({
  Worker: class Worker {
    constructor() {}
    on() {}
  },
  Queue: class Queue {
    constructor(name) {
      this.name = name;
      this.add = jest.fn().mockResolvedValue({ id: 'new-job-id' });
    }
  },
  UnrecoverableError: class UnrecoverableError extends Error {
    constructor(msg) { super(msg); this.name = 'UnrecoverableError'; }
  }
}));

const mockAcquireLock = jest.fn();
const mockReleaseLock = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  default: {
    acquireLock: mockAcquireLock,
    releaseLock: mockReleaseLock
  }
}));

const mockFindById = jest.fn();
const mockUpdateOne = jest.fn();
const mockDeadLetterJob = {
  findById: mockFindById,
  updateOne: mockUpdateOne
};

jest.unstable_mockModule('../../utils/tenantManager.js', () => ({
  getMasterModels: jest.fn().mockResolvedValue({ DeadLetterJob: mockDeadLetterJob }),
  getTenantModels: jest.fn()
}));

describe('Phase 5E: End-to-End Background Job Durability', () => {
  let dlqManager;
  let queueManager;

  beforeAll(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    dlqManager = await import('../../utils/dlqManager.js');
    queueManager = await import('../../workers/queueManager.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('8. CROSS-TENANT SECURITY', () => {
    it('Restaurant A DLQ replay MUST inject Restaurant A tenantDb, absolutely ignoring any other context', async () => {
      mockFindById.mockResolvedValue({
        _id: 'dlq-restaurant-a',
        tenantDb: 'restaurant_A',
        originalJobId: 'job-1',
        originalQueue: 'WhatsAppQueue',
        jobName: 'whatsapp',
        payload: { phone: '123' },
        replayCount: 0,
        maxReplays: 3
      });
      mockAcquireLock.mockResolvedValue('fake-lock');

      await dlqManager.replayDeadLetterJob('dlq-restaurant-a');

      // Assert queue.add uses the DB-stored tenantDb
      const addSpy = queueManager.WhatsAppQueue.add;
      expect(addSpy).toHaveBeenCalledWith('whatsapp', expect.objectContaining({
        tenantDb: 'restaurant_A',
        _replayedFrom: 'dlq-restaurant-a'
      }));
    });

    it('Rejects replay if DLQ record has missing tenantDb', async () => {
      mockFindById.mockResolvedValue({
        _id: 'dlq-invalid',
        tenantDb: '', // missing
        originalJobId: 'job-1'
      });
      await expect(dlqManager.replayDeadLetterJob('dlq-invalid')).rejects.toThrow('Tenant database is missing from DLQ record.');
    });

    it('Rejects replay if DLQ record has default tenantDb', async () => {
      mockFindById.mockResolvedValue({
        _id: 'dlq-invalid',
        tenantDb: 'default', // explicit default
        originalJobId: 'job-1'
      });
      await expect(dlqManager.replayDeadLetterJob('dlq-invalid')).rejects.toThrow('Tenant database is missing from DLQ record.');
    });

    it('Rejects replay if DLQ record has null tenantDb', async () => {
      mockFindById.mockResolvedValue({
        _id: 'dlq-invalid',
        tenantDb: null,
        originalJobId: 'job-1'
      });
      await expect(dlqManager.replayDeadLetterJob('dlq-invalid')).rejects.toThrow('Tenant database is missing from DLQ record.');
    });
  });

  describe('9. REDIS FAILURE BEHAVIOR', () => {
    it('Fails safely when Redis is unavailable during lock acquisition (no silent corruption)', async () => {
      mockFindById.mockResolvedValue({
        _id: 'dlq-1',
        tenantDb: 'tenant_A',
        originalJobId: 'job-1',
        replayCount: 0,
        maxReplays: 3
      });

      // Simulate Redis being completely down
      mockAcquireLock.mockRejectedValue(new Error('Redis connection lost'));

      await expect(dlqManager.replayDeadLetterJob('dlq-1')).rejects.toThrow('Redis connection lost');

      // Ensure job was NOT enqueued
      expect(queueManager.WhatsAppQueue.add).not.toHaveBeenCalled();

      // Ensure DLQ status was NOT updated
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('Fails closed if lock is contented (returns null)', async () => {
      mockFindById.mockResolvedValue({
        _id: 'dlq-1',
        tenantDb: 'tenant_A',
        originalJobId: 'job-1',
        replayCount: 0,
        maxReplays: 3
      });

      mockAcquireLock.mockResolvedValue(null);

      await expect(dlqManager.replayDeadLetterJob('dlq-1')).rejects.toThrow('DeadLetterJob replay is already in progress.');
      expect(queueManager.WhatsAppQueue.add).not.toHaveBeenCalled();
    });
  });
});
