const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const billController = require('../../controllers/billController');
const analyticsController = require('../../controllers/analyticsController');
const Bill = require('../../models/Bill');
const User = require('../../models/User');

const app = express();
app.use(express.json());
app.post('/bills/save', billController.saveOrder);
app.post('/bills/generate/:id', billController.generateBill);
app.post('/bills/settle/:id', billController.settleBill);
app.get('/bills', billController.getBills);
app.get('/bills/stats', billController.getDailyStats);
app.get('/analytics', analyticsController.getAnalytics);

describe('Complete Feature Workflow Tests', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    testUser = await User.create({
      username: 'testuser',
      password: 'hashedpassword',
      role: 'Admin'
    });

    authToken = jwt.sign(
      { userId: testUser._id, username: testUser.username, role: testUser.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key_123',
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    await Bill.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  describe('Daily Operations Workflow', () => {
    it('should handle complete daily restaurant operations', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Simulate 10 orders throughout the day
      const orders = [];
      for (let i = 1; i <= 10; i++) {
        const orderData = {
          tableNo: `T${i}`,
          items: [
            { name: `Item${i}`, price: 100 * i, quantity: 1, total: 100 * i }
          ],
          billType: i % 2 === 0 ? 'Dine-In' : 'Takeaway'
        };

        const createRes = await request(app)
          .post('/bills/save')
          .send(orderData);
        
        orders.push(createRes.body);
      }

      // Generate bills for half of them
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/bills/generate/${orders[i]._id}`)
          .send({ discount: 10, tax: 5 });
      }

      // Settle bills
      const paymentModes = ['Cash', 'UPI', 'Card'];
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/bills/settle/${orders[i]._id}`)
          .send({ paymentMode: paymentModes[i % 3] });
      }

      // Check daily stats
      const statsRes = await request(app)
        .get('/bills/stats');

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.orders).toBe(5);
      expect(statsRes.body.sales).toBeGreaterThan(0);
    });
  });

  describe('Analytics Feature', () => {
    it('should provide accurate analytics for current month', async () => {
      const today = new Date();
      
      // Create bills for current month
      await Bill.create([
        {
          tableNo: 'T1',
          items: [{ name: 'Item1', price: 100, quantity: 1, total: 100 }],
          subtotal: 100,
          total: 100,
          status: 'Paid',
          paymentMode: 'Cash',
          createdAt: new Date(today.getFullYear(), today.getMonth(), 1)
        },
        {
          tableNo: 'T2',
          items: [{ name: 'Item2', price: 200, quantity: 1, total: 200 }],
          subtotal: 200,
          total: 200,
          status: 'Paid',
          paymentMode: 'UPI',
          createdAt: new Date(today.getFullYear(), today.getMonth(), 15)
        }
      ]);

      const req = { query: {} };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await analyticsController.getAnalytics(req, res);

      expect(res.json).toHaveBeenCalled();
      const analytics = res.json.mock.calls[0][0];
      expect(analytics.summary.period.revenue).toBe(300);
      expect(analytics.summary.period.bills).toBe(2);
      expect(analytics.paymentModeStats.length).toBeGreaterThan(0);
    });
  });

  describe('Bill History Feature', () => {
    it('should paginate bills correctly', async () => {
      // Create 25 paid bills
      const bills = [];
      for (let i = 1; i <= 25; i++) {
        bills.push({
          tableNo: `T${i}`,
          billNumber: `BILL-${i}`,
          items: [{ name: `Item${i}`, price: 100, quantity: 1, total: 100 }],
          subtotal: 100,
          total: 100,
          status: 'Paid',
          paymentMode: 'Cash',
          billType: 'Dine-In'
        });
      }
      await Bill.insertMany(bills);

      // Test pagination
      const page1 = await request(app)
        .get('/bills?page=1&limit=10');
      
      expect(page1.status).toBe(200);
      expect(page1.body.bills.length).toBe(10);
      expect(page1.body.pagination.totalBills).toBe(25);
      expect(page1.body.pagination.totalPages).toBe(3);

      const page2 = await request(app)
        .get('/bills?page=2&limit=10');
      
      expect(page2.status).toBe(200);
      expect(page2.body.bills.length).toBe(10);
    });
  });

  describe('Performance with 150+ Orders', () => {
    it('should handle 150 orders efficiently', async () => {
      const startTime = Date.now();
      
      // Create 150 orders
      const orders = [];
      for (let i = 1; i <= 150; i++) {
        const orderData = {
          tableNo: `T${i}`,
          items: [
            { name: `Item${i}`, price: 100, quantity: 1, total: 100 }
          ],
          billType: 'Dine-In'
        };

        const res = await request(app)
          .post('/bills/save')
          .send(orderData);
        
        orders.push(res.body);
      }

      const createTime = Date.now() - startTime;
      console.log(`Created 150 orders in ${createTime}ms`);

      // Generate bills for all
      const generateStart = Date.now();
      for (const order of orders) {
        await request(app)
          .post(`/bills/generate/${order._id}`)
          .send({ discount: 0, tax: 5 });
      }
      const generateTime = Date.now() - generateStart;
      console.log(`Generated 150 bills in ${generateTime}ms`);

      // Settle all bills
      const settleStart = Date.now();
      for (const order of orders) {
        await request(app)
          .post(`/bills/settle/${order._id}`)
          .send({ paymentMode: 'Cash' });
      }
      const settleTime = Date.now() - settleStart;
      console.log(`Settled 150 bills in ${settleTime}ms`);

      // Test query performance
      const queryStart = Date.now();
      const bills = await request(app)
        .get('/bills?page=1&limit=50');
      const queryTime = Date.now() - queryStart;
      console.log(`Queried bills in ${queryTime}ms`);

      expect(bills.status).toBe(200);
      expect(bills.body.bills.length).toBe(50);
      
      // Performance assertions
      expect(createTime).toBeLessThan(30000); // Should complete in 30s
      expect(queryTime).toBeLessThan(2000); // Query should be fast
    });
  });
});

