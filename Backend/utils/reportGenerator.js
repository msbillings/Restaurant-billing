import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import BillDefault from '../models/Bill.js';
import mongoose from 'mongoose';

// Generate EOD (End of Day) Report
export const generateEODReport = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('[Reports] Skipping EOD report, DB not connected.');
      return;
    }

    const reportDir = process.env.APP_USER_DATA_PATH ? path.join(process.env.APP_USER_DATA_PATH, 'reports') : path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Get today's start and end date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const Bill = mongoose.models.Bill || mongoose.model('Bill', BillDefault.schema);
    
    // Fetch all completed bills for today
    const bills = await Bill.find({
      status: 'Settled',
      createdAt: { $gte: today, $lt: tomorrow }
    }).lean();

    let totalSales = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalOrders = bills.length;
    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;
    let onlineSales = 0; // Swiggy/Zomato

    bills.forEach(bill => {
      totalSales += bill.total;
      totalTax += (bill.tax || 0);
      totalDiscount += (bill.discount || 0);

      if (bill.orderSource && ['Zomato', 'Swiggy', 'Talabat'].includes(bill.orderSource)) {
        onlineSales += bill.total;
      } else {
        if (bill.paymentMethod === 'Cash') cashSales += bill.total;
        else if (bill.paymentMethod === 'Card') cardSales += bill.total;
        else if (bill.paymentMethod === 'UPI') upiSales += bill.total;
      }
    });

    const reportData = {
      date: today.toISOString().split('T')[0],
      totalOrders,
      totalSales,
      totalTax,
      totalDiscount,
      breakdown: {
        cashSales,
        cardSales,
        upiSales,
        onlineSales
      }
    };

    const dateStr = today.toISOString().split('T')[0];
    const reportPath = path.join(reportDir, `EOD_Report_${dateStr}.json`);

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
    
    console.log(`[Reports] ✅ End of Day Report Generated! Saved to ${reportPath}`);
    // In a real production system, this could also send an email to the owner via Nodemailer.
  } catch (error) {
    console.error('[Reports] ❌ EOD Report Generation Failed:', error);
  }
};

// Schedule Cron Job (Runs every day at 11:59 PM)
export const startReportCron = () => {
  cron.schedule('59 23 * * *', () => {
    console.log('[Reports] Running scheduled EOD report generation...');
    generateEODReport();
  });
};
