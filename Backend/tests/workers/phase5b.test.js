import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import redisClient from '../../utils/redisClient.js';
import * as tenantManager from '../../utils/tenantManager.js';
import whatsappManager from '../../services/whatsappService.js';

// Mock BullMQ Worker and Queue
jest.unstable_mockModule('bullmq', () => ({
  Worker: class Worker {
    constructor() {
      this.on = jest.fn();
    }
  },
  Queue: class Queue {
    constructor() {
      this.add = jest.fn();
    }
  }
}));

// Mock tenantManager
let mockBillModel = {
  findById: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(null),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
};

jest.unstable_mockModule('../../utils/tenantManager.js', () => {
  return {
    getTenantModels: jest.fn().mockResolvedValue({ Bill: mockBillModel })
  };
});


// Mock whatsappManager
const mockSendBillMedia = jest.fn();
const mockEnsureConnection = jest.fn();
const mockGetStatus = jest.fn().mockReturnValue({ status: 'CONNECTED', connectedNumber: '1234567890' });

describe('Phase 5B: Background Jobs Idempotency', () => {
  let acquireLockSpy;
  let releaseLockSpy;

  let processWhatsAppJob;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const workerModule = await import('../../workers/whatsappWorker.js');
    processWhatsAppJob = workerModule.processWhatsAppJob;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockBillModel.findById.mockReturnThis();
    mockBillModel.lean.mockResolvedValue(null);
    mockBillModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
    
    jest.spyOn(whatsappManager, 'getInstance').mockReturnValue({
      ensureConnection: mockEnsureConnection,
      getStatus: mockGetStatus,
      sendBillMedia: mockSendBillMedia,
      connectedNumber: '1234567890'
    });
    
    acquireLockSpy = jest.spyOn(redisClient, 'acquireLock').mockResolvedValue('fake-token');
    releaseLockSpy = jest.spyOn(redisClient, 'releaseLock').mockResolvedValue(true);
    
    mockSendBillMedia.mockClear();
    mockEnsureConnection.mockClear();
    mockGetStatus.mockClear();
  });

  afterEach(() => {
    acquireLockSpy.mockRestore();
    releaseLockSpy.mockRestore();
  });

  it('1. duplicate WhatsApp job skips send if already whatsappSent', async () => {
    mockBillModel.lean.mockResolvedValueOnce({ _id: 'bill-1', whatsappSent: true });

    await processWhatsAppJob({
      id: 'job-1',
      data: { tenantDb: 'test-db', billId: 'bill-1', phone: '123' }
    });

    // It should check the DB and then return without acquiring lock or sending
    expect(mockBillModel.findById).toHaveBeenCalledWith('bill-1');
    expect(acquireLockSpy).not.toHaveBeenCalled();
    expect(mockSendBillMedia).not.toHaveBeenCalled();
  });

  it('2. concurrent duplicate jobs hit Redis lock and fail', async () => {
    acquireLockSpy.mockResolvedValueOnce(false); // Simulate lock held by another worker
    
    const promise = processWhatsAppJob({
      id: 'job-2',
      data: { tenantDb: 'test-db', billId: 'bill-1', phone: '123' }
    });

    await expect(promise).rejects.toThrow('Concurrent processing lock active for key whatsapp:bill:test-db:bill-1');
    expect(mockSendBillMedia).not.toHaveBeenCalled();
  });

  it('3. stale processing state (retries) correctly sends if whatsappSent is false', async () => {
    // DB returns false
    mockBillModel.lean.mockResolvedValueOnce({ _id: 'bill-1', whatsappSent: false });

    await processWhatsAppJob({
      id: 'job-3',
      data: { tenantDb: 'test-db', billId: 'bill-1', phone: '123' }
    });

    expect(acquireLockSpy).toHaveBeenCalledWith('whatsapp:bill:test-db:bill-1', 60);
    expect(mockSendBillMedia).toHaveBeenCalledTimes(1);
    expect(mockBillModel.updateOne).toHaveBeenCalledWith(
      { _id: 'bill-1' },
      { $set: expect.objectContaining({ whatsappSent: true }) }
    );
    expect(releaseLockSpy).toHaveBeenCalledWith('whatsapp:bill:test-db:bill-1', 'fake-token');
  });

  it('4. tenant isolation: missing tenant Db throws immediately', async () => {
    const promise = processWhatsAppJob({
      id: 'job-4',
      data: { phone: '123' } // No tenantDb
    });

    await expect(promise).rejects.toThrow('Missing or invalid tenantDb in job payload');
    expect(acquireLockSpy).not.toHaveBeenCalled();
  });

  it('5. crashes release the lock gracefully', async () => {
    // Simulate Baileys throw
    mockSendBillMedia.mockRejectedValueOnce(new Error('Network error'));

    await expect(processWhatsAppJob({
      id: 'job-5',
      data: { tenantDb: 'test-db', billId: 'bill-1', phone: '123' }
    })).rejects.toThrow('Network error');

    // Make sure lock was released in finally block
    expect(releaseLockSpy).toHaveBeenCalledWith('whatsapp:bill:test-db:bill-1', 'fake-token');
    // Ensure DB wasn't incorrectly updated
    expect(mockBillModel.updateOne).not.toHaveBeenCalled();
  });
});
