import { jest } from '@jest/globals';

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    decode: jest.fn(),
    verify: jest.fn()
  }
}));

jest.unstable_mockModule('../../utils/tenantManager.js', () => ({
  getTenantModels: jest.fn()
}));

const { default: jwt } = await import('jsonwebtoken');
const { getTenantModels } = await import('../../utils/tenantManager.js');
const { tenantMiddleware } = await import('../../middleware/tenant.js');
const { authenticateToken } = await import('../../middleware/auth.js');

describe('Tenant Isolation Hardening Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      query: {},
      body: {},
      originalUrl: '/api/test'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('tenantMiddleware', () => {
    it('should route unauthenticated requests using X-Tenant-DB', async () => {
      req.headers['x-tenant-db'] = 'public_db';
      getTenantModels.mockResolvedValue({ id: 'models_public_db' });

      await tenantMiddleware(req, res, next);

      expect(req.tenantDb).toBe('public_db');
      expect(req.models).toEqual({ id: 'models_public_db' });
      expect(next).toHaveBeenCalled();
    });

    it('should enforce JWT tenant identity and IGNORE X-Tenant-DB when Authorization header is present', async () => {
      req.headers['authorization'] = 'Bearer validtoken';
      req.headers['x-tenant-db'] = 'attacker_db'; // Attempted override
      
      jwt.decode.mockReturnValue({ db: 'legit_jwt_db' });
      getTenantModels.mockResolvedValue({ id: 'models_legit_jwt_db' });

      await tenantMiddleware(req, res, next);

      // Must be legit_jwt_db, NOT attacker_db
      expect(req.tenantDb).toBe('legit_jwt_db');
      expect(next).toHaveBeenCalled();
    });

    it('should NOT fallback to X-Tenant-DB if JWT lacks db claim', async () => {
      req.headers['authorization'] = 'Bearer legacytoken';
      req.headers['x-tenant-db'] = 'attacker_db'; // Attempted override
      
      jwt.decode.mockReturnValue({ id: '123' }); // No db claim

      await tenantMiddleware(req, res, next);

      expect(req.tenantDb).toBeNull();
      expect(req.models).toBeNull();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('authenticateToken', () => {
    it('should reject legacy JWT missing db claim with 401', async () => {
      req.headers['authorization'] = 'Bearer legacytoken';
      
      jwt.verify.mockReturnValue({ id: 'user1' }); // No db claim

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Legacy or invalid token format. Please login again.' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
