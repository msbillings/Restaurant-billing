import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';
import crypto from 'crypto';

jest.unstable_mockModule('../../models/Report.js', () => {
  const mockReports = {};
  return {
    default: {
      create: jest.fn(async (data) => {
        mockReports[data.reportId] = data;
        return data;
      }),
      findOne: jest.fn(async ({ reportId, tenantDb }) => {
        const report = mockReports[reportId];
        if (report && (!tenantDb || report.tenantDb === tenantDb)) {
          return report;
        }
        return null;
      }),
      updateOne: jest.fn(async ({ reportId }, { $set }) => {
        if (mockReports[reportId]) {
          mockReports[reportId] = { ...mockReports[reportId], ...$set };
        }
      }),
      deleteMany: jest.fn(async () => {
        for (const key in mockReports) delete mockReports[key];
      })
    }
  };
});

jest.unstable_mockModule('../../utils/tenantManager.js', () => ({
  getTenantModels: jest.fn(async () => ({
    User: {
      findById: jest.fn(async (id) => ({ 
        id, 
        _id: id, 
        role: 'Admin',
        activeSessions: [{ accessToken: 'mockToken' }] // Added to fix 'some' error in auth.js
      }))
    }
  })),
  getMasterModels: jest.fn(async () => ({}))
}));

const { default: Report } = await import('../../models/Report.js');
const { downloadSecureReport } = await import('../../controllers/analyticsController.js');

const app = express();
app.use(express.json());

// Set up mock tenant middleware logic expected by authenticateToken
app.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7, authHeader.length);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'testsecret');
      req.user = decoded;
      req.tenantDb = decoded.db;
    } catch (err) {}
  }
  
  if (!req.tenantDb) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }
  next();
});

// Mock Route
app.get('/api/analytics/download/:reportId', downloadSecureReport);

describe('Private Report Storage Security', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
  const tenantA = 'client_tenant_a';
  const tenantB = 'client_tenant_b';
  
  let tokenA;
  let tokenB;
  let validReportIdA;
  let expiredReportIdA;
  
  const secureDir = path.join(process.cwd(), 'secure_reports');

  beforeAll(async () => {
    // We are only testing routing and authorization logic here, 
    // assuming mongoose is connected to a test DB via setup.js
    
    tokenA = jwt.sign({ id: 'userA', db: tenantA, role: 'Admin' }, JWT_SECRET, { expiresIn: '1h' });
    tokenB = jwt.sign({ id: 'userB', db: tenantB, role: 'Admin' }, JWT_SECRET, { expiresIn: '1h' });

    if (!fs.existsSync(secureDir)) {
      fs.mkdirSync(secureDir, { recursive: true });
    }

    validReportIdA = crypto.randomUUID();
    const validFilePath = path.join(secureDir, `${validReportIdA}.csv`);
    fs.writeFileSync(validFilePath, 'mock,csv,data\n');

    await Report.create({
      reportId: validReportIdA,
      tenantDb: tenantA,
      filePath: validFilePath,
      filename: `daily-report-test.csv`,
      status: 'ready'
    });

    expiredReportIdA = crypto.randomUUID();
    const expiredFilePath = path.join(secureDir, `${expiredReportIdA}.csv`);
    fs.writeFileSync(expiredFilePath, 'mock,csv,data,expired\n');

    await Report.create({
      reportId: expiredReportIdA,
      tenantDb: tenantA,
      filePath: expiredFilePath,
      filename: `daily-report-test-expired.csv`,
      status: 'expired'
    });
  });

  afterAll(async () => {
    // Cleanup physical files
    try {
      if (validReportIdA) fs.unlinkSync(path.join(secureDir, `${validReportIdA}.csv`));
      if (expiredReportIdA) fs.unlinkSync(path.join(secureDir, `${expiredReportIdA}.csv`));
    } catch (e) {}
    await Report.deleteMany({});
  });

  it('A. Unauthenticated download -> 401', async () => {
    const res = await request(app)
      .get(`/api/analytics/download/${validReportIdA}`);
    expect(res.status).toBe(401);
  });

  it('B. Tenant A downloads its own report -> success', async () => {
    const res = await request(app)
      .get(`/api/analytics/download/${validReportIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/octet-stream');
  });

  it('C. Tenant A requests Tenant B report -> denied (safe 404)', async () => {
    // Tenant B tries to access Tenant A's report
    const res = await request(app)
      .get(`/api/analytics/download/${validReportIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    
    expect(res.status).toBe(404);
  });

  it('D. Unknown report ID -> safe 404', async () => {
    const res = await request(app)
      .get(`/api/analytics/download/nonexistent-id-123`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(404);
  });

  it('E. Expired report -> denied (410)', async () => {
    const res = await request(app)
      .get(`/api/analytics/download/${expiredReportIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(410);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('F. Path traversal attempt -> denied', async () => {
    // Attempting to bypass by passing traversal in the URL
    // Express router will typically resolve this or 404 it.
    // If it reaches the controller, the controller uses reportId to lookup DB.
    // Since traversing isn't a valid UUID in DB, it returns 404.
    const res = await request(app)
      .get(`/api/analytics/download/..%2F..%2F..%2Fetc%2Fpasswd`)
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(404);
  });
});
