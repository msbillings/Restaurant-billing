import BillDefault from '../models/Bill.js';
import ExpenseDefault from '../models/Expense.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { generateDayBookWorkbook } from '../utils/excelGenerator.js';
import ExcelJS from 'exceljs';
import { resolveTenantInfo } from './whatsappController.js';
import { getISTDayRange, getISTMonthRange, IST_TIMEZONE } from '../utils/timezoneHelper.js';
import fs from 'fs';
import path from 'path';
import Report from '../models/Report.js';
// Get comprehensive analytics
export const getAnalytics = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { month, year, days, date, customStart, customEnd } = req.query;
    
    let startDate, endDate;
    
    if (customStart && customEnd) {
      startDate = getISTDayRange(customStart).startDate;
      endDate = getISTDayRange(customEnd).endDate;
    } else if (date) {
      const range = getISTDayRange(date);
      startDate = range.startDate;
      endDate = range.endDate;
    } else if (month && year) {
      const range = getISTMonthRange(year, month);
      startDate = range.startDate;
      endDate = range.endDate;
    } else if (days) {
      const daysCount = parseInt(days) || 7;
      const todayRange = getISTDayRange();
      endDate = todayRange.endDate;
      startDate = new Date(todayRange.startDate.getTime() - (daysCount - 1) * 24 * 60 * 60 * 1000);
    } else {
      const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const range = getISTMonthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date range');
    }

    // Today's date range in IST
    const { startDate: todayStart, endDate: todayEnd } = getISTDayRange();

    // Run queries concurrently in parallel for sub-50ms performance
    const [
      totalBillsRes,
      totalOrdersRes,
      todayStatsRes,
      dailyRevenueRes,
      periodStatsRes,
      paymentModeStatsRes,
      deliveryOrdersStatsRes,
      takeawayOrdersStatsRes
    ] = await Promise.allSettled([
      // 1. Total bills count (all time)
      Bill.countDocuments({ status: 'Paid' }),
      // 2. Total orders count (all time)
      Bill.countDocuments(),
      // 3. Today's statistics
      Bill.aggregate([
        {
          $match: {
            $or: [
              { createdAt: { $gte: todayStart, $lte: todayEnd } },
              { clearedAt: { $gte: todayStart, $lte: todayEnd } }
            ],
            status: 'Paid'
          }
        },
        {
          $project: {
            total: { $ifNull: ['$total', 0] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalBills: { $sum: 1 },
            totalOrders: { $sum: 1 },
            averageBill: { $avg: '$total' }
          }
        }
      ]),
      // 4. Daily revenue breakdown for the specified period (IST timezone)
      Bill.aggregate([
        {
          $match: {
            $or: [
              { createdAt: { $gte: startDate, $lte: endDate } },
              { clearedAt: { $gte: startDate, $lte: endDate } }
            ],
            status: 'Paid'
          }
        },
        {
          $project: {
            total: { $ifNull: ['$total', 0] },
            createdAt: 1
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TIMEZONE }
            },
            revenue: { $sum: '$total' },
            bills: { $sum: 1 },
            orders: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]),
      // 5. Overall statistics for the period
      Bill.aggregate([
        {
          $match: {
            $or: [
              { createdAt: { $gte: startDate, $lte: endDate } },
              { clearedAt: { $gte: startDate, $lte: endDate } }
            ],
            status: 'Paid'
          }
        },
        {
          $project: {
            total: { $ifNull: ['$total', 0] },
            discount: { $ifNull: ['$discount', 0] },
            tax: { $ifNull: ['$tax', 0] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalBills: { $sum: 1 },
            totalOrders: { $sum: 1 },
            averageBill: { $avg: '$total' },
            totalDiscount: { $sum: '$discount' },
            totalTax: { $sum: '$tax' }
          }
        }
      ]),
      // 6. Paid bills for accurate payment mode breakdown (including Mixed split payments)
      Bill.find({
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { clearedAt: { $gte: startDate, $lte: endDate } }
        ],
        status: 'Paid'
      }).select('total paymentMode splitPayments').lean(),
      // 7. Delivery orders count for the period
      Bill.countDocuments({
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { clearedAt: { $gte: startDate, $lte: endDate } }
        ],
        status: 'Paid',
        billType: 'Delivery'
      }),
      // 8. Takeaway orders count for the period
      Bill.countDocuments({
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { clearedAt: { $gte: startDate, $lte: endDate } }
        ],
        status: 'Paid',
        billType: 'Takeaway'
      })
    ]);

    const totalBills = totalBillsRes.status === 'fulfilled' ? totalBillsRes.value : 0;
    const totalOrders = totalOrdersRes.status === 'fulfilled' ? totalOrdersRes.value : 0;
    const todayStats = todayStatsRes.status === 'fulfilled' ? todayStatsRes.value : [];
    const dailyRevenue = dailyRevenueRes.status === 'fulfilled' ? dailyRevenueRes.value : [];
    const periodStats = periodStatsRes.status === 'fulfilled' ? periodStatsRes.value : [];
    const paidBillsForPayment = paymentModeStatsRes.status === 'fulfilled' ? paymentModeStatsRes.value : [];
    const deliveryOrdersStats = deliveryOrdersStatsRes.status === 'fulfilled' ? deliveryOrdersStatsRes.value : 0;
    const takeawayOrdersStats = takeawayOrdersStatsRes.status === 'fulfilled' ? takeawayOrdersStatsRes.value : 0;

    const today = todayStats[0] || {
      totalRevenue: 0,
      totalBills: 0,
      totalOrders: 0,
      averageBill: 0
    };

    const period = periodStats[0] || {
      totalRevenue: 0,
      totalBills: 0,
      totalOrders: 0,
      averageBill: 0,
      totalDiscount: 0,
      totalTax: 0
    };

    // Calculate accurate payment mode breakdown (allocating Mixed split payments)
    const paymentTotals = { Cash: 0, UPI: 0, Card: 0 };
    const paymentCounts = { Cash: 0, UPI: 0, Card: 0 };
    (paidBillsForPayment || []).forEach(b => {
      if (b.paymentMode === 'Cash') {
        paymentTotals.Cash += b.total || 0;
        paymentCounts.Cash += 1;
      } else if (b.paymentMode === 'UPI') {
        paymentTotals.UPI += b.total || 0;
        paymentCounts.UPI += 1;
      } else if (b.paymentMode === 'Card') {
        paymentTotals.Card += b.total || 0;
        paymentCounts.Card += 1;
      } else if (b.paymentMode === 'Mixed' && b.splitPayments) {
        const cash = Number(b.splitPayments.cash) || 0;
        const upi = Number(b.splitPayments.upi) || 0;
        const card = Number(b.splitPayments.card) || 0;
        
        if (cash === 0 && upi === 0 && card === 0) {
          // Fallback for old records with missing split data
          paymentTotals.Cash += b.total || 0;
          paymentCounts.Cash += 1;
        } else {
          if (cash > 0) { paymentTotals.Cash += cash; paymentCounts.Cash += 1; }
          if (upi > 0) { paymentTotals.UPI += upi; paymentCounts.UPI += 1; }
          if (card > 0) { paymentTotals.Card += card; paymentCounts.Card += 1; }
        }
      } else if (b.paymentMode) {
        paymentTotals[b.paymentMode] = (paymentTotals[b.paymentMode] || 0) + (b.total || 0);
        paymentCounts[b.paymentMode] = (paymentCounts[b.paymentMode] || 0) + 1;
      }
    });

    const validPaymentModeStats = Object.keys(paymentTotals)
      .filter(mode => paymentTotals[mode] > 0)
      .map(mode => ({ _id: mode, count: paymentCounts[mode] || 1, revenue: paymentTotals[mode] }));

    // Ensure dailyRevenue is an array
    const validDailyRevenue = Array.isArray(dailyRevenue) ? dailyRevenue : [];

    res.json({
      summary: {
        totalBills: Number(totalBills) || 0,
        totalOrders: Number(totalOrders) || 0,
        today: {
          revenue: Number(today.totalRevenue) || 0,
          bills: Number(today.totalBills) || 0,
          orders: Number(today.totalOrders) || 0,
          averageBill: Math.round(Number(today.averageBill) || 0)
        },
        period: {
          revenue: Number(period.totalRevenue) || 0,
          netRevenue: Math.max(0, (Number(period.totalRevenue) || 0) - (Number(period.totalTax) || 0)),
          bills: Number(period.totalBills) || 0,
          orders: Number(period.totalOrders) || 0,
          averageBill: Math.round(Number(period.averageBill) || 0),
          discount: Number(period.totalDiscount) || 0,
          tax: Number(period.totalTax) || 0,
          deliveryOrders: Number(deliveryOrdersStats) || 0,
          pickupOrders: Number(takeawayOrdersStats) || 0
        }
      },
      dailyRevenue: validDailyRevenue,
      paymentModeStats: validPaymentModeStats
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    console.error('Error stack:', error.stack);
    
    // Always return default response to prevent frontend failure
    const defaultResponse = {
      summary: {
        totalBills: 0,
        totalOrders: 0,
        today: {
          revenue: 0,
          bills: 0,
          orders: 0,
          averageBill: 0
        },
        period: {
          revenue: 0,
          bills: 0,
          orders: 0,
          averageBill: 0,
          discount: 0,
          tax: 0,
          deliveryOrders: 0,
          pickupOrders: 0
        }
      },
      dailyRevenue: [],
      paymentModeStats: []
    };
    
    // Return 200 with default data so analytics page doesn't break
    res.status(200).json(defaultResponse);
  }
};

// Download daily report in CSV format (Delegated to Background Worker in Phase 7)
export const downloadDailyReportCSV = async (req, res) => {
  try {
    const { month, year, days } = req.query;
    const tenantDb = req.tenantDb || req.user?.db || 'default';
    const userId = req.user?.id;

    let startDate, endDate, periodName;

    if (month && year) {
      const monthNum = parseInt(month) - 1;
      const yearNum = parseInt(year);
      startDate = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));
      periodName = `${new Date(yearNum, monthNum).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
    } else if (days) {
      const daysCount = parseInt(days);
      const now = new Date();
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - daysCount);
      startDate.setUTCHours(0, 0, 0, 0);
      periodName = `Last ${daysCount} Days`;
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      periodName = `${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
    }

    // Phase 7: Extract to Background Queue
    const { ReportQueue } = await import('../workers/queueManager.js');
    const job = await ReportQueue.add('generateReport', {
      tenantDb,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      periodName,
      type: 'CSV_DAILY',
      userId
    });

    console.log(`[Report API] Added CSV_DAILY job ${job.id} to ReportQueue for tenant ${tenantDb}`);

    res.status(202).json({ 
      success: true, 
      message: 'Report generation started in the background. You will be notified when it is ready.',
      jobId: job.id
    });
  } catch (error) {
    console.error('Error queuing CSV report:', error);
    res.status(500).json({ message: error.message });
  }
};

// Download monthly/custom report in Excel format (Delegated to Background Worker in Phase 7)
export const downloadMonthlyReportExcel = async (req, res) => {
  try {
    const { month, year, days, date, customStart, customEnd, restaurantName } = req.query;
    const tenantDb = req.tenantDb || req.user?.db || 'default';
    const userId = req.user?.id;

    let startDate, endDate, periodName;

    if (customStart && customEnd) {
      const parsedStart = new Date(customStart);
      startDate = new Date(Date.UTC(parsedStart.getUTCFullYear(), parsedStart.getUTCMonth(), parsedStart.getUTCDate(), 0, 0, 0, 0));
      const parsedEnd = new Date(customEnd);
      endDate = new Date(Date.UTC(parsedEnd.getUTCFullYear(), parsedEnd.getUTCMonth(), parsedEnd.getUTCDate(), 23, 59, 59, 999));
      periodName = `${parsedStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${parsedEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (date) {
      const parsedDate = new Date(date);
      startDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 0, 0, 0, 0));
      endDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 23, 59, 59, 999));
      periodName = `${parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    } else if (month && year) {
      const monthNum = parseInt(month) - 1;
      const yearNum = parseInt(year);
      startDate = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));
      periodName = `${new Date(yearNum, monthNum).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
    } else if (days) {
      const daysCount = parseInt(days);
      const now = new Date();
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - daysCount);
      startDate.setUTCHours(0, 0, 0, 0);
      periodName = `Last ${daysCount} Days`;
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      periodName = `${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
    }

    // Phase 7: Extract to Background Queue
    const { ReportQueue } = await import('../workers/queueManager.js');
    const job = await ReportQueue.add('generateReport', {
      tenantDb,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      periodName,
      type: 'EXCEL_MONTHLY',
      userId,
      restaurantName
    });

    console.log(`[Report API] Added EXCEL_MONTHLY job ${job.id} to ReportQueue for tenant ${tenantDb}`);

    res.status(202).json({ 
      success: true, 
      message: 'Excel Report generation started in the background. You will be notified when it is ready.',
      jobId: job.id
    });
  } catch (error) {
    console.error('Error queuing Excel report:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get DayBook (Day-wise Bill)
export const getDayBook = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const Expense = getTenantModel(req, 'Expense', ExpenseDefault);
    const { date } = req.query;
    let startDate, endDate;

    if (date) {
      const r = getISTDayRange(date);
      startDate = r.startDate;
      endDate = r.endDate;
    } else {
      const r = getISTDayRange();
      startDate = r.startDate;
      endDate = r.endDate;
    }

    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date');
    }

    // Fetch Bills and Expenses concurrently in parallel
    const [bills, expenses] = await Promise.all([
      Bill.find({
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { clearedAt: { $gte: startDate, $lte: endDate } }
        ],
        status: 'Paid'
      }).select('billNumber tableNo total paymentMode upiApp splitPayments customerName createdAt clearedAt').lean(),
      Expense.find({
        date: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);

    // Summaries
    let totalSales = 0;
    let totalExpenses = 0;
    
    // Cash Flow breakdown
    const cashFlow = {
      cashIn: 0,
      cashOut: 0,
      onlineIn: { total: 0, upiApps: {} },
      onlineOut: 0
    };

    const transactions = [];

    // Process Bills (Sales / Inflow)
    (bills || []).forEach(bill => {
      totalSales += bill.total || 0;
      let billCashIn = 0;
      let billOnlineIn = 0;
      
      if (bill.paymentMode === 'Cash') {
        cashFlow.cashIn += bill.total || 0;
        billCashIn = bill.total || 0;
      } else if (bill.paymentMode === 'UPI') {
        cashFlow.onlineIn.total += bill.total || 0;
        const appName = bill.upiApp || 'UPI Other';
        if (!cashFlow.onlineIn.upiApps[appName]) cashFlow.onlineIn.upiApps[appName] = 0;
        cashFlow.onlineIn.upiApps[appName] += bill.total || 0;
        billOnlineIn = bill.total || 0;
      } else if (bill.paymentMode === 'Card') {
        cashFlow.onlineIn.total += bill.total || 0;
        const appName = 'Card';
        if (!cashFlow.onlineIn.upiApps[appName]) cashFlow.onlineIn.upiApps[appName] = 0;
        cashFlow.onlineIn.upiApps[appName] += bill.total || 0;
        billOnlineIn = bill.total || 0;
      } else if (bill.paymentMode === 'Mixed' && bill.splitPayments) {
        const splitCash = Number(bill.splitPayments.cash) || 0;
        const splitUpi = Number(bill.splitPayments.upi) || 0;
        const splitCard = Number(bill.splitPayments.card) || 0;
        
        if (splitCash === 0 && splitUpi === 0 && splitCard === 0) {
          // Fallback for old records with missing split data
          cashFlow.cashIn += bill.total || 0;
          billCashIn = bill.total || 0;
        } else {
          cashFlow.cashIn += splitCash;
          billCashIn = splitCash;
          billOnlineIn = splitUpi + splitCard;
          if (splitUpi > 0) {
            cashFlow.onlineIn.total += splitUpi;
            const appName = bill.upiApp || 'UPI Other';
            if (!cashFlow.onlineIn.upiApps[appName]) cashFlow.onlineIn.upiApps[appName] = 0;
            cashFlow.onlineIn.upiApps[appName] += splitUpi;
          }
          if (splitCard > 0) {
            cashFlow.onlineIn.total += splitCard;
            if (!cashFlow.onlineIn.upiApps['Card']) cashFlow.onlineIn.upiApps['Card'] = 0;
            cashFlow.onlineIn.upiApps['Card'] += splitCard;
          }
        }
      } else {
        cashFlow.cashIn += bill.total || 0;
        billCashIn = bill.total || 0;
      }

      transactions.push({
        type: 'Sale',
        id: bill._id,
        particulars: bill.billNumber ? `#${bill.billNumber}` : 'Sale',
        name: bill.customerName || '--',
        paymentMode: bill.paymentMode || 'Cash',
        total: bill.total || 0,
        cashIn: billCashIn,
        onlineIn: billOnlineIn,
        cashOut: 0,
        date: bill.createdAt
      });
    });

    // Process Expenses (Outflow)
    (expenses || []).forEach(exp => {
      totalExpenses += exp.amount || 0;
      
      if (exp.paymentMode === 'Cash') {
        cashFlow.cashOut += exp.amount || 0;
      } else {
        // Any non-cash expense is Online Out
        cashFlow.onlineOut += exp.amount || 0;
      }

      transactions.push({
        type: 'Expense',
        id: exp._id,
        particulars: exp.category || 'Expense',
        name: exp.description || '--',
        total: exp.amount || 0,
        cashIn: 0,
        cashOut: exp.amount || 0,
        date: exp.date || exp.createdAt
      });
    });

    // Sort transactions by date (chronological)
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Convert upiApps object to array for easier frontend rendering
    const onlineInBreakdown = Object.keys(cashFlow.onlineIn.upiApps).map(app => ({
      app,
      amount: cashFlow.onlineIn.upiApps[app]
    }));


    res.json({
      summary: {
        totalSales,
        salesCount: bills.length,
        totalExpenses,
        expensesCount: expenses.length
      },
      cashFlow: {
        cashIn: cashFlow.cashIn,
        cashOut: cashFlow.cashOut,
        onlineIn: cashFlow.onlineIn.total,
        onlineOut: cashFlow.onlineOut,
        onlineInBreakdown
      },
      transactions
    });
  } catch (error) {
    console.error('Error fetching daybook:', error);
    res.status(500).json({ message: 'Error fetching daybook', error: error.message });
  }
};

export const buildDayBookWorkbookHelper = async (req, date, restaurantName) => {
  const Bill = getTenantModel(req, 'Bill', BillDefault);
  const Expense = getTenantModel(req, 'Expense', ExpenseDefault);
  if (!date) {
    throw new Error('Date is required');
  }

  const { startDate, endDate } = getISTDayRange(date);

  const [allBills, expenses] = await Promise.all([
    Bill.find({ createdAt: { $gte: startDate, $lte: endDate } })
      .select('billNumber customerName paymentMode splitPayments upiApp total createdAt status')
      .lean(),
    Expense.find({ 
      $or: [
        { date: { $gte: startDate, $lte: endDate } },
        { createdAt: { $gte: startDate, $lte: endDate }, date: { $exists: false } }
      ]
    }).lean()
  ]);

  let totalSales = 0;
  let totalExpenses = 0;
  let cashFlow = {
    cashIn: 0,
    cashOut: 0,
    onlineIn: { total: 0, upiApps: {} },
    onlineOut: 0
  };
  const transactions = [];
  let revenueLeakage = 0;
  const bills = [];

  allBills.forEach(bill => {
    if (bill.status === 'Paid') {
      bills.push(bill);
    } else {
      revenueLeakage += bill.total || 0;
    }
  });

  bills.forEach(bill => {
    totalSales += bill.total || 0;
    let billCashIn = 0;
    let billOnlineIn = 0;

    if (bill.paymentMode === 'Cash') {
      cashFlow.cashIn += bill.total || 0;
      billCashIn = bill.total || 0;
    } else if (bill.paymentMode === 'Card') {
      cashFlow.onlineIn.total += bill.total || 0;
      cashFlow.onlineIn.upiApps['Card'] = (cashFlow.onlineIn.upiApps['Card'] || 0) + (bill.total || 0);
      billOnlineIn = bill.total || 0;
    } else if (bill.paymentMode === 'UPI') {
      const appName = bill.upiApp || 'UPI';
      cashFlow.onlineIn.total += bill.total || 0;
      cashFlow.onlineIn.upiApps[appName] = (cashFlow.onlineIn.upiApps[appName] || 0) + (bill.total || 0);
      billOnlineIn = bill.total || 0;
    } else if (bill.paymentMode === 'Mixed' && bill.splitPayments) {
      const splitCash = Number(bill.splitPayments.cash) || 0;
      const splitUpi = Number(bill.splitPayments.upi) || 0;
      const splitCard = Number(bill.splitPayments.card) || 0;
      cashFlow.cashIn += splitCash;
      billCashIn = splitCash;
      billOnlineIn = splitUpi + splitCard;
      if (splitUpi > 0) {
        cashFlow.onlineIn.total += splitUpi;
        const appName = bill.upiApp || 'UPI';
        cashFlow.onlineIn.upiApps[appName] = (cashFlow.onlineIn.upiApps[appName] || 0) + splitUpi;
      }
      if (splitCard > 0) {
        cashFlow.onlineIn.total += splitCard;
        cashFlow.onlineIn.upiApps['Card'] = (cashFlow.onlineIn.upiApps['Card'] || 0) + splitCard;
      }
    } else {
      cashFlow.onlineIn.total += bill.total || 0;
      cashFlow.onlineIn.upiApps['Other Online'] = (cashFlow.onlineIn.upiApps['Other Online'] || 0) + (bill.total || 0);
      billOnlineIn = bill.total || 0;
    }

    transactions.push({
      type: 'Sale',
      id: bill._id,
      particulars: bill.billNumber || 'Sale',
      name: bill.customerName || '--',
      paymentMode: bill.paymentMode || 'Cash',
      total: bill.total || 0,
      cashIn: billCashIn,
      onlineIn: billOnlineIn,
      cashOut: 0,
      date: bill.createdAt
    });
  });

  expenses.forEach(exp => {
    totalExpenses += exp.amount || 0;
    if (exp.paymentMode === 'Cash') {
      cashFlow.cashOut += exp.amount || 0;
    } else {
      cashFlow.onlineOut += exp.amount || 0;
    }
    transactions.push({
      type: 'Expense',
      id: exp._id,
      particulars: exp.category || 'Expense',
      name: exp.description || '--',
      paymentMode: exp.paymentMode,
      total: exp.amount || 0,
      cashIn: 0,
      cashOut: exp.amount || 0,
      date: exp.date || exp.createdAt
    });
  });

  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  const workbook = generateDayBookWorkbook(restaurantName, date, transactions, cashFlow, revenueLeakage);
  return { workbook, date, totalSales, totalExpenses };
};

export const exportDayBookExcel = async (req, res) => {
  try {
    const { date, restaurantName } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const { workbook } = await buildDayBookWorkbookHelper(req, date, restaurantName);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=DayBook_${date}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error('Error exporting daybook excel:', error);
    res.status(500).json({ message: 'Error exporting daybook', error: error.message });
  }
};

export const sendDayBookWhatsApp = async (req, res) => {
  try {
    const { phone, date, restaurantName, message } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Destination phone number is required.' });
    }

    const { whatsappService } = await resolveTenantInfo(req);
    await whatsappService.ensureConnection();
    const status = whatsappService.getStatus();
    if (status.status !== 'CONNECTED' && !whatsappService.connectedNumber) {
      return res.status(400).json({ error: 'WhatsApp is not connected on server. Please link WhatsApp in Settings.' });
    }

    const { workbook } = await buildDayBookWorkbookHelper(req, date, restaurantName);
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    await whatsappService.sendBillMedia(phone, {
      documentBase64: base64,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `DayBook-${date || 'Report'}.xlsx`,
      caption: message || `📊 *Day Book Report - ${date}*`
    });

    res.json({ success: true, message: 'Day Book sent to WhatsApp successfully!' });
  } catch (error) {
    console.error('Error sending Day Book via WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
};

export const sendAnalyticsWhatsApp = async (req, res) => {
  try {
    const { phone, month, year, days, date, customStart, customEnd, restaurantName, caption } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Destination phone number is required.' });
    }

    const { whatsappService } = await resolveTenantInfo(req);
    await whatsappService.ensureConnection();
    const status = whatsappService.getStatus();
    if (status.status !== 'CONNECTED' && !whatsappService.connectedNumber) {
      return res.status(400).json({ error: 'WhatsApp is not connected on server. Please link WhatsApp in Settings.' });
    }

    const Bill = getTenantModel(req, 'Bill', BillDefault);
    let startDate, endDate, periodName;

    if (customStart && customEnd) {
      const parsedStart = new Date(customStart);
      startDate = new Date(Date.UTC(parsedStart.getUTCFullYear(), parsedStart.getUTCMonth(), parsedStart.getUTCDate(), 0, 0, 0, 0));
      const parsedEnd = new Date(customEnd);
      endDate = new Date(Date.UTC(parsedEnd.getUTCFullYear(), parsedEnd.getUTCMonth(), parsedEnd.getUTCDate(), 23, 59, 59, 999));
      periodName = `${parsedStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${parsedEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (date) {
      const parsedDate = new Date(date);
      startDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 0, 0, 0, 0));
      endDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 23, 59, 59, 999));
      periodName = `${parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    } else if (month && year) {
      const monthNum = parseInt(month) - 1;
      const yearNum = parseInt(year);
      startDate = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));
      periodName = `${new Date(yearNum, monthNum).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
    } else if (days) {
      const daysCount = parseInt(days);
      const now = new Date();
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - daysCount);
      startDate.setUTCHours(0, 0, 0, 0);
      periodName = `Last ${daysCount} Days`;
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      periodName = `${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
    }

    const bills = await Bill.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'Paid'
    })
    .select('billNumber tableNo items subtotal discount tax total paymentMode billType orderSource createdAt')
    .sort({ createdAt: -1 })
    .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.mergeCells('A1:L1');
    const titleRow = worksheet.getRow(1);
    titleRow.height = 36;
    const titleCell = titleRow.getCell(1);
    const displayRestName = restaurantName ? restaurantName.toUpperCase() : 'RESTAURANT';
    titleCell.value = `${displayRestName} - Sales Report (${periodName})`;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getRow(2).height = 10;
    const headerRow = worksheet.getRow(3);
    headerRow.height = 28;
    headerRow.values = ['Date', 'Time', 'Bill ID', 'Bill Type', 'Table / Order', 'Item Count', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Mode', 'Platform'];
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

    bills.forEach((bill, index) => {
      const row = worksheet.getRow(index + 4);
      row.height = 22;
      const d = new Date(bill.createdAt);
      row.values = [
        d.toLocaleDateString('en-IN'),
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        bill.billNumber || '',
        bill.billType || 'Dine-In',
        bill.tableNo || '',
        bill.items ? bill.items.length : 0,
        Number(bill.subtotal || 0),
        Number(bill.discount || 0),
        Number(bill.tax || 0),
        Number(bill.total || 0),
        bill.paymentMode || '',
        bill.orderSource || ''
      ];
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    await whatsappService.sendBillMedia(phone, {
      documentBase64: base64,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `Sales_${periodName.replace(/\s+/g, '_')}.xlsx`,
      caption: caption || `📊 *Sales Report (${periodName})*`
    });

    res.json({ success: true, message: 'Analytics report sent via WhatsApp successfully!' });
  } catch (error) {
    console.error('Error sending Analytics via WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
};

// Download secure generated report via ID
export const downloadSecureReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const tenantDb = req.tenantDb;

    if (!reportId || !tenantDb) {
      return res.status(400).json({ message: 'Missing reportId or tenant context' });
    }

    const report = await Report.findOne({ reportId, tenantDb });

    if (!report) {
      // If it doesn't exist or belongs to another tenant, we return 404 safely
      return res.status(404).json({ message: 'Report not found' });
    }

    // Protection against path traversal and arbitrary files
    if (report.status === 'expired') {
      return res.status(410).json({ message: 'Report has expired and been deleted' });
    }

    const normalizedPath = path.normalize(report.filePath);
    const secureDir = path.join(process.cwd(), 'secure_reports');
    if (!normalizedPath.startsWith(secureDir)) {
      console.warn(`[Security Alert] Traversal attempt blocked: ${normalizedPath} by tenant ${tenantDb}`);
      return res.status(403).json({ message: 'Invalid report path' });
    }

    if (!fs.existsSync(normalizedPath)) {
      // Auto-update to expired if missing on disk
      await Report.updateOne({ reportId }, { $set: { status: 'expired' } });
      return res.status(410).json({ message: 'Report file is no longer available on the server' });
    }

    // Security Headers & Download Stream
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.download(normalizedPath, report.filename, (err) => {
      if (err) {
        if (res.headersSent) {
          console.error('[Download] Headers sent, unable to send error response.', err);
        } else {
          res.status(500).json({ message: 'Failed to download report file' });
        }
      }
    });

  } catch (error) {
    console.error('Error downloading secure report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
