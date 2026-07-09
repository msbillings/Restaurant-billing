const Bill = require('../../models/Bill');
const analyticsController = require('../../controllers/analyticsController');
const mongoose = require('mongoose');

describe('Analytics Controller Unit Tests', () => {
  beforeEach(async () => {
    await Bill.deleteMany({});
  });


  describe('getAnalytics', () => {
    it('should return analytics for current month', async () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // Create test bills
      await Bill.create([
        {
          tableNo: 'T1',
          items: [{ name: 'Item1', price: 100, quantity: 1, total: 100 }],
          subtotal: 100,
          total: 100,
          status: 'Paid',
          createdAt: new Date(today.getFullYear(), today.getMonth(), 5)
        },
        {
          tableNo: 'T2',
          items: [{ name: 'Item2', price: 200, quantity: 1, total: 200 }],
          subtotal: 200,
          total: 200,
          status: 'Paid',
          createdAt: new Date(today.getFullYear(), today.getMonth(), 10)
        }
      ]);

      const req = {
        query: {}
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await analyticsController.getAnalytics(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.summary.period.revenue).toBe(300);
      expect(response.summary.period.bills).toBe(2);
    });

    it('should return analytics for specific month', async () => {
      const targetMonth = 11; // December (0-indexed)
      const targetYear = 2024;

      await Bill.create({
        tableNo: 'T3',
        items: [{ name: 'Item3', price: 150, quantity: 1, total: 150 }],
        subtotal: 150,
        total: 150,
        status: 'Paid',
        createdAt: new Date(targetYear, targetMonth, 15)
      });

      const req = {
        query: { month: '12', year: '2024' }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await analyticsController.getAnalytics(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.summary.period.revenue).toBe(150);
    });

    it('should return daily revenue breakdown', async () => {
      const today = new Date();
      const date1 = new Date(today.getFullYear(), today.getMonth(), 1);
      const date2 = new Date(today.getFullYear(), today.getMonth(), 2);

      await Bill.create([
        {
          tableNo: 'T4',
          items: [],
          subtotal: 100,
          total: 100,
          status: 'Paid',
          createdAt: date1
        },
        {
          tableNo: 'T5',
          items: [],
          subtotal: 200,
          total: 200,
          status: 'Paid',
          createdAt: date2
        }
      ]);

      const req = { query: {} };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await analyticsController.getAnalytics(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.dailyRevenue).toBeDefined();
      expect(response.dailyRevenue.length).toBeGreaterThan(0);
    });
  });
});

