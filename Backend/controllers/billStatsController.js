import mongoose from 'mongoose';
import BillDefault from '../models/Bill.js';
import UserDefault from '../models/User.js';
import SettingDefault from '../models/Setting.js';
import ServiceRequestDefault from '../models/ServiceRequest.js';
import cache from '../utils/cache.js';
import { deductStockForBillItems } from './inventoryController.js';
import { updateTableStatusHelper } from './floorController.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';
import { updateCustomerFromBill, syncCustomer } from './customerController.js';
import { emitNotification, emitDismissNotification } from '../utils/notificationHelper.js';
import { emitSocketEvent } from '../utils/socket.js';
import { printKOTToPrinters } from '../services/printerService.js';
import { getTableMatchCondition, getDynamicTaxRate, getTenantShopName } from '../utils/billHelpers.js';
import { getISTDayRange, IST_TIMEZONE } from '../utils/timezoneHelper.js';

export const getDailyStats = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    let today, tomorrow;
    
    if (req.query.startDate && req.query.endDate) {
      today = new Date(req.query.startDate);
      tomorrow = new Date(req.query.endDate);
    } else {
      const istRange = getISTDayRange();
      today = istRange.startDate;
      tomorrow = istRange.endDate;
    }

    if (isNaN(today.getTime()) || isNaN(tomorrow.getTime())) {
      throw new Error('Invalid date range');
    }

    const rangeMs = tomorrow.getTime() - today.getTime();
    const isSingleDay = rangeMs <= 86400000 + 1000;

    // Run ALL independent queries concurrently in parallel
    const [
      paidStatsRes,
      paidBillsForPaymentRes,
      topItemsRes,
      recentBillsRes,
      openKOTsRes,
      deliveryStatsRes,
      dineInStatsRes,
      takeawayStatsRes,
      cancelledOrdersRes,
      editedOrdersRes,
      timelineRes,
      uniquePhonesRes,
      noPhoneBillsRes,
      billedOrdersCountRes
    ] = await Promise.allSettled([
      // 1. Paid Stats
      Bill.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
        {
          $project: {
            total: { $ifNull: ['$total', 0] },
            discount: { $ifNull: ['$discount', 0] },
            tax: { $ifNull: ['$tax', 0] },
            items: { $ifNull: ['$items', []] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalBills: { $sum: 1 },
            totalDiscount: { $sum: '$discount' },
            totalTax: { $sum: '$tax' },
            avgOrderValue: { $avg: '$total' },
            totalItems: { $sum: { $size: '$items' } }
          }
        }
      ]),
      // 2. Paid Bills for accurate payment methods (including Mixed/Split)
      Bill.find({
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'Paid'
      }).select('total paymentMode splitPayments').lean(),
      // 3. Top Items (excluding cancelled items)
      Bill.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
        { $unwind: "$items" },
        { $match: { "items.isCancelled": { $ne: true } } },
        { $group: { _id: "$items.name", quantity: { $sum: "$items.quantity" }, revenue: { $sum: "$items.total" } } },
        { $sort: { quantity: -1 } },
        { $limit: 10 }
      ]),
      // 4. Recent Bills
      Bill.find({ createdAt: { $gte: today, $lt: tomorrow }, status: 'Paid' })
        .select('billNumber tableNo billType paymentMode total orderSource items status createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      // 5. Open KOTs / Active Orders
      Bill.find({ status: { $in: ['Open', 'Billed'] } })
        .select('tableNo billType items status updatedAt createdAt')
        .sort({ updatedAt: -1 })
        .lean(),
      // 6. Delivery Count
      Bill.countDocuments({ createdAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Delivery' }),
      // 7. Dine-In Count
      Bill.countDocuments({ createdAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Dine-In' }),
      // 8. Takeaway Count
      Bill.countDocuments({ createdAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Takeaway' }),
      // 9. Cancelled Orders
      Bill.find({
        createdAt: { $gte: today, $lt: tomorrow },
        status: { $in: ['Cancelled', 'Deleted'] }
      })
      .select('tableNo billType cancelReason status updatedAt createdAt')
      .sort({ createdAt: -1 })
      .lean(),
      // 10. Edited Orders
      Bill.find({ createdAt: { $gte: today, $lt: tomorrow }, isEdited: true })
        .select('tableNo billNumber billType editHistory status updatedAt createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      // 11. Timeline breakdown (in IST timezone)
      isSingleDay
        ? Bill.aggregate([
            { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
            { $group: { _id: { $hour: { date: '$createdAt', timezone: IST_TIMEZONE } }, sales: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ])
        : Bill.aggregate([
            { $match: { createdAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TIMEZONE } },
                sales: { $sum: '$total' },
                orders: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]),
      // 12. Distinct customers by phone
      Bill.distinct('customerPhone', {
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'Paid',
        customerPhone: { $exists: true, $nin: [null, ''] }
      }),
      // 13. Bills with no phone
      Bill.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
        status: 'Paid',
        $or: [{ customerPhone: { $exists: false } }, { customerPhone: null }, { customerPhone: '' }]
      }),
      // 14. Billed status count
      Bill.countDocuments({ status: 'Billed' })
    ]);

    const paidStats = paidStatsRes.status === 'fulfilled' ? paidStatsRes.value : [];
    const paidBillsForPayment = paidBillsForPaymentRes.status === 'fulfilled' ? paidBillsForPaymentRes.value : [];
    const topItems = topItemsRes.status === 'fulfilled' ? topItemsRes.value : [];
    const recentBills = recentBillsRes.status === 'fulfilled' ? recentBillsRes.value : [];
    const openKOTs = openKOTsRes.status === 'fulfilled' ? openKOTsRes.value : [];
    const deliveryStats = deliveryStatsRes.status === 'fulfilled' ? deliveryStatsRes.value : 0;
    const dineInStats = dineInStatsRes.status === 'fulfilled' ? dineInStatsRes.value : 0;
    const takeawayStats = takeawayStatsRes.status === 'fulfilled' ? takeawayStatsRes.value : 0;
    const cancelledOrders = cancelledOrdersRes.status === 'fulfilled' ? cancelledOrdersRes.value : [];
    const editedOrders = editedOrdersRes.status === 'fulfilled' ? editedOrdersRes.value : [];
    const rawTimeline = timelineRes.status === 'fulfilled' ? timelineRes.value : [];
    const uniquePhones = uniquePhonesRes.status === 'fulfilled' ? uniquePhonesRes.value : [];
    const noPhoneBills = noPhoneBillsRes.status === 'fulfilled' ? noPhoneBillsRes.value : 0;
    const billedCount = billedOrdersCountRes.status === 'fulfilled' ? billedOrdersCountRes.value : 0;

    // Accurate customer count: distinct phone numbers + anonymous bills
    const totalCustomers = (Array.isArray(uniquePhones) ? uniquePhones.length : 0) + (Number(noPhoneBills) || 0);

    // Accurate payment methods revenue (allocating Mixed split payments correctly)
    const paymentTotals = { Cash: 0, UPI: 0, Card: 0 };
    (paidBillsForPayment || []).forEach(b => {
      if (b.paymentMode === 'Cash') {
        paymentTotals.Cash += b.total || 0;
      } else if (b.paymentMode === 'UPI') {
        paymentTotals.UPI += b.total || 0;
      } else if (b.paymentMode === 'Card') {
        paymentTotals.Card += b.total || 0;
      } else if (b.paymentMode === 'Mixed' && b.splitPayments) {
        paymentTotals.Cash += Number(b.splitPayments.cash) || 0;
        paymentTotals.UPI += Number(b.splitPayments.upi) || 0;
        paymentTotals.Card += Number(b.splitPayments.card) || 0;
      } else if (b.paymentMode) {
        paymentTotals[b.paymentMode] = (paymentTotals[b.paymentMode] || 0) + (b.total || 0);
      }
    });

    const validPaymentStats = Object.keys(paymentTotals)
      .filter(mode => paymentTotals[mode] > 0)
      .map(mode => ({ _id: mode, revenue: paymentTotals[mode] }));

    let salesTimeline = [];
    if (isSingleDay) {
      const hourlyMap = {};
      rawTimeline.forEach(h => { hourlyMap[h._id] = h; });
      for (let hr = 0; hr < 24; hr++) {
        const entry = hourlyMap[hr] || { sales: 0, orders: 0 };
        const hr12 = hr % 12 === 0 ? 12 : hr % 12;
        const ampm = hr < 12 ? 'am' : 'pm';
        const formattedTime = `${hr12.toString().padStart(2, '0')}:00 ${ampm}`;
        salesTimeline.push({ time: formattedTime, hour: hr, sales: entry.sales, orders: entry.orders });
      }
    } else {
      const dailyMap = {};
      rawTimeline.forEach(d => { dailyMap[d._id] = d; });

      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const startIST = new Date(today.getTime() + istOffsetMs);
      const endIST = new Date(tomorrow.getTime() + istOffsetMs);

      const cursor = new Date(startIST);
      cursor.setUTCHours(0, 0, 0, 0);

      const endLimit = new Date(endIST);
      endLimit.setUTCHours(0, 0, 0, 0);

      while (cursor <= endLimit) {
        const dateStr = cursor.toISOString().split('T')[0];
        const entry = dailyMap[dateStr] || { sales: 0, orders: 0 };
        const dayLabel = `${cursor.getUTCDate().toString().padStart(2, '0')}/${(cursor.getUTCMonth() + 1).toString().padStart(2, '0')}`;
        salesTimeline.push({ time: dayLabel, date: dateStr, sales: entry.sales, orders: entry.orders });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const result = paidStats[0] || { 
      totalRevenue: 0, 
      totalBills: 0, 
      totalDiscount: 0, 
      totalTax: 0,
      avgOrderValue: 0,
      totalItems: 0
    };

    const completedOrdersCount = Number(result.totalBills) || 0;
    const runningOrdersCount = openKOTs.filter(k => k.status === 'Open').length;

    const response = {
      sales: Number(result.totalRevenue) || 0,
      orders: completedOrdersCount,
      totalCustomers: totalCustomers || completedOrdersCount,
      averageOrderValue: Math.round(Number(result.avgOrderValue) || 0),
      totalItems: Number(result.totalItems) || 0,
      totalDiscount: Number(result.totalDiscount) || 0,
      totalTax: Number(result.totalTax) || 0,
      paymentMethods: validPaymentStats,
      activeOrders: runningOrdersCount,
      billedOrders: billedCount,
      completedOrders: completedOrdersCount,
      deliveryOrders: Number(deliveryStats) || 0,
      dineInOrders: Number(dineInStats) || 0,
      takeawayOrders: Number(takeawayStats) || 0,
      topItems: topItems || [],
      recentBills: recentBills || [],
      openKOTs: openKOTs || [],
      cancelledOrders: cancelledOrders || [],
      editedOrders: editedOrders || [],
      hourlySales: salesTimeline
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    console.error('Error stack:', error.stack);
    
    const defaultResponse = {
      sales: 0,
      orders: 0,
      totalCustomers: 0,
      averageOrderValue: 0,
      totalItems: 0,
      totalDiscount: 0,
      totalTax: 0,
      paymentMethods: [],
      activeOrders: 0,
      billedOrders: 0,
      completedOrders: 0,
      deliveryOrders: 0,
      topItems: [],
      recentBills: [],
      openKOTs: [],
      cancelledOrders: [],
      editedOrders: [],
      hourlySales: []
    };
    
    res.status(200).json(defaultResponse);
  }
};
