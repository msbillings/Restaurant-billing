import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { encryptBackup, decryptBackup } from '../../utils/cryptoUtil.js';

const statusesCaptured = [];
const saveSpy = jest.fn(function() {
  statusesCaptured.push(this.status);
  return Promise.resolve(this);
});

class MockBackupLog {
  constructor(data) { Object.assign(this, data); }
  save = saveSpy;
}
MockBackupLog.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) });
MockBackupLog.findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
MockBackupLog.deleteOne = jest.fn().mockResolvedValue({});

jest.unstable_mockModule('../../models/BackupLog.js', () => ({ default: MockBackupLog }));

const mockClient = {
  find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([{ databaseName: 'tenantA' }]) }) }),
  findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ databaseName: 'tenantA', status: 'Active' }) }) })
};
jest.unstable_mockModule('../../models/Client.js', () => ({ default: mockClient }));

const mockStorageProvider = {
  isStorageEnabled: jest.fn().mockReturnValue(true),
  putObject: jest.fn().mockResolvedValue({}),
  headObject: jest.fn().mockResolvedValue({}),
  getObject: jest.fn().mockResolvedValue(Buffer.from('mock')),
  deleteObject: jest.fn().mockResolvedValue({})
};
jest.unstable_mockModule('../../utils/storageProvider.js', () => mockStorageProvider);

const mockTenantManager = {
  getTenantModels: jest.fn()
};
jest.unstable_mockModule('../../utils/tenantManager.js', () => mockTenantManager);

const { performBackup } = await import('../../utils/backupManager.js');
const { restoreTenant } = await import('../../utils/restoreManager.js');
const { migrateLocalBackups } = await import('../../utils/backupMigration.js');

describe('Phase 8: Durable Object Storage Backup', () => {
  const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let mockModels;

  beforeAll(() => {
    process.env.BACKUP_ENCRYPTION_KEY = TEST_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    saveSpy.mockClear();
    statusesCaptured.length = 0;

    process.env.OBJECT_STORAGE_ENDPOINT = 'mock-endpoint';
    process.env.OBJECT_STORAGE_BUCKET = 'mock-bucket';

    mockStorageProvider.isStorageEnabled.mockReturnValue(true);
    mockStorageProvider.putObject.mockResolvedValue({});
    mockStorageProvider.headObject.mockResolvedValue({});
    mockStorageProvider.getObject.mockResolvedValue(Buffer.from('mock'));
    mockStorageProvider.deleteObject.mockResolvedValue({});

    mongoose.connection.readyState = 1;

    mockClient.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ databaseName: 'tenantA' }])
      })
    });

    mockClient.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ databaseName: 'tenantA', status: 'Active' })
      })
    });

    const mockDoc = { _id: '123', name: 'Test' };
    const mockModel = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([mockDoc]) }) }),
      countDocuments: jest.fn().mockResolvedValue(0),
      insertMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({})
    };

    mockModels = { Menu: mockModel };
    mockTenantManager.getTenantModels.mockResolvedValue(mockModels);

    MockBackupLog.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([])
      })
    });
    MockBackupLog.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null)
    });
    MockBackupLog.deleteOne.mockResolvedValue({});

    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from(''));
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Backup Lifecycle', () => {
    it('A, B: Should create BackupLog and go through STARTED -> COMPLETED lifecycle', async () => {
      const summary = await performBackup();
      expect(summary.successful).toBe(1);

      const saveCalls = saveSpy.mock.invocationCallOrder;
      expect(saveCalls.length).toBeGreaterThanOrEqual(6);

      expect(statusesCaptured).toContain('STARTED');
      expect(statusesCaptured).toContain('GENERATING');
      expect(statusesCaptured).toContain('ENCRYPTED');
      expect(statusesCaptured).toContain('UPLOADING');
      expect(statusesCaptured).toContain('VERIFIED');
      expect(statusesCaptured).toContain('COMPLETED');
    });

    it('C: failed generation', async () => {
      mockTenantManager.getTenantModels.mockRejectedValueOnce(new Error('Generation failed'));
      const summary = await performBackup();
      expect(summary.failed).toBe(1);
      expect(statusesCaptured).toContain('FAILED_GENERATION');
    });

    it('D: failed upload', async () => {
      mockStorageProvider.putObject.mockRejectedValueOnce(new Error('Upload error'));
      const summary = await performBackup();
      expect(summary.failed).toBe(1);
      expect(statusesCaptured).toContain('FAILED_UPLOAD');
    });

    it('E: failed verification', async () => {
      mockStorageProvider.headObject.mockRejectedValueOnce(new Error('Verification error'));
      const summary = await performBackup();
      expect(summary.failed).toBe(1);
      expect(statusesCaptured).toContain('FAILED_VERIFICATION');
    });

    it('R: opaque object key does not expose tenant', async () => {
      await performBackup();
      const logInstance = saveSpy.mock.instances[0];
      expect(logInstance.objectKey).toMatch(/^backups\/\d{4}-\d{2}-\d{2}\/[0-9a-fA-F-]+\.enc$/);
      expect(logInstance.objectKey).not.toContain('tenantA');
    });

    it('S: plaintext never uploaded', async () => {
      await performBackup();
      const putCall = mockStorageProvider.putObject.mock.calls[0];
      const uploadedBuffer = putCall[1];
      expect(Buffer.isBuffer(uploadedBuffer)).toBe(true);
      expect(() => JSON.parse(uploadedBuffer.toString())).toThrow();
    });

    it('T: storage configuration missing does not crash application startup (fails safely)', async () => {
      mockStorageProvider.isStorageEnabled.mockReturnValue(false);
      const summary = await performBackup();
      expect(summary.failed).toBe(0);
      expect(summary.discovered).toBe(0); // Exits early
    });
  });

  describe('Restore Boundary Enforcement', () => {
    let validEncryptedBuffer;

    beforeEach(() => {
      const payloadData = { Menu: [{ _id: '123', name: 'Test' }] };
      const metadata = {
        tenantId: 'tenantA',
        checksum: crypto.createHash('sha256').update(JSON.stringify(payloadData)).digest('hex'),
        collections: { Menu: { count: 1 } }
      };
      validEncryptedBuffer = encryptBackup(JSON.stringify({ metadata, data: payloadData }));
      mockStorageProvider.getObject.mockResolvedValue(validEncryptedBuffer);

      MockBackupLog.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ status: 'COMPLETED', tenantId: 'tenantA', objectKey: 'key' })
      });
      fs.existsSync.mockReturnValue(false);
    });

    it('F: restore with matching tenant (PASS)', async () => {
      mockModels.Menu.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      const res = await restoreTenant('backup-id', 'tenantA');
      expect(res.successful).toBe(1);
    });

    it('G: restore with mismatched tenant (FAIL CLOSED)', async () => {
      await expect(restoreTenant('backup-id', 'tenantB')).rejects.toThrow(/tenant identity does not match/i);
    });

    it('H: restore with missing tenant metadata (FAIL CLOSED)', async () => {
      const badPayloadData = { Menu: [] };
      const badMetadata = { checksum: crypto.createHash('sha256').update(JSON.stringify(badPayloadData)).digest('hex') }; // missing tenantId
      const badEncryptedBuffer = encryptBackup(JSON.stringify({ metadata: badMetadata, data: badPayloadData }));
      mockStorageProvider.getObject.mockResolvedValue(badEncryptedBuffer);

      await expect(restoreTenant('backup-id', 'tenantA')).rejects.toThrow(/tenant identity does not match/i);
    });

    it('I: restore with BackupLog mismatch (FAIL CLOSED)', async () => {
      MockBackupLog.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ status: 'COMPLETED', tenantId: 'attackerTenant', objectKey: 'key' })
      });
      await expect(restoreTenant('backup-id', 'tenantA')).rejects.toThrow(/tenant identity does not match/i);
    });

    it('J: zero writes on restore validation failure', async () => {
      try {
        await restoreTenant('backup-id', 'tenantB');
      } catch (err) {}
      expect(mockModels.Menu.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('Retention', () => {
    it('K, L: retention keeps newest 7 and only considers COMPLETED', async () => {
      const mockLogs = Array.from({ length: 10 }, (_, i) => ({
        _id: `id_${i}`,
        backupId: `b_${i}`,
        objectKey: `key_${i}`,
        status: 'COMPLETED'
      }));

      MockBackupLog.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockLogs)
        })
      });

      await performBackup();

      expect(mockStorageProvider.deleteObject).toHaveBeenCalledTimes(3);
      expect(MockBackupLog.deleteOne).toHaveBeenCalledTimes(3);
    });

    it('M, N: failed object deletion preserves BackupLog, successful object deletion removes BackupLog', async () => {
      const logsOverLimit = Array.from({ length: 9 }, (_, i) => ({
        _id: `id_${i}`, backupId: `b_${i}`, objectKey: `key_${i}`, status: 'COMPLETED'
      }));

      MockBackupLog.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(logsOverLimit)
        })
      });

      mockStorageProvider.deleteObject.mockRejectedValueOnce(new Error('S3 fail')).mockResolvedValueOnce({});

      await performBackup();

      expect(mockStorageProvider.deleteObject).toHaveBeenCalledTimes(2);
      expect(MockBackupLog.deleteOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('Migration', () => {
    let mockFileBuffer;

    beforeEach(() => {
      const payloadData = { Menu: [] };
      const metadata = {
        backupId: 'migrated-backup',
        tenantId: 'tenantA',
        createdAt: new Date().toISOString(),
        checksum: crypto.createHash('sha256').update(JSON.stringify(payloadData)).digest('hex'),
        collections: {}
      };
      mockFileBuffer = encryptBackup(JSON.stringify({ metadata, data: payloadData }));

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['backup_123.enc']);
      fs.readFileSync.mockReturnValue(mockFileBuffer);
      fs.renameSync.mockImplementation(() => {});
    });

    it('O: migration success', async () => {
      await migrateLocalBackups();
      expect(mockStorageProvider.putObject).toHaveBeenCalled();
      expect(mockStorageProvider.headObject).toHaveBeenCalled();
      expect(fs.renameSync).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('.migrated'));
      expect(statusesCaptured).toContain('COMPLETED');
    });

    it('P: migration failure preserves local file', async () => {
      mockStorageProvider.putObject.mockRejectedValueOnce(new Error('Upload fail'));
      await migrateLocalBackups();
      expect(fs.renameSync).not.toHaveBeenCalled();
    });

    it('Q: migration idempotency', async () => {
      const datePrefix = new Date().toISOString().split('T')[0];
      MockBackupLog.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ status: 'COMPLETED', objectKey: `backups/${datePrefix}/migrated-backup.enc`, save: saveSpy })
      });
      mockStorageProvider.headObject.mockResolvedValue({});

      await migrateLocalBackups();

      expect(mockStorageProvider.putObject).not.toHaveBeenCalled();
      expect(fs.renameSync).toHaveBeenCalled();
    });
  });
});
