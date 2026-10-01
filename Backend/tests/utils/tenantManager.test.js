import { getTenantModels, getMasterModels } from '../../utils/tenantManager.js';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { authenticateToken } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { setupDatabase } from '../../controllers/configController.js';

// Mock dependencies
jest.unstable_mockModule('mongoose', () => ({
  default: {
    connection: {
      readyState: 1,
      db: { databaseName: 'mscurechain' },
      useDb: jest.fn().mockReturnValue({ readyState: 1, models: {}, model: jest.fn().mockReturnValue({}) }),
      collection: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) })
    },
    createConnection: jest.fn().mockReturnValue({ readyState: 1, asPromise: jest.fn().mockResolvedValue(true) })
  }
}));

describe('Tenant Manager Phase 2 Security', () => {
  describe('getTenantModels Boundary Enforcement', () => {
    it('A. getTenantModels(undefined) -> throw TENANT_NOT_RESOLVED', async () => {
      await expect(getTenantModels(undefined)).rejects.toThrow(/TENANT_NOT_RESOLVED|Invalid tenant database name/);
    });

    it('B. getTenantModels(null) -> throw', async () => {
      await expect(getTenantModels(null)).rejects.toThrow(/TENANT_NOT_RESOLVED|Invalid tenant database name/);
    });

    it('C. getTenantModels("") -> throw', async () => {
      await expect(getTenantModels("")).rejects.toThrow(/TENANT_NOT_RESOLVED|Invalid tenant database name/);
    });

    it('D. getTenantModels("default") -> throw', async () => {
      await expect(getTenantModels("default")).rejects.toThrow(/TENANT_NOT_RESOLVED|Invalid tenant database name/);
    });

    it('E. getTenantModels("undefined") -> throw', async () => {
      await expect(getTenantModels("undefined")).rejects.toThrow(/TENANT_NOT_RESOLVED|Invalid tenant database name/);
    });

    it('F. getTenantModels("null") -> throw', async () => {
      await expect(getTenantModels("null")).rejects.toThrow(/TENANT_NOT_RESOLVED|Invalid tenant database name/);
    });

    it('G. getTenantModels("unknown_tenant") -> throw', async () => {
      await expect(getTenantModels("unknown_tenant")).rejects.toThrow();
    });

    it('H. valid tenant database -> returns tenant-bound models', async () => {
      const { registerTenantCluster } = await import('../../utils/tenantManager.js');
      registerTenantCluster('valid_tenant', 'cluster0');
      const models = await getTenantModels("valid_tenant");
      expect(models).toHaveProperty('connection');
    });

    it('I. getMasterModels() -> returns master models', async () => {
      const models = await getMasterModels();
      expect(models).toHaveProperty('connection');
    });
  });

  describe('Caller Middleware & Controller Enforcement', () => {
    it('J. authenticated JWT db="default" -> must NOT obtain master tenant models', async () => {
      const req = { headers: { authorization: 'Bearer fake_token' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      jest.unstable_mockModule('jsonwebtoken', () => ({
        default: { verify: jest.fn().mockReturnValue({ id: 'user1', db: 'default' }) }
      }));

      const auth = await import('../../middleware/auth.js');
      await auth.authenticateToken(req, res, next);
      expect(req.models).toBeUndefined(); // Should fail gracefully
    });

    it('K. public X-Tenant-DB=default -> must NOT obtain master models', async () => {
      const req = { headers: { 'x-tenant-db': 'default' }, query: {}, body: {} };
      const res = {};
      const next = jest.fn();

      const tenantMid = await import('../../middleware/tenant.js');
      await tenantMid.tenantMiddleware(req, res, next);
      expect(req.models).toBeNull();
    });

    it('L. query/body default -> rejected by controller if Cloud', async () => {
      process.env.RENDER = 'true';
      const whatsappCtrl = await import('../../controllers/whatsappController.js');
      const req = { query: { tenant: 'default' } };

      try {
        await whatsappCtrl.resolveTenantInfo(req);
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toMatch(/Master database access denied/);
      } finally {
        delete process.env.RENDER;
      }
    });

    it('M. setupDatabase default input -> must not silently operate against master', async () => {
      const req = { body: { databaseName: 'default' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      const config = await import('../../controllers/configController.js');
      await config.setupDatabase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
