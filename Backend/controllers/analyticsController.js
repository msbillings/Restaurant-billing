import BillDefault from '../models/Bill.js';
import ExpenseDefault from '../models/Expense.js';
import ExcelJS from 'exceljs';
import { getTenantModel } from '../utils/tenantHelper.js';

// Get comprehensive analytics
export const getAnalytics = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { month, year, days, date } = req.query;
    
    let startDate, endDate;
    
    // Use UTC dates to avoid timezone issues in production
    // MongoDB stores dates in UTC, so we need to query in UTC
    if (date) {
      const parsedDate = new Date(date);
      startDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 0, 0, 0, 0));
      endDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 23, 59, 59, 999));
    } else if (month && year) {
      const monthNum = parseInt(month) - 1; // JavaScript months are 0-indexed
      const yearNum = parseInt(year);
      startDate = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0, 0));
      
      // Get last day of the month
      endDate = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));
    } else if (days) {
      // Fallback to days if provided
      const daysCount = parseInt(days);
      const now = new Date();
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      startDate = new Date(endDate);
      startDate.setUTCDate(startDate.getUTCDate() - daysCount);
      startDate.setUTCHours(0, 0, 0, 0);
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }

    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date range');
    }

    // Today's date range (UTC)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    // Optimize: Run queries in parallel for better performance
    // Handle each query separately to catch individual errors
    let totalBills = 0;
    let totalOrders = 0;
    let todayStats = [];
    let dailyRevenue = [];
    let periodStats = [];
    let paymentModeStats = [];
    let deliveryOrdersStats = 0;

    try {
      // Total bills count (all time)
      totalBills = await Bill.countDocuments({ status: 'Paid' });
    } catch (error) {
      console.error('Error counting total bills:', error);
      totalBills = 0;
    }

    try {
      // Total orders count (all time - includes all statuses)
      totalOrders = await Bill.countDocuments();
    } catch (error) {
      console.error('Error counting total orders:', error);
      totalOrders = 0;
    }

    try {
      // Today's statistics
      todayStats = await Bill.aggregate([
        {
          $match: {
            createdAt: { $gte: todayStart, $lte: todayEnd },
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
      ]);
    } catch (error) {
      console.error('Error in todayStats aggregation:', error);
      todayStats = [];
    }

    try {
      // Daily revenue breakdown for the specified period
      dailyRevenue = await Bill.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
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
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            revenue: { $sum: '$total' },
            bills: { $sum: 1 },
            orders: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
    } catch (error) {
      console.error('Error in dailyRevenue aggregation:', error);
      dailyRevenue = [];
    }

    try {
      // Overall statistics for the period
      periodStats = await Bill.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
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
      ]);
    } catch (error) {
      console.error('Error in periodStats aggregation:', error);
      periodStats = [];
    }

    try {
      // Payment mode breakdown
      paymentModeStats = await Bill.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'Paid',
            paymentMode: { $exists: true, $ne: null }
          }
        },
        {
          $project: {
            paymentMode: 1,
            total: { $ifNull: ['$total', 0] }
          }
        },
        {
          $group: {
            _id: '$paymentMode',
            count: { $sum: 1 },
            revenue: { $sum: '$total' }
          }
        }
      ]);
    } catch (error) {
      console.error('Error in paymentModeStats aggregation:', error);
      paymentModeStats = [];
    }

    try {
      // Delivery orders count for the period
      // Only count orders with billType === 'Delivery'
      deliveryOrdersStats = await Bill.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'Paid',
        billType: 'Delivery'
      });
    } catch (error) {
      console.error('Error counting delivery orders:', error);
      deliveryOrdersStats = 0;
    }

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

    // Ensure paymentModeStats is an array and filter out null values
    const validPaymentModeStats = Array.isArray(paymentModeStats) 
      ? paymentModeStats.filter(p => p._id !== null && p._id !== undefined)
      : [];

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
          bills: Number(period.totalBills) || 0,
          orders: Number(period.totalOrders) || 0,
          averageBill: Math.round(Number(period.averageBill) || 0),
          discount: Number(period.totalDiscount) || 0,
          tax: Number(period.totalTax) || 0,
          deliveryOrders: Number(deliveryOrdersStats) || 0
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
          deliveryOrders: 0
        }
      },
      dailyRevenue: [],
      paymentModeStats: []
    };
    
    // Return 200 with default data so analytics page doesn't break
    res.status(200).json(defaultResponse);
  }
};

// Download daily report in CSV format
export const downloadDailyReportCSV = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { month, year, days } = req.query;

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

    const bills = await Bill.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'Paid'
    }).sort({ createdAt: -1 });

    // CSV Header
    let csv = 'Date,Time,Bill ID,Table,Items,Subtotal,Discount,Tax,Total,Payment Mode\n';

    // CSV Data
    bills.forEach(bill => {
      const date = new Date(bill.createdAt).toLocaleDateString('en-IN');
      const time = new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const items = bill.items.map(item => `${item.name}(${item.quantity})`).join('; ');
      csv += `${date},${time},${bill._id},${bill.tableNo},"${items}",${bill.subtotal},${bill.discount},${bill.tax},${bill.total},${bill.paymentMode}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="daily-report-${periodName.replace(/\s+/g, '-').toLowerCase()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error generating CSV report:', error);
    res.status(500).json({ message: error.message });
  }
};

// Download monthly report in Excel format
export const downloadMonthlyReportExcel = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { month, year } = req.query;

    let startDate, endDate, periodName;

    if (month && year) {
      const monthNum = parseInt(month) - 1;
      const yearNum = parseInt(year);
      startDate = new Date(Date.UTC(yearNum, monthNum, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(yearNum, monthNum + 1, 0, 23, 59, 59, 999));
      periodName = `${new Date(yearNum, monthNum).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
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
    const worksheet = workbook.addWorksheet('Monthly Report');

    // Add title
    worksheet.mergeCells('A1:L1');
    worksheet.getCell('A1').value = `Restaurant Billing Report - ${periodName}`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add headers
    worksheet.getRow(3).values = ['Date', 'Time', 'Bill ID', 'Bill Type', 'Table/Order', 'Item Count', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Mode', 'Platform'];
    worksheet.getRow(3).font = { bold: true };
    worksheet.getRow(3).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };
    });

    // Calculate payment method totals
    const paymentTotals = {
      Card: 0,
      UPI: 0,
      Cash: 0
    };

    // Add data
    bills.forEach((bill, index) => {
      const row = worksheet.getRow(index + 4);
      
      // Determine platform for delivery orders
      let platform = '';
      if (bill.billType === 'Delivery' && bill.orderSource) {
        platform = bill.orderSource;
      }
      
      // Calculate item count
      const itemCount = bill.items ? bill.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
      
      // Calculate payment totals
      if (bill.paymentMode && paymentTotals.hasOwnProperty(bill.paymentMode)) {
        paymentTotals[bill.paymentMode] += bill.total || 0;
      }
      
      row.values = [
        new Date(bill.createdAt).toLocaleDateString('en-IN'),
        new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        bill.billNumber || '', // Use billNumber instead of _id
        bill.billType || 'Dine-In',
        bill.tableNo || '',
        itemCount,
        bill.subtotal || 0,
        bill.discount || 0,
        bill.tax || 0,
        bill.total || 0,
        bill.paymentMode || '',
        platform
      ];
    });

    // Auto-fit columns
    worksheet.columns.forEach((column, index) => {
      if (index === 2) { // Bill ID
        column.width = 20;
      } else if (index === 3) { // Bill Type
        column.width = 12;
      } else if (index === 4) { // Table/Order
        column.width = 15;
      } else if (index === 5) { // Item Count
        column.width = 12;
      } else if (index >= 6 && index <= 9) { // Financial columns
        column.width = 14;
      } else {
        column.width = 15;
      }
    });

    // Format financial columns as currency
    const financialColumns = [6, 7, 8, 9]; // Subtotal, Discount, Tax, Total
    bills.forEach((bill, index) => {
      financialColumns.forEach(colIndex => {
        const cell = worksheet.getCell(index + 4, colIndex + 1);
        cell.numFmt = '#,##0.00';
      });
    });

    // Add summary at the bottom
    const totalRow = bills.length + 4;
    const summaryRow = worksheet.getRow(totalRow);
    summaryRow.values = [
      'TOTAL',
      '',
      '',
      '',
      '',
      bills.reduce((sum, bill) => sum + (bill.items ? bill.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0), 0),
      bills.reduce((sum, bill) => sum + (bill.subtotal || 0), 0),
      bills.reduce((sum, bill) => sum + (bill.discount || 0), 0),
      bills.reduce((sum, bill) => sum + (bill.tax || 0), 0),
      bills.reduce((sum, bill) => sum + (bill.total || 0), 0),
      '',
      ''
    ];
    summaryRow.font = { bold: true };
    financialColumns.forEach(colIndex => {
      const cell = worksheet.getCell(totalRow, colIndex + 1);
      cell.numFmt = '#,##0.00';
    });

    // Add payment method totals
    const cardRow = worksheet.getRow(totalRow + 1);
    cardRow.values = [
      'CARD TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      paymentTotals.Card,
      'Card',
      ''
    ];
    cardRow.font = { bold: true };
    worksheet.getCell(totalRow + 1, 10).numFmt = '#,##0.00';

    const upiRow = worksheet.getRow(totalRow + 2);
    upiRow.values = [
      'UPI TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      paymentTotals.UPI,
      'UPI',
      ''
    ];
    upiRow.font = { bold: true };
    worksheet.getCell(totalRow + 2, 10).numFmt = '#,##0.00';

    const cashRow = worksheet.getRow(totalRow + 3);
    cashRow.values = [
      'CASH TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      paymentTotals.Cash,
      'Cash',
      ''
    ];
    cashRow.font = { bold: true };
    worksheet.getCell(totalRow + 3, 10).numFmt = '#,##0.00';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${periodName.replace(/\s+/g, '-').toLowerCase()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel report:', error);
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
      const parsedDate = new Date(date);
      startDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 0, 0, 0, 0));
      endDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 23, 59, 59, 999));
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    }

    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date');
    }

    // 1. Fetch Sales (Bills)
    const bills = await Bill.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'Paid'
    }).select('billNumber tableNo total paymentMode upiApp customerName createdAt').lean();

    // 2. Fetch Expenses
    const expenses = await Expense.find({
      date: { $gte: startDate, $lte: endDate }
    }).lean();

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
    bills.forEach(bill => {
      totalSales += bill.total || 0;
      
      if (bill.paymentMode === 'Cash') {
        cashFlow.cashIn += bill.total || 0;
      } else if (bill.paymentMode === 'UPI' || bill.paymentMode === 'Card') {
        cashFlow.onlineIn.total += bill.total || 0;
        
        if (bill.paymentMode === 'UPI') {
          const appName = bill.upiApp || 'UPI Other';
          if (!cashFlow.onlineIn.upiApps[appName]) cashFlow.onlineIn.upiApps[appName] = 0;
          cashFlow.onlineIn.upiApps[appName] += bill.total || 0;
        } else {
          const appName = 'Card';
          if (!cashFlow.onlineIn.upiApps[appName]) cashFlow.onlineIn.upiApps[appName] = 0;
          cashFlow.onlineIn.upiApps[appName] += bill.total || 0;
        }
      }

      transactions.push({
        type: 'Sale',
        id: bill._id,
        particulars: bill.billNumber ? `#${bill.billNumber}` : 'Sale',
        name: bill.customerName || '--',
        total: bill.total || 0,
        cashIn: bill.total || 0,
        cashOut: 0,
        date: bill.createdAt
      });
    });

    // Process Expenses (Outflow)
    expenses.forEach(exp => {
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

export const exportDayBookExcel = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const Expense = getTenantModel(req, 'Expense', ExpenseDefault);
    const { date, restaurantName } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const [allBills, expenses] = await Promise.all([
      Bill.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean(),
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
      if (bill.paymentMode === 'Cash') {
        cashFlow.cashIn += bill.total || 0;
      } else {
        cashFlow.onlineIn.total += bill.total || 0;
        if (bill.paymentMode === 'Card') {
          cashFlow.onlineIn.upiApps['Card'] = (cashFlow.onlineIn.upiApps['Card'] || 0) + (bill.total || 0);
        } else if (bill.paymentMode === 'Mixed') {
          cashFlow.onlineIn.upiApps['Mixed'] = (cashFlow.onlineIn.upiApps['Mixed'] || 0) + (bill.total || 0);
        } else if (bill.paymentMode === 'UPI') {
          const appName = bill.upiApp || 'UPI';
          cashFlow.onlineIn.upiApps[appName] = (cashFlow.onlineIn.upiApps[appName] || 0) + (bill.total || 0);
        } else {
          cashFlow.onlineIn.upiApps['Other Online'] = (cashFlow.onlineIn.upiApps['Other Online'] || 0) + (bill.total || 0);
        }
      }
      transactions.push({
        type: 'Sale',
        id: bill._id,
        particulars: bill.billNumber || 'Sale',
        name: bill.customerName || '--',
        paymentMode: bill.paymentMode,
        total: bill.total || 0,
        cashIn: bill.total || 0,
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

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('DayBook', {
      properties: { tabColor: { argb: 'FF003366' } }
    });

    // Formatting Helpers
    const titleFont = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF003366' } };
    const subtitleFont = { name: 'Calibri', size: 12, bold: true };
    const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    const borderAll = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const totalsFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    const safeRestoName = restaurantName || 'RESTAURANT';
    
    // Row 1: Main Title
    sheet.mergeCells('A1:H1');
    const titleRow = sheet.getRow(1);
    titleRow.getCell(1).value = `${safeRestoName.toUpperCase()} TRANSACTION SUMMARY REPORT`;
    titleRow.getCell(1).font = titleFont;
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // Row 2: Subtitle
    sheet.mergeCells('A2:H2');
    const subtitleRow = sheet.getRow(2);
    subtitleRow.getCell(1).value = `DayBook Transaction Registry`;
    subtitleRow.getCell(1).font = subtitleFont;
    subtitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Date
    sheet.mergeCells('A3:H3');
    const dateRow = sheet.getRow(3);
    const dateFormatted = new Date(date).toLocaleDateString('en-GB'); // DD/MM/YYYY
    dateRow.getCell(1).value = `Date: ${dateFormatted}`;
    dateRow.getCell(1).font = { name: 'Calibri', size: 11, italic: true };
    dateRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 4: Empty

    // Row 5: Headers
    const headers = ['S.No', 'Time', 'Type', 'Particulars', 'Name', 'Payment Mode', 'Expense (-)', 'Income (+)'];
    const headerRow = sheet.getRow(5);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = headerFont;
      cell.fill = headerFill;
      cell.border = borderAll;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Data Rows
    let currentRow = 6;
    transactions.forEach((t, i) => {
      const row = sheet.getRow(currentRow);
      row.getCell(1).value = i + 1; // S.No
      row.getCell(2).value = new Date(t.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      row.getCell(3).value = t.type;
      row.getCell(4).value = t.particulars;
      row.getCell(5).value = t.name;
      row.getCell(6).value = t.paymentMode || '--';
      
      const outCell = row.getCell(7);
      outCell.value = t.cashOut > 0 ? t.cashOut : '';
      outCell.numFmt = '₹#,##0.00';
      if (t.cashOut > 0) outCell.font = { color: { argb: 'FFFF0000' } }; // Red for Out
      
      const inCell = row.getCell(8);
      inCell.value = t.cashIn > 0 ? t.cashIn : '';
      inCell.numFmt = '₹#,##0.00';
      if (t.cashIn > 0) inCell.font = { color: { argb: 'FF0070C0' } }; // Blue/Green for In

      // Apply borders and alignment
      for(let col = 1; col <= 8; col++) {
        row.getCell(col).border = borderAll;
        if (col === 1 || col === 2 || col === 3 || col === 6) {
           row.getCell(col).alignment = { horizontal: 'center' };
        }
      }
      currentRow++;
    });

    // Row TOTALS
    const totalsRow = sheet.getRow(currentRow);
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const totalsLabelCell = totalsRow.getCell(1);
    totalsLabelCell.value = 'TOTALS:';
    totalsLabelCell.font = { bold: true, size: 12 };
    totalsLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
    
    const totalOutCell = totalsRow.getCell(7);
    totalOutCell.value = cashFlow.cashOut + cashFlow.onlineOut;
    totalOutCell.numFmt = '₹#,##0.00';
    totalOutCell.font = { bold: true, size: 12, color: { argb: 'FFFF0000' } };

    const totalInCell = totalsRow.getCell(8);
    totalInCell.value = cashFlow.cashIn + cashFlow.onlineIn.total;
    totalInCell.numFmt = '₹#,##0.00';
    totalInCell.font = { bold: true, size: 12, color: { argb: 'FF0070C0' } };

    // Apply Fill & Border to Totals row
    for(let col = 1; col <= 8; col++) {
      totalsRow.getCell(col).fill = totalsFill;
      totalsRow.getCell(col).border = borderAll;
    }

    currentRow += 3;

    // Payment Mode Breakdown
    const pmTitleRow = sheet.getRow(currentRow);
    pmTitleRow.getCell(4).value = 'PAYMENT MODE BREAKDOWN';
    pmTitleRow.getCell(4).font = { bold: true, underline: true };
    currentRow++;

    // Breakdown Helper
    const addBreakdownRow = (label, amount) => {
      const r = sheet.getRow(currentRow);
      r.getCell(4).value = label;
      const amtCell = r.getCell(5);
      amtCell.value = amount;
      amtCell.numFmt = '₹#,##0.00';
      amtCell.font = { bold: true };
      
      // Box border for breakdown table
      r.getCell(4).border = borderAll;
      r.getCell(5).border = borderAll;
      currentRow++;
    };

    addBreakdownRow('Total Cash In :', cashFlow.cashIn);
    addBreakdownRow('Total Card In :', cashFlow.onlineIn.upiApps['Card'] || 0);
    
    let totalUpi = 0;
    Object.entries(cashFlow.onlineIn.upiApps).forEach(([app, amount]) => {
      if (app !== 'Card' && app !== 'Mixed' && app !== 'Other Online') totalUpi += amount;
    });
    addBreakdownRow('Total UPI In :', totalUpi);
    addBreakdownRow('Total Mixed In :', cashFlow.onlineIn.upiApps['Mixed'] || 0);
    
    addBreakdownRow('Total Cash Out :', cashFlow.cashOut);
    addBreakdownRow('Total Online Out :', cashFlow.onlineOut);

    currentRow++;
    addBreakdownRow('Revenue Leakage :', revenueLeakage);
    sheet.getRow(currentRow - 1).getCell(4).font = { bold: true, color: { argb: 'FFFF0000' } }; // Highlight leakage in red

    // Set Column Widths
    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 10;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 25;
    sheet.getColumn(6).width = 15;
    sheet.getColumn(7).width = 15;
    sheet.getColumn(8).width = 15;

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
