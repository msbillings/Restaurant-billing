import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import billRoutes from '../../routes/billRoutes.js';
import menuRoutes from '../../routes/menuRoutes.js';
import { tenantMiddleware } from '../../middleware/tenant.js';

import BillDefault from '../../models/Bill.js';
import MenuDefault from '../../models/Menu.js';
import CreditAccountDefault from '../../models/CreditAccount.js';
import { getTenantModel } from '../../utils/tenantHelper.js';
import { getTenantModels } from '../../utils/tenantManager.js';
import redisManager from '../../utils/redisClient.js';

// Setup basic Express app
const app = express();
app.use(express.json());

// Mock socket.io and other external dependencies to avoid issues during testing
jest.unstable_mockModule('../../utils/socket.js', () => ({
  emitSocketEvent: jest.fn()
}));
jest.unstable_mockModule('../../utils/notificationHelper.js', () => ({
  emitNotification: jest.fn(),
  emitDismissNotification: jest.fn()
}));

import jwt from 'jsonwebtoken';

// Provide a mock user middleware
app.use((req, res, next) => {
  const adminId = '507f1f77bcf86cd799439011'; // valid objectId
  req.user = { db: 'test_resto_db', role: 'Admin', id: adminId };
  req.headers['x-tenant-db'] = 'test_resto_db';
  
  // Inject a real JWT token so authenticateToken middleware passes
  const token = jwt.sign({ db: 'test_resto_db', role: 'Admin', id: adminId }, process.env.JWT_SECRET || 'testsecret');
  req.headers['authorization'] = `Bearer ${token}`;
  
  next();
});

// Attach tenant middleware
app.use(tenantMiddleware);
app.use('/api/bills', billRoutes);
app.use('/api/menu', menuRoutes);

import { MongoMemoryServer } from 'mongodb-memory-server';

describe('POS Full Workflow Integration Tests', () => {
  let Bill, Menu, CreditAccount, mongoServer;
  
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    // Inject the URI so the real production resolver can connect to it
    process.env.MONGO_URI_CLUSTER0 = uri;
    
    // Mock redis client to avoid express-rate-limit Store errors
    redisManager.isConnected = true;
    redisManager.client = {
      sendCommand: jest.fn().mockResolvedValue(1)
    };
    
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    
    // The tenantManager might use listDatabases(), so we must create the DB physically first
    const db = mongoose.connection.useDb('test_resto_db');
    await db.createCollection('bills'); // Force creation of the DB

    // Wait, first we need the tenant models to seed the user
    const User = (await getTenantModels('test_resto_db')).User;

    await User.deleteMany({});
    
    // Use an explicitly valid ObjectId for the testadmin
    const adminId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    await User.create({ _id: adminId, name: 'Test Admin', username: 'admin', password: 'password', phone: '0000000000', email: 'admin@test.com', role: 'Admin', status: 'Active' });
    
    // Inject a real JWT token so authenticateToken middleware passes
    const token = jwt.sign({ db: 'test_resto_db', role: 'Admin', id: adminId.toString() }, process.env.JWT_SECRET || 'testsecret');
    
    // Provide a mock user middleware override
    app.use((req, res, next) => {
      req.headers['authorization'] = `Bearer ${token}`;
      req.headers['x-tenant-db'] = 'test_resto_db';
      next();
    });
    const models = await getTenantModels('test_resto_db');
    Bill = models.Bill;
    Menu = models.Menu;
    CreditAccount = models.CreditAccount;
    
    const mockCategoryId1 = new mongoose.Types.ObjectId();
    const mockCategoryId2 = new mongoose.Types.ObjectId();
    
    // Seed some menu items
    await Menu.create([
      { name: 'Pasta', category: mockCategoryId1, price: 200, isAvailable: true },
      { name: 'Coke', category: mockCategoryId2, price: 50, isAvailable: true }
    ]);
  });
  
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });
  
  it('1. Menu retrieval should fetch items', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
  
  it('2-4. Table/order creation and KOT', async () => {
    const res = await request(app).post('/api/bills/save').send({
      tableNo: 'Table 1',
      items: [{ name: 'Pasta', price: 200, quantity: 2 }],
      billType: 'Dine-In',
      restaurantDetails: { restaurantName: 'Test Resto' }
    });
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Open');
    expect(res.body.tableNo).toBe('Table 1');
    expect(res.body.items[0].quantity).toBe(2);
  });
  
  it('5-6. Update order with additional KOT', async () => {
    let order = await Bill.findOne({ tableNo: 'Table 1' });
    const res = await request(app).post(`/api/bills/kot/${order._id}`).send({
      items: [{ name: 'Coke', price: 50, quantity: 1 }]
    });
    
    expect(res.status).toBe(200);
    // KOT generated successfully
  });
  
  it('7-9. Concurrent Settlement should only process exactly ONCE', async () => {
    const order = await Bill.findOne({ tableNo: 'Table 1' });
    
    const payload = {
      paymentMode: 'Unpaid',
      customerName: 'Alice',
      customerPhone: '1234567890',
      total: order.total
    };
    
    // Fire 3 simultaneous settlement requests (Race Condition test)
    const responses = await Promise.all([
      request(app).post(`/api/bills/settle/${order._id}`).send(payload),
      request(app).post(`/api/bills/settle/${order._id}`).send(payload),
      request(app).post(`/api/bills/settle/${order._id}`).send(payload)
    ]);
    
    // All should return 200 (idempotent), but only one should actually apply the Khata balance!
    responses.forEach(res => expect(res.status).toBe(200));
    
    const account = await CreditAccount.findOne({ phoneNumber: '1234567890' });
    // If the race condition was fixed, the balance should be exactly 450 (not 1350)
    expect(account.balance).toBe(order.total);
    expect(account.transactions.length).toBe(1); // Only 1 Khata transaction
    
    const settledOrder = await Bill.findById(order._id);
    expect(settledOrder.status).toBe('Unpaid');
  });
  
  it('11. Daily stats should fetch optimized results without crashing', async () => {
    const res = await request(app).get('/api/bills/stats');
    expect(res.status).toBe(200);
    
    // Total Revenue should include the 'Unpaid' bill's total? 
    // Wait, getDailyStats only counts 'Paid' bills!
    if (res.body.paidStats) {
      expect(res.body.paidStats.length).toBe(0); 
    }
    // Let's create a Paid bill and test again
    await request(app).post('/api/bills/save').send({
      tableNo: 'Takeaway 1',
      items: [{ name: 'Coke', price: 50, quantity: 1, total: 50 }],
      subtotal: 50,
      total: 50,
      billType: 'Takeaway'
    });
    
    const tw = await Bill.findOne({ tableNo: 'Takeaway 1' });
    await request(app).post(`/api/bills/settle/${tw._id}`).send({
      paymentMode: 'UPI',
      total: tw.total
    });
    
    const res2 = await request(app).get('/api/bills/stats');
    expect(res2.body.orders).toBe(1);
    expect(res2.body.sales).toBe(50);
    expect(res2.body.takeawayOrders).toBe(1);
    
    // Distinct customers should have 1 anonymous because Takeaway had no phone
    expect(res2.body.totalCustomers).toBe(1);
  });
});
