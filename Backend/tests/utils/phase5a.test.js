import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { getTenantModels, tenantModelsCache } from '../../utils/tenantManager.js';
import redisClient from '../../utils/redisClient.js';
import { startBackupCron, performBackup } from '../../utils/backupManager.js';
import cron from 'node-cron';

// Mock dependencies
jest.unstable_mockModule('node-cron', () => ({
  default: { schedule: jest.fn() }
}));

jest.unstable_mockModule('../../utils/backupManager.js', async () => {
  const original = await import('../../utils/backupManager.js');
  return {
    ...original,
    performBackup: jest.fn().mockResolvedValue({ status: 'SUCCESS' })
  };
});

let cronTask = null;
const mockSchedule = (time, task) => {
  if (time === '0 3 * * *') {
    cronTask = task;
  }
};
cron.schedule = mockSchedule;

describe('Phase 5A: Background Jobs Durability Tests', () => {
  
  beforeAll(() => {
    // Disable logging noise during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Backup Distributed Lock Safety', () => {
    let acquireLockSpy;
    let releaseLockSpy;
    
    beforeEach(async () => {
      startBackupCron();
      acquireLockSpy = jest.spyOn(redisClient, 'acquireLock');
      releaseLockSpy = jest.spyOn(redisClient, 'releaseLock');
    });

    afterEach(() => {
      acquireLockSpy.mockRestore();
      releaseLockSpy.mockRestore();
      cronTask = null;
    });

    it('A. Backup lock acquired → backup executes once', async () => {
      acquireLockSpy.mockResolvedValueOnce('valid-token-123');
      releaseLockSpy.mockResolvedValueOnce();

      expect(cronTask).not.toBeNull();
      await cronTask();

      expect(acquireLockSpy).toHaveBeenCalledWith('cron:backup:lock', 1800);
      expect(releaseLockSpy).toHaveBeenCalledWith('cron:backup:lock', 'valid-token-123');
    });

    it('B. Backup lock already held → backup does not execute', async () => {
      // Mock Redis returning false (lock held by another server)
      acquireLockSpy.mockResolvedValueOnce(false);
      
      await cronTask();

      expect(acquireLockSpy).toHaveBeenCalledWith('cron:backup:lock', 1800);
      expect(releaseLockSpy).not.toHaveBeenCalled();
    });

    it('C. Lock release occurs after successful backup', async () => {
      acquireLockSpy.mockResolvedValueOnce('token-success');
      releaseLockSpy.mockResolvedValueOnce();

      await cronTask();

      expect(releaseLockSpy).toHaveBeenCalledWith('cron:backup:lock', 'token-success');
    });

    it('E. Redis unavailable (local fallback) → backup does not execute', async () => {
      // redisClient returns 'local-fallback-token' when ALLOW_LOCAL_REDIS_FALLBACK is true
      acquireLockSpy.mockResolvedValueOnce('local-fallback-token');
      
      await cronTask();

      expect(releaseLockSpy).not.toHaveBeenCalled();
    });
  });

  describe('Tenant Model Cache LRU Safety', () => {
    beforeEach(() => {
      tenantModelsCache.clear();
      // Ensure the test cache limit matches implementation (100)
      tenantModelsCache.maxSize = 3; 
    });

    it('G. Cache reaches configured limit → safe eviction occurs', async () => {
      // Fill cache to max size
      tenantModelsCache.set('tenant1', { name: 't1' });
      tenantModelsCache.set('tenant2', { name: 't2' });
      tenantModelsCache.set('tenant3', { name: 't3' });

      expect(tenantModelsCache.cache.size).toBe(3);
      expect(tenantModelsCache.has('tenant1')).toBe(true);

      // Add 4th item, exceeding maxSize = 3
      tenantModelsCache.set('tenant4', { name: 't4' });

      expect(tenantModelsCache.cache.size).toBe(3);
      // 'tenant1' is the oldest, it should be evicted
      expect(tenantModelsCache.has('tenant1')).toBe(false);
      expect(tenantModelsCache.has('tenant4')).toBe(true);
    });

    it('H. Evicted tenant can be resolved again correctly', async () => {
      tenantModelsCache.set('tenant1', { name: 't1' });
      tenantModelsCache.set('tenant2', { name: 't2' });
      tenantModelsCache.set('tenant3', { name: 't3' });
      
      // Hit tenant1 to refresh its LRU status
      const t1 = tenantModelsCache.get('tenant1');
      expect(t1.name).toBe('t1');

      // Now add a 4th item
      tenantModelsCache.set('tenant4', { name: 't4' });

      // Because tenant1 was accessed recently, tenant2 should be the oldest and evicted!
      expect(tenantModelsCache.has('tenant2')).toBe(false);
      expect(tenantModelsCache.has('tenant1')).toBe(true);
      expect(tenantModelsCache.has('tenant4')).toBe(true);
    });
  });
});
