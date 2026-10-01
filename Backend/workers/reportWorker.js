import { Worker } from 'bullmq';
import { connection } from './queueManager.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Report from '../models/Report.js';

// For emitting socket events from a separate worker process
import { Emitter } from '@socket.io/redis-emitter';
import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

import { getTenantModels } from '../utils/tenantManager.js';

let ioEmitter = null;
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

const setupEmitter = async () => {
  try {
    const redisClient = createClient({ url: REDIS_URI });
    await redisClient.connect();
    ioEmitter = new Emitter(redisClient);
    console.log('[Report Worker] Socket.IO Emitter connected to Redis');
  } catch (err) {
    console.error('[Report Worker] Failed to connect Socket.IO Emitter to Redis', err);
  }
};
setupEmitter();

export const startReportWorker = () => {
  const worker = new Worker('ReportQueue', async (job) => {
    const { tenantDb, startDate, endDate, periodName, type, userId } = job.data;

    console.log(`[Report Worker] Processing Job ${job.id} for tenant: ${tenantDb}, type: ${type}`);

    if (!tenantDb || tenantDb === 'default' || tenantDb === 'undefined' || tenantDb === 'null') {
      console.error(`[Report Worker] Job ${job.id} failed: missing or invalid tenantDb. Refusing to generate report from master DB.`);
      throw new Error('Missing or invalid tenantDb in job payload');
    }

    if (type !== 'CSV_DAILY' && type !== 'EXCEL_MONTHLY') {
      console.warn(`[Report Worker] Unknown report type: ${type}`);
      return;
    }

    try {
      const models = await getTenantModels(tenantDb);
      const Bill = models.Bill;
      if (!Bill) {
        throw new Error(`Failed to resolve Bill model for tenant ${tenantDb}`);
      }
      
      const bills = await Bill.find({
        $or: [
          { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          { clearedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }
        ],
        status: 'Paid'
      }).sort({ createdAt: -1 }).lean();

      const reportsDir = path.join(process.cwd(), 'secure_reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      let filename = '';
      let filepath = '';
      let downloadUrl = '';
      let displayFilename = '';
      const reportId = job.id.toString();

      if (type === 'CSV_DAILY') {
        // Generate CSV Content
        let csv = 'Date,Time,Bill ID,Table,Items,Subtotal,Discount,Tax,Total,Payment Mode\n';
        bills.forEach(bill => {
          const date = new Date(bill.createdAt).toLocaleDateString('en-IN');
          const time = new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          const items = bill.items.map(item => `${item.name}(${item.quantity})`).join('; ');
          csv += `${date},${time},${bill._id},${bill.tableNo},"${items}",${bill.subtotal},${bill.discount},${bill.tax},${bill.total},${bill.paymentMode}\n`;
        });

        filename = `${reportId}.csv`;
        filepath = path.join(reportsDir, filename);
        displayFilename = `daily-report-${periodName.replace(/\s+/g, '-').toLowerCase()}.csv`;
        fs.writeFileSync(filepath, csv);
        downloadUrl = `/analytics/download/${reportId}`;
      } else if (type === 'EXCEL_MONTHLY') {
        const { restaurantName } = job.data;
        const { default: ExcelJS } = await import('exceljs');
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
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        });

        const paymentTotals = { Card: 0, UPI: 0, Cash: 0 };

        bills.forEach((bill, index) => {
          const row = worksheet.getRow(index + 4);
          row.height = 22;
          let platform = '';
          if (bill.billType === 'Delivery' && bill.orderSource) platform = bill.orderSource;
          const itemCount = bill.items ? bill.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
          if (bill.paymentMode && paymentTotals.hasOwnProperty(bill.paymentMode)) {
            paymentTotals[bill.paymentMode] += bill.total || 0;
          }
          row.values = [
            new Date(bill.createdAt).toLocaleDateString('en-IN'),
            new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
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
            cell.alignment = { vertical: 'middle', horizontal: colNumber <= 6 || colNumber >= 11 ? 'center' : 'right' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
              right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
            };
          });
        });

        worksheet.columns = [
          { key: 'date', width: 14 }, { key: 'time', width: 12 }, { key: 'billId', width: 18 },
          { key: 'billType', width: 14 }, { key: 'table', width: 18 }, { key: 'itemCount', width: 12 },
          { key: 'subtotal', width: 15 }, { key: 'discount', width: 14 }, { key: 'tax', width: 14 },
          { key: 'total', width: 16 }, { key: 'paymentMode', width: 16 }, { key: 'platform', width: 16 }
        ];

        const financialColumns = [6, 7, 8, 9];
        bills.forEach((bill, index) => {
          financialColumns.forEach(colIndex => { worksheet.getCell(index + 4, colIndex + 1).numFmt = '#,##0.00'; });
        });

        const totalRow = bills.length + 4;
        const summaryRow = worksheet.getRow(totalRow);
        summaryRow.height = 26;
        summaryRow.values = [
          'TOTAL', '', '', '', '',
          bills.reduce((sum, bill) => sum + (bill.items ? bill.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0), 0),
          bills.reduce((sum, bill) => sum + (bill.subtotal || 0), 0),
          bills.reduce((sum, bill) => sum + (bill.discount || 0), 0),
          bills.reduce((sum, bill) => sum + (bill.tax || 0), 0),
          bills.reduce((sum, bill) => sum + (bill.total || 0), 0),
          '', ''
        ];
        summaryRow.font = { name: 'Calibri', size: 11, bold: true };
        summaryRow.eachCell(cell => {
          cell.alignment = { vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBD5E1' } };
        });
        financialColumns.forEach(colIndex => { worksheet.getCell(totalRow, colIndex + 1).numFmt = '#,##0.00'; });

        const addPaymentRow = (rowNum, label, val) => {
          const row = worksheet.getRow(rowNum);
          row.height = 22;
          row.values = [label, '', '', '', '', '', '', '', '', val, label.split(' ')[0], ''];
          row.font = { bold: true };
          worksheet.getCell(rowNum, 10).numFmt = '#,##0.00';
        };
        addPaymentRow(totalRow + 1, 'CARD TOTAL', paymentTotals.Card);
        addPaymentRow(totalRow + 2, 'UPI TOTAL', paymentTotals.UPI);
        addPaymentRow(totalRow + 3, 'CASH TOTAL', paymentTotals.Cash);

        displayFilename = `monthly-report-${periodName.replace(/\s+/g, '-').toLowerCase()}.xlsx`;
        filename = `${reportId}.xlsx`;
        filepath = path.join(reportsDir, filename);
        await workbook.xlsx.writeFile(filepath);
        downloadUrl = `/analytics/download/${reportId}`;
      }

      console.log(`[Report Worker] Job ${job.id} completed. Saved to ${downloadUrl}`);

      // Store report metadata in primary DB idempotently
      await Report.findOneAndUpdate(
        { reportId },
        {
          $set: {
            tenantDb,
            filePath: filepath,
            filename: displayFilename,
            status: 'ready'
          }
        },
        { upsert: true, new: true }
      );

      // Emit notification to the user/tenant who requested it
      if (ioEmitter) {
        // Broadcast to the tenant's room
        ioEmitter.to(tenantDb).emit('report_ready', {
          jobId: job.id,
          filename: displayFilename,
          downloadUrl,
          message: `Your ${type === 'CSV_DAILY' ? 'CSV' : 'Excel'} report is ready to download.`
        });
      }

    } catch (error) {
      console.error(`[Report Worker] Job ${job.id} error:`, error.message);
      
      if (ioEmitter) {
        ioEmitter.to(tenantDb).emit('report_failed', {
          jobId: job.id,
          message: 'Failed to generate your CSV report.'
        });
      }
      throw error;
    }
  }, { 
    connection,
    concurrency: 2 // Reports are CPU intensive, keep concurrency low
  });

  worker.on('failed', (job, err) => {
    console.error(`[Report Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log('[Report Worker] Started and listening to ReportQueue');
  return worker;
};
