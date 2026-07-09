const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const billController = require('../../controllers/billController');
const Bill = require('../../models/Bill');
const User = require('../../models/User');

// Create test app
const app = express();
app.use(express.json());
app.post('/bills/save', billController.saveOrder);
app.get('/bills', billController.getBills);
app.get('/bills/:id', billController.getBillById);
app.post('/bills/generate/:id', billController.generateBill);
app.post('/bills/settle/:id', billController.settleBill);
app.delete('/bills/:id', billController.deleteBill);
app.get('/bills/active/:tableNo', billController.getActiveOrder);

describe('Bill Controller Unit Tests', () => {
  let authToken;
  let testUser;
  let testBill;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      username: 'testuser',
      password: 'hashedpassword',
      role: 'Admin'
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser._id, username: testUser.username, role: testUser.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key_123',
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    // Create a test bill
    testBill = await Bill.create({
      tableNo: 'T1',
      items: [
        { name: 'Pizza', price: 500, quantity: 2, total: 1000 },
        { name: 'Burger', price: 200, quantity: 1, total: 200 }
      ],
      subtotal: 1200,
      total: 1200,
      status: 'Open',
      billType: 'Dine-In'
    });
  });

  afterEach(async () => {
    await Bill.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  describe('POST /bills/save', () => {
    it('should create a new order', async () => {
      const orderData = {
        tableNo: 'T2',
        items: [
          { name: 'Pasta', price: 300, quantity: 1, total: 300 }
        ],
        billType: 'Dine-In'
      };

      const response = await request(app)
        .post('/bills/save')
        .send(orderData);

      expect(response.status).toBe(200);
      expect(response.body.tableNo).toBe('T2');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.status).toBe('Open');
    });

    it('should update existing order', async () => {
      const orderData = {
        tableNo: 'T1',
        items: [
          { name: 'Updated Pizza', price: 600, quantity: 1, total: 600 }
        ],
        billType: 'Dine-In'
      };

      const response = await request(app)
        .post('/bills/save')
        .send(orderData);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('Updated Pizza');
    });
  });

  describe('GET /bills', () => {
    it('should get paginated bills', async () => {
      // Create paid bills
      await Bill.create([
        { tableNo: 'T3', items: [], subtotal: 100, total: 100, status: 'Paid' },
        { tableNo: 'T4', items: [], subtotal: 200, total: 200, status: 'Paid' }
      ]);

      const response = await request(app)
        .get('/bills?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('bills');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.currentPage).toBe(1);
    });

    it('should search bills by bill number', async () => {
      const paidBill = await Bill.create({
        tableNo: 'T5',
        billNumber: 'BILL-12345',
        items: [],
        subtotal: 100,
        total: 100,
        status: 'Paid'
      });

      const response = await request(app)
        .get('/bills?page=1&limit=10&search=BILL-12345');

      expect(response.status).toBe(200);
      expect(response.body.bills.length).toBeGreaterThan(0);
    });
  });

  describe('GET /bills/:id', () => {
    it('should get bill by ID', async () => {
      const response = await request(app)
        .get(`/bills/${testBill._id}`);

      expect(response.status).toBe(200);
      expect(response.body._id.toString()).toBe(testBill._id.toString());
      expect(response.body.items).toHaveLength(2);
    });

    it('should return 404 for non-existent bill', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/bills/${fakeId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /bills/generate/:id', () => {
    it('should generate bill with discount and tax', async () => {
      const response = await request(app)
        .post(`/bills/generate/${testBill._id}`)
        .send({ discount: 100, tax: 10 });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('Billed');
      expect(response.body.billNumber).toBeDefined();
      expect(response.body.discount).toBe(100);
      expect(response.body.tax).toBe(10);
    });

    it('should return 400 if order already billed', async () => {
      testBill.status = 'Billed';
      await testBill.save();

      const response = await request(app)
        .post(`/bills/generate/${testBill._id}`)
        .send({ discount: 0, tax: 0 });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /bills/settle/:id', () => {
    it('should settle bill with payment mode', async () => {
      testBill.status = 'Billed';
      await testBill.save();

      const response = await request(app)
        .post(`/bills/settle/${testBill._id}`)
        .send({ paymentMode: 'Cash' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('Paid');
      expect(response.body.paymentMode).toBe('Cash');
    });
  });

  describe('DELETE /bills/:id', () => {
    it('should delete a bill', async () => {
      const paidBill = await Bill.create({
        tableNo: 'T6',
        items: [],
        subtotal: 100,
        total: 100,
        status: 'Paid'
      });

      const response = await request(app)
        .delete(`/bills/${paidBill._id}`);

      expect(response.status).toBe(200);

      const deletedBill = await Bill.findById(paidBill._id);
      expect(deletedBill).toBeNull();
    });
  });

  describe('GET /bills/active/:tableNo', () => {
    it('should get active order for a table', async () => {
      const response = await request(app)
        .get('/bills/active/T1');

      expect(response.status).toBe(200);
      expect(response.body.tableNo).toBe('T1');
      expect(response.body.status).toBe('Open');
    });

    it('should return null for table with no active order', async () => {
      const response = await request(app)
        .get('/bills/active/T99');

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });
});

