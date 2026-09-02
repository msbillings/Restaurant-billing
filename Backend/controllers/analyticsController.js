import BillDefault from '../models/Bill.js';
import ExpenseDefault from '../models/Expense.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { generateDayBookWorkbook } from '../utils/excelGenerator.js';
import ExcelJS from 'exceljs';

// Get comprehensive analytics
export const getAnalytics = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { month, year, days, date, customStart, customEnd } = req.query;
    
    let startDate, endDate;
    
    // Use UTC dates to avoid timezone issues in production
    // MongoDB stores dates in UTC, so we need to query in UTC
    if (customStart && customEnd) {
      const parsedStart = new Date(customStart);
      startDate = new Date(Date.UTC(parsedStart.getUTCFullYear(), parsedStart.getUTCMonth(), parsedStart.getUTCDate(), 0, 0, 0, 0));
      const parsedEnd = new Date(customEnd);
      endDate = new Date(Date.UTC(parsedEnd.getUTCFullYear(), parsedEnd.getUTCMonth(), parsedEnd.getUTCDate(), 23, 59, 59, 999));
    } else if (date) {
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
            updatedAt: { $gte: todayStart, $lte: todayEnd },
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
      // 4. Daily revenue breakdown for the specified period
      Bill.aggregate([
        {
          $match: {
            updatedAt: { $gte: startDate, $lte: endDate },
            status: 'Paid'
          }
        },
        {
          $project: {
            total: { $ifNull: ['$total', 0] },
            updatedAt: 1
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' }
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
            updatedAt: { $gte: startDate, $lte: endDate },
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
      // 6. Payment mode breakdown
      Bill.aggregate([
        {
          $match: {
            updatedAt: { $gte: startDate, $lte: endDate },
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
      ]),
      // 7. Delivery orders count for the period
      Bill.countDocuments({
        updatedAt: { $gte: startDate, $lte: endDate },
        status: 'Paid',
        billType: 'Delivery'
      }),
      // 8. Takeaway orders count for the period
      Bill.countDocuments({
        updatedAt: { $gte: startDate, $lte: endDate },
        status: 'Paid',
        billType: 'Takeaway'
      })
    ]);

    const totalBills = totalBillsRes.status === 'fulfilled' ? totalBillsRes.value : 0;
    const totalOrders = totalOrdersRes.status === 'fulfilled' ? totalOrdersRes.value : 0;
    const todayStats = todayStatsRes.status === 'fulfilled' ? todayStatsRes.value : [];
    const dailyRevenue = dailyRevenueRes.status === 'fulfilled' ? dailyRevenueRes.value : [];
    const periodStats = periodStatsRes.status === 'fulfilled' ? periodStatsRes.value : [];
    const paymentModeStats = paymentModeStatsRes.status === 'fulfilled' ? paymentModeStatsRes.value : [];
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

// Download monthly/custom report in Excel format
export const downloadMonthlyReportExcel = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { month, year, days, date, customStart, customEnd, restaurantName } = req.query;

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

    // Row 1: Title
    worksheet.mergeCells('A1:L1');
    const titleRow = worksheet.getRow(1);
    titleRow.height = 36;
    const titleCell = titleRow.getCell(1);
    const displayRestName = restaurantName ? restaurantName.toUpperCase() : 'RESTAURANT';
    titleCell.value = `${displayRestName} - Sales Report (${periodName})`;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Spacer
    worksheet.getRow(2).height = 10;

    // Row 3: Headers
    const headerRow = worksheet.getRow(3);
    headerRow.height = 28;
    headerRow.values = ['Date', 'Time', 'Bill ID', 'Bill Type', 'Table / Order', 'Item Count', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment Mode', 'Platform'];
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    // Calculate payment method totals
    const paymentTotals = {
      Card: 0,
      UPI: 0,
      Cash: 0
    };

    // Add data rows
    bills.forEach((bill, index) => {
      const row = worksheet.getRow(index + 4);
      row.height = 22;
      
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
        bill.billNumber || '',
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

      row.eachCell((cell, colNumber) => {
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: colNumber <= 6 || colNumber >= 11 ? 'center' : 'right' 
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
          right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
        };
      });
    });

    // Configure generous column widths for perfect mobile & desktop view
    worksheet.columns = [
      { key: 'date', width: 14 },
      { key: 'time', width: 12 },
      { key: 'billId', width: 18 },
      { key: 'billType', width: 14 },
      { key: 'table', width: 18 },
      { key: 'itemCount', width: 12 },
      { key: 'subtotal', width: 15 },
      { key: 'discount', width: 14 },
      { key: 'tax', width: 14 },
      { key: 'total', width: 16 },
      { key: 'paymentMode', width: 16 },
      { key: 'platform', width: 16 }
    ];

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
    summaryRow.height = 26;
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
    summaryRow.font = { name: 'Calibri', size: 11, bold: true };
    summaryRow.eachCell(cell => {
      cell.alignment = { vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } };
    });
    financialColumns.forEach(colIndex => {
      const cell = worksheet.getCell(totalRow, colIndex + 1);
      cell.numFmt = '#,##0.00';
    });

    // Add payment method totals
    const cardRow = worksheet.getRow(totalRow + 1);
    cardRow.height = 22;
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
    upiRow.height = 22;
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
    cashRow.height = 22;
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

    // Fetch Bills and Expenses concurrently in parallel
    const [bills, expenses] = await Promise.all([
      Bill.find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'Paid'
      }).select('billNumber tableNo total paymentMode upiApp splitPayments customerName createdAt').lean(),
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
      
      if (bill.paymentMode === 'Cash') {
        cashFlow.cashIn += bill.total || 0;
      } else if (bill.paymentMode === 'UPI') {
        cashFlow.onlineIn.total += bill.total || 0;
        const appName = bill.upiApp || 'UPI Other';
        if (!cashFlow.onlineIn.upiApps[appName]) cashFlow.onlineIn.upiApps[appName] = 0;
        cashFlow.onlineIn.upiApps[appName] += bill.total || 0;
      } else if (bill.paymentMode === 'Card') {
        cashFlow.onlineIn.total += bill.total || 0;
        const appName = 'Card';
        if (!cashFlow.onlineIn.upiApps[appName]) cashFlow.onlineIn.upiApps[appName] = 0;
        cashFlow.onlineIn.upiApps[appName] += bill.total || 0;
      } else if (bill.paymentMode === 'Mixed' && bill.splitPayments) {
        const splitCash = Number(bill.splitPayments.cash) || 0;
        const splitUpi = Number(bill.splitPayments.upi) || 0;
        const splitCard = Number(bill.splitPayments.card) || 0;
        cashFlow.cashIn += splitCash;
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
      } else {
        // Fallback
        cashFlow.cashIn += bill.total || 0;
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

    const workbook = generateDayBookWorkbook(restaurantName, date, transactions, cashFlow, revenueLeakage);

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
