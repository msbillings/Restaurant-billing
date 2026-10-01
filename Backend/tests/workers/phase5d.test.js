import { jest } from '@jest/globals';
import mongoose from 'mongoose';

jest.unstable_mockModule('bullmq', () => {
  class UnrecoverableError extends Error {
    constructor(message) {
      super(message);
      this.name = 'UnrecoverableError';
    }
  }
  return {
    Worker: class Worker {
      constructor(name, processor, opts) {
        this.name = name;
        this.processor = processor;
        this.opts = opts;
        this.handlers = {};
      }
      on(event, handler) {
        this.handlers[event] = handler;
      }
      emitFailed(job, err) {
        if (this.handlers['failed']) {
          this.handlers['failed'](job, err);
        }
      }
    },
    Queue: class Queue {
      constructor(name, opts) {
        this.name = name;
        this.add = jest.fn().mockResolvedValue({ id: 'new-job-id' });
      }
    },
    UnrecoverableError
  };
});

jest.unstable_mockModule('ioredis', () => ({
  default: class Redis {}
}));

// Mock dlqManager dependencies
const mockAcquireLock = jest.fn().mockResolvedValue('fake-lock-token');
const mockReleaseLock = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  default: {
    acquireLock: mockAcquireLock,
    releaseLock: mockReleaseLock
  }
}));

const mockFindOneAndUpdate = jest.fn();
const mockFindById = jest.fn();
const mockUpdateOne = jest.fn();

const mockDeadLetterJob = {
  findOneAndUpdate: mockFindOneAndUpdate,
  findById: mockFindById,
  updateOne: mockUpdateOne
};

jest.unstable_mockModule('../../utils/tenantManager.js', () => ({
  getMasterModels: jest.fn().mockResolvedValue({ DeadLetterJob: mockDeadLetterJob })
}));

describe('Phase 5D: Dead Letter Queue & Replay', () => {
  let dlqManager;
  let tenantManager;
  let redisClient;
  let queueManager;

  beforeAll(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    dlqManager = await import('../../utils/dlqManager.js');
    tenantManager = await import('../../utils/tenantManager.js');
    redisClient = (await import('../../utils/redisClient.js')).default;
    queueManager = await import('../../workers/queueManager.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test A, B, C, D
  it('writes failed job to DLQ in master DB after final retry', async () => {
    const job = { id: 'job-1', name: 'process', opts: { attempts: 3 }, attemptsMade: 3, data: { tenantDb: 'tenant_1' } };
    const err = new Error('Random transient error that exhausted retries');

    await dlqManager.handleFailedJob('WhatsAppQueue', job, err);

    expect(tenantManager.getMasterModels).toHaveBeenCalled();
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { originalQueue: 'WhatsAppQueue', originalJobId: 'job-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          tenantDb: 'tenant_1',
          failureReason: 'Random transient error that exhausted retries'
        })
      }),
      expect.any(Object)
    );
  });

  it('redacts sensitive credentials but preserves useful context (E)', async () => {
    const { default: DLQModel, redactSensitiveData } = await import('../../models/DeadLetterJob.js');
    const doc = new DLQModel({
      originalQueue: 'Q', originalJobId: '1', jobName: 'J', tenantDb: 'T',
      payload: { secret_token: '123', password: 'abc', normal: 'data' },
      failureReason: 'Failed connecting to redis://password@localhost and my secret is 123'
    });

    // Simulate save hook
    doc.isModified = () => true;
    await new Promise(resolve => redactSensitiveData.call(doc, resolve));

    expect(doc.failureReason).toBe('Failed connecting to redis://***@localhost and my secret is ***');
    expect(doc.payload.secret_token).toBe('[REDACTED]');
    expect(doc.payload.password).toBe('[REDACTED]');
    expect(doc.payload.normal).toBe('data');
  });

  it('replay loads tenantDb from DLQ record and creates new job safely (F, G, H, I)', async () => {
    mockFindById.mockResolvedValue({
      _id: 'dlq-1',
      tenantDb: 'tenant_1',
      originalJobId: 'job-1',
      originalQueue: 'WhatsAppQueue',
      jobName: 'whatsapp',
      payload: { phone: '123' },
      replayCount: 0,
      maxReplays: 3
    });

    const result = await dlqManager.replayDeadLetterJob('dlq-1');

    expect(mockAcquireLock).toHaveBeenCalledWith('dlq:replay:tenant_1:job-1', 30);

    const targetQueue = queueManager.WhatsAppQueue;
    expect(targetQueue.add).toHaveBeenCalledWith('whatsapp', expect.objectContaining({
      phone: '123',
      tenantDb: 'tenant_1', // forced override
      _replayedFrom: 'dlq-1',
      _replayAttempt: 1
    }));

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'dlq-1' },
      expect.objectContaining({
        $set: { status: 'REPLAY_QUEUED' },
        $inc: { replayCount: 1 }
      })
    );
    expect(result.success).toBe(true);
  });

  it('successful replayed job transitions DLQ to REPLAYED (C)', async () => {
    const job = { id: 'job-2', data: { _replayedFrom: 'dlq-1' } };
    await dlqManager.handleReplayedJobSuccess(job);

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'dlq-1' },
      { $set: { status: 'REPLAYED' } }
    );
  });

  it('failed replayed job does not transition to REPLAYED but updates metadata (D)', async () => {
    const job = { id: 'job-2', opts: { attempts: 1 }, attemptsMade: 1, data: { tenantDb: 'tenant_1', _replayedFrom: 'dlq-1', _replayAttempt: 2 } };
    const err = new Error('Replay failed again');

    await dlqManager.handleFailedJob('WhatsAppQueue', job, err);

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'dlq-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'FAILED' }),
        $push: { metadata: { failedReplayAttempt: 2, reason: 'Replay failed again' } }
      })
    );
  });

  it('replay blocks excessive replays (J)', async () => {
    const mockSave = jest.fn();
    mockFindById.mockResolvedValue({
      _id: 'dlq-1',
      tenantDb: 'tenant_1',
      originalJobId: 'job-1',
      replayCount: 3,
      maxReplays: 3,
      save: mockSave
    });

    await expect(dlqManager.replayDeadLetterJob('dlq-1')).rejects.toThrow('DeadLetterJob has exceeded replay limits or is blocked.');
    expect(mockSave).toHaveBeenCalled();
  });

  it('concurrent replay protects duplicates (K)', async () => {
    mockFindById.mockResolvedValue({
      _id: 'dlq-1', tenantDb: 'tenant_1', originalJobId: 'job-1', replayCount: 0, maxReplays: 3
    });
    mockAcquireLock.mockResolvedValueOnce(null); // Lock failed

    await expect(dlqManager.replayDeadLetterJob('dlq-1')).rejects.toThrow('DeadLetterJob replay is already in progress.');
  });
});
