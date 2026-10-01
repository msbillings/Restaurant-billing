import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// Mock tenantManager to simulate tenant discovery WITHOUT connecting to MongoDB
jest.unstable_mockModule('../../utils/tenantManager.js', () => ({
  getTenantModels: jest.fn().mockImplementation(async (tenantId) => {
    if (tenantId === 'default' || !tenantId) throw new Error('TENANT_NOT_RESOLVED');
    return { 
      connection: { name: tenantId }, 
      User: { findById: jest.fn().mockResolvedValue({ activeSessions: [], save: jest.fn().mockResolvedValue({}) }) } 
    };
  }),
  getMasterModels: jest.fn().mockResolvedValue({}),
  getTenantDB: jest.fn(),
  getTenantModel: jest.fn()
}));

const { tenantMiddleware } = await import('../../middleware/tenant.js');
const { authenticateToken, requireAdmin, optionalAuthenticateToken } = await import('../../middleware/auth.js');

// Prove the actual middleware ordering used in server.js
app.use('/api', tenantMiddleware);

// WhatsApp / Loyalty operational routes (Strict Auth)
app.post('/api/whatsapp/send-message', authenticateToken, (req, res) => {
  res.status(200).json({ executedAs: req.tenantDb });
});

app.post('/api/loyalty/test-whatsapp', authenticateToken, requireAdmin, (req, res) => {
  res.status(200).json({ executedAs: req.tenantDb });
});

// Menu / Public routes (Optional Auth)
app.get('/api/menu', optionalAuthenticateToken, (req, res) => {
  res.status(200).json({ executedAs: req.tenantDb });
});

describe('Phase 3 Security Remediation Tests', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_msbillings_2026';
  
  const generateToken = (tenantDb, role = 'Admin') => {
    return jwt.sign({ id: 'user123', db: tenantDb, role }, JWT_SECRET, { expiresIn: '1h' });
  };

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('1. Unauthenticated WhatsApp request -> 401', async () => {
    const res = await request(app).post('/api/whatsapp/send-message').send({ phone: '123', message: 'hello' });
    expect(res.status).toBe(401);
  });

  it('2. Unauthenticated + X-Tenant-DB valid tenant -> 401', async () => {
    const res = await request(app)
      .post('/api/whatsapp/send-message')
      .set('X-Tenant-DB', 'client_123')
      .send({ phone: '123', message: 'hello' });
    expect(res.status).toBe(401);
  });

  it('3. Unauthenticated + ?tenant=valid tenant -> 401', async () => {
    const res = await request(app)
      .post('/api/whatsapp/send-message?tenant=client_123')
      .send({ phone: '123', message: 'hello' });
    expect(res.status).toBe(401);
  });

  it('4. Unauthenticated loyalty /test-whatsapp -> 401', async () => {
    const res = await request(app)
      .post('/api/loyalty/test-whatsapp')
      .set('X-Tenant-DB', 'client_123')
      .send({ phone: '123' });
    expect(res.status).toBe(401);
  });

  it('5. Authenticated tenant A -> tenant A', async () => {
    const token = generateToken('tenant_A');
    const res = await request(app)
      .post('/api/whatsapp/send-message')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.executedAs).toBe('tenant_A');
  });

  it('6. Authenticated tenant A + X-Tenant-DB tenant B -> remains tenant A', async () => {
    const token = generateToken('tenant_A');
    const res = await request(app)
      .post('/api/whatsapp/send-message')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-DB', 'attacker_B');
    
    expect(res.status).toBe(200);
    expect(res.body.executedAs).toBe('tenant_A');
  });

  it('7. Authenticated tenant A + ?tenant=tenant B -> remains tenant A', async () => {
    const token = generateToken('tenant_A');
    const res = await request(app)
      .post('/api/whatsapp/send-message?tenant=attacker_B')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.executedAs).toBe('tenant_A');
  });

  it('8. Invalid JWT -> 403', async () => {
    const res = await request(app)
      .post('/api/whatsapp/send-message')
      .set('Authorization', `Bearer invalid.jwt.token`);
    
    expect(res.status).toBe(403);
  });

  it('9. JWT without db -> rejected', async () => {
    const token = jwt.sign({ id: 'user123' }, JWT_SECRET); // missing db
    const res = await request(app)
      .post('/api/whatsapp/send-message')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(401);
  });

  it('10. Public QR menu GET remains functional', async () => {
    const res = await request(app)
      .get('/api/menu?tenant=client_123');
    
    expect(res.status).toBe(200);
    expect(res.body.executedAs).toBe('client_123');
  });

  it('11. Public category GET remains functional (simulated via optional Auth)', async () => {
    const res = await request(app)
      .get('/api/menu?tenant=client_123');
    expect(res.status).toBe(200);
    expect(res.body.executedAs).toBe('client_123');
  });
});
