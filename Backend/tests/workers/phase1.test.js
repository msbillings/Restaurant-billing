import { jest } from '@jest/globals';

// 1. Mock dependencies
jest.unstable_mockModule('bullmq', () => {
  return {
    Worker: jest.fn().mockImplementation((queueName, processor, options) => {
      return {
        queueName,
        processor,
        options,
        on: jest.fn(),
        close: jest.fn()
      };
    }),
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn()
    }))
  };
});

jest.unstable_mockModule('../../workers/queueManager.js', () => ({
  connection: {},
  WhatsAppQueue: { add: jest.fn() },
  ReportQueue: { add: jest.fn() }
}));

jest.unstable_mockModule('../../utils/redisClient.js', () => {
  return {
    __esModule: true,
    default: {
      acquireLock: jest.fn(),
      releaseLock: jest.fn()
    }
  };
});

const mockGetTenantModels = jest.fn();
const mockBuildTenantClusterMap = jest.fn();

jest.unstable_mockModule('../../utils/tenantManager.js', () => {
  return {
    getTenantModels: mockGetTenantModels,
    buildTenantClusterMap: mockBuildTenantClusterMap
  };
});

const mockGetInstance = jest.fn().mockReturnValue({
  ensureConnection: jest.fn().mockResolvedValue(true),
  getStatus: jest.fn().mockReturnValue({ status: 'CONNECTED' }),
  connectedNumber: '12345',
  sendBillMedia: jest.fn().mockResolvedValue(true)
});

jest.unstable_mockModule('../../services/whatsappService.js', () => {
  return {
    __esModule: true,
    default: {
      getInstance: mockGetInstance
    }
  };
});

const mockCronSchedule = jest.fn();
jest.unstable_mockModule('node-cron', () => ({
  default: { schedule: mockCronSchedule },
  schedule: mockCronSchedule
}));

const mockReportCreate = jest.fn();
jest.unstable_mockModule('../../models/Report.js', () => ({
  __esModule: true,
  default: {
    create: mockReportCreate
  }
}));

describe('Phase 1 Implementation Tests', () => {
  let startWhatsAppWorker;
  let startReportWorker;
  let startWhatsAppScheduler;
  let ClientDefault;
  let redisClient;

  beforeAll(async () => {
    const ww = await import('../../workers/whatsappWorker.js');
    startWhatsAppWorker = ww.startWhatsAppWorker;

    const rw = await import('../../workers/reportWorker.js');
    startReportWorker = rw.startReportWorker;

    const ws = await import('../../utils/whatsappScheduler.js');
    startWhatsAppScheduler = ws.startWhatsAppScheduler;

    const cd = await import('../../models/Client.js');
    ClientDefault = cd.default;

    const rc = await import('../../utils/redisClient.js');
    redisClient = rc.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WhatsApp Worker (K-4)', () => {
    it('A. WhatsApp worker tenant isolation - Uses correct tenant Bill model', async () => {
      const mockBillModel = {
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
      };
      mockGetTenantModels.mockResolvedValue({ Bill: mockBillModel });

      const workerInstance = startWhatsAppWorker();
      const processor = workerInstance.processor;

      const mockJob = {
        id: 'job-123',
        data: {
          tenantDb: 'tenant_A',
          billId: 'bill-123',
          phone: '1234567890'
        }
      };

      await processor(mockJob);

      expect(mockGetTenantModels).toHaveBeenCalledWith('tenant_A');
      expect(mockBillModel.updateOne).toHaveBeenCalledWith(
        { _id: 'bill-123' },
        { $set: { isWhatsappSent: true } }
      );
    });

    it('C. Missing tenantDb - WhatsApp worker fails safely', async () => {
      const workerInstance = startWhatsAppWorker();
      const processor = workerInstance.processor;

      const mockJob = {
        id: 'job-124',
        data: {
          phone: '1234567890'
        }
      };

      await expect(processor(mockJob)).rejects.toThrow('Missing or invalid tenantDb in job payload');
      expect(mockGetTenantModels).not.toHaveBeenCalled();
    });

    it('D. Unknown tenantDb - WhatsApp worker fails safely', async () => {
      mockGetTenantModels.mockRejectedValue(new Error('FATAL: Could not resolve cluster'));

      const workerInstance = startWhatsAppWorker();
      const processor = workerInstance.processor;

      const mockJob = {
        id: 'job-125',
        data: {
          tenantDb: 'unknown_tenant',
          billId: 'bill-123'
        }
      };

      await expect(processor(mockJob)).rejects.toThrow('FATAL: Could not resolve cluster');
    });
  });

  describe('Report Worker (K-5)', () => {
    it('B. Report worker tenant isolation - Uses correct tenant Bill model', async () => {
      const mockBillModel = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };

      mockReportCreate.mockResolvedValue(true);
      mockGetTenantModels.mockResolvedValue({ Bill: mockBillModel });

      const workerInstance = startReportWorker();
      const processor = workerInstance.processor;

      const mockJob = {
        id: 'job-report-1',
        data: {
          tenantDb: 'tenant_B',
          type: 'CSV_DAILY',
          periodName: 'Test',
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        }
      };

      try {
        await processor(mockJob);
      } catch(e) {}

      expect(mockGetTenantModels).toHaveBeenCalledWith('tenant_B');
      expect(mockBillModel.find).toHaveBeenCalled();
    });

    it('C. Missing tenantDb - Report worker fails safely', async () => {
      const workerInstance = startReportWorker();
      const processor = workerInstance.processor;

      const mockJob = {
        id: 'job-report-2',
        data: {
          type: 'CSV_DAILY'
        }
      };

      await expect(processor(mockJob)).rejects.toThrow('Missing or invalid tenantDb in job payload');
      expect(mockGetTenantModels).not.toHaveBeenCalled();
    });
  });

  describe('WhatsApp Scheduler (K-8, K-9)', () => {
    it('F. WhatsApp scheduler lock uses 120s TTL and releases properly', async () => {
      redisClient.acquireLock.mockResolvedValue('token123');
      redisClient.releaseLock.mockResolvedValue(true);

      startWhatsAppScheduler();

      expect(mockCronSchedule).toHaveBeenCalled();
      const cronCallback = mockCronSchedule.mock.calls[0][1];

      await cronCallback();

      expect(redisClient.acquireLock).toHaveBeenCalledWith('cron:whatsapp:lock', 120);
      expect(redisClient.releaseLock).toHaveBeenCalledWith('cron:whatsapp:lock', 'token123');
    });

    it('E. WhatsApp scheduler with zero active tenants does not process master DB', async () => {
      redisClient.acquireLock.mockResolvedValue('token123');

      ClientDefault.find = jest.fn().mockReturnThis();
      ClientDefault.select = jest.fn().mockReturnThis();
      ClientDefault.lean = jest.fn().mockResolvedValue([]);

      startWhatsAppScheduler();
      const cronCallback = mockCronSchedule.mock.calls[0][1];
      await cronCallback();

      expect(mockGetTenantModels).not.toHaveBeenCalled();
    });
  });

  describe('Worker Startup (K-7)', () => {
    it('G. Worker startup calls buildTenantClusterMap', async () => {
      await jest.isolateModulesAsync(async () => {
        jest.unstable_mockModule('mongoose', () => ({
          default: {
            connect: jest.fn().mockResolvedValue(true),
            connection: { close: jest.fn() }
          }
        }));

        const mongooseMock = await import('mongoose');
        const originalLog = console.log;
        console.log = jest.fn();

        await import('../../workers/index.js');

        await new Promise(resolve => {
          setImmediate(() => {
            expect(mongooseMock.default.connect).toHaveBeenCalled();
            expect(mockBuildTenantClusterMap).toHaveBeenCalled();
            console.log = originalLog;
            resolve();
          });
        });
      });
    });
  });
});
