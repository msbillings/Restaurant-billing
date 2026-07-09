const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const billController = require('../../controllers/billController');
const Bill = require('../../models/Bill');
const User = require('../../models/User');

const app = express();
app.use(express.json());
app.post('/bills/save', billController.saveOrder);
app.post('/bills/generate/:id', billController.generateBill);
app.post('/bills/settle/:id', billController.settleBill);
app.get('/bills/:id', billController.getBillById);

describe('Billing Flow Integration Tests', () => {
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

  afterEach(async () => {
    await Bill.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  it('should complete full billing flow: Create -> Generate -> Settle', async () => {
    // Step 1: Create Order
    const orderData = {
      tableNo: 'T10',
      items: [
        { name: 'Pizza', price: 500, quantity: 2, total: 1000 },
        { name: 'Coke', price: 50, quantity: 2, total: 100 }
      ],
      billType: 'Dine-In'
    };

    const createResponse = await request(app)
      .post('/bills/save')
      .send(orderData);

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.status).toBe('Open');
    expect(createResponse.body.subtotal).toBe(1100);

    const orderId = createResponse.body._id;

    // Step 2: Generate Bill
    const generateResponse = await request(app)
      .post(`/bills/generate/${orderId}`)
      .send({ discount: 100, tax: 5 });

    expect(generateResponse.status).toBe(200);
    expect(generateResponse.body.status).toBe('Billed');
    expect(generateResponse.body.billNumber).toBeDefined();
    expect(generateResponse.body.discount).toBe(100);
    expect(generateResponse.body.tax).toBe(5);

    // Step 3: Settle Bill
    const settleResponse = await request(app)
      .post(`/bills/settle/${orderId}`)
      .send({ paymentMode: 'UPI' });

    expect(settleResponse.status).toBe(200);
    expect(settleResponse.body.status).toBe('Paid');
    expect(settleResponse.body.paymentMode).toBe('UPI');

    // Step 4: Verify final bill
    const finalBill = await Bill.findById(orderId);
    expect(finalBill.status).toBe('Paid');
    expect(finalBill.paymentMode).toBe('UPI');
    expect(finalBill.billNumber).toBeDefined();
  });

  it('should handle multiple orders simultaneously', async () => {
    const orders = [];
    
    // Create 5 orders simultaneously
    for (let i = 1; i <= 5; i++) {
      const orderData = {
        tableNo: `T${i}`,
        items: [{ name: `Item${i}`, price: 100 * i, quantity: 1, total: 100 * i }],
        billType: 'Dine-In'
      };
      
      const response = await request(app)
        .post('/bills/save')
        .send(orderData);
      
      expect(response.status).toBe(200);
      orders.push(response.body);
    }

    // Verify all orders created
    expect(orders.length).toBe(5);
    
    // Verify all orders in database
    const allOrders = await Bill.find({ status: 'Open' });
    expect(allOrders.length).toBe(5);
  });

  it('should handle 150+ orders scenario', async () => {
    const orders = [];
    const batchSize = 50;
    const totalOrders = 150;

    // Create orders in batches
    for (let batch = 0; batch < totalOrders / batchSize; batch++) {
      const batchPromises = [];
      
      for (let i = 0; i < batchSize; i++) {
        const orderNum = batch * batchSize + i + 1;
        const orderData = {
          tableNo: `T${orderNum}`,
          items: [
            { name: `Item${orderNum}`, price: 100, quantity: 1, total: 100 }
          ],
          billType: 'Dine-In'
        };
        
        batchPromises.push(
          request(app)
            .post('/bills/save')
            .send(orderData)
        );
      }
      
      const batchResults = await Promise.all(batchPromises);
      orders.push(...batchResults.map(r => r.body));
    }

    expect(orders.length).toBe(totalOrders);
    
    // Verify database can handle the load
    const allOrders = await Bill.find({ status: 'Open' });
    expect(allOrders.length).toBe(totalOrders);
    
    // Test pagination with large dataset
    const bills = await Bill.find({ status: 'Open' })
      .sort({ createdAt: -1 })
      .limit(50)
      .skip(0);
    
    expect(bills.length).toBe(50);
  });
});

