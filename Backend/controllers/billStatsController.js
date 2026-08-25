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

export const getDailyStats = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const now = new Date();
    let today, tomorrow;
    
    if (req.query.startDate && req.query.endDate) {
      today = new Date(req.query.startDate);
      tomorrow = new Date(req.query.endDate);
    } else {
      today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    }

    if (isNaN(today.getTime()) || isNaN(tomorrow.getTime())) {
      throw new Error('Invalid date range');
    }

    const rangeMs = tomorrow.getTime() - today.getTime();
    const isSingleDay = rangeMs <= 86400000 + 1000;

    // Run ALL independent queries concurrently in parallel
    const [
      paidStatsRes,
      paymentStatsRes,
      topItemsRes,
      recentBillsRes,
      openKOTsRes,
      deliveryStatsRes,
      dineInStatsRes,
      takeawayStatsRes,
      cancelledOrdersRes,
      editedOrdersRes,
      timelineRes
    ] = await Promise.allSettled([
      // 1. Paid Stats
      Bill.aggregate([
        { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
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
      // 2. Payment Stats
      Bill.aggregate([
        { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid', paymentMode: { $exists: true, $ne: null } } },
        { $project: { paymentMode: 1, total: { $ifNull: ['$total', 0] } } },
        { $group: { _id: '$paymentMode', count: { $sum: 1 }, revenue: { $sum: '$total' } } }
      ]),
      // 3. Top Items
      Bill.aggregate([
        { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
        { $unwind: "$items" },
        { $group: { _id: "$items.name", quantity: { $sum: "$items.quantity" }, revenue: { $sum: "$items.total" } } },
        { $sort: { quantity: -1 } },
        { $limit: 10 }
      ]),
      // 4. Recent Bills
      Bill.find({ updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' })
        .select('billNumber tableNo billType paymentMode total orderSource items status createdAt updatedAt')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(6)
        .lean(),
      // 5. Open KOTs / Active Orders
      Bill.find({ status: { $in: ['Open', 'Billed'] } })
        .select('tableNo billType items status updatedAt createdAt')
        .sort({ updatedAt: -1 })
        .lean(),
      // 6. Delivery Count
      Bill.countDocuments({ updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Delivery' }),
      // 7. Dine-In Count
      Bill.countDocuments({ updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Dine-In' }),
      // 8. Takeaway Count
      Bill.countDocuments({ updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid', billType: 'Takeaway' }),
      // 9. Cancelled Orders
      Bill.find({
        updatedAt: { $gte: today, $lt: tomorrow },
        $or: [
          { status: { $in: ['Cancelled', 'Deleted'] } },
          { 'kots.kotNumber': { $regex: '^CANCEL' } }
        ]
      })
      .select('tableNo billType cancelReason status updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .lean(),
      // 10. Edited Orders
      Bill.find({ updatedAt: { $gte: today, $lt: tomorrow }, isEdited: true })
        .select('tableNo billNumber billType editHistory status updatedAt createdAt')
        .sort({ updatedAt: -1 })
        .lean(),
      // 11. Timeline breakdown
      isSingleDay
        ? Bill.aggregate([
            { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
            { $group: { _id: { $hour: '$updatedAt' }, sales: { $sum: '$total' }, orders: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ])
        : Bill.aggregate([
            { $match: { updatedAt: { $gte: today, $lt: tomorrow }, status: 'Paid' } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
                sales: { $sum: '$total' },
                orders: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ])
    ]);

    const paidStats = paidStatsRes.status === 'fulfilled' ? paidStatsRes.value : [];
    const paymentStats = paymentStatsRes.status === 'fulfilled' ? paymentStatsRes.value : [];
    const topItems = topItemsRes.status === 'fulfilled' ? topItemsRes.value : [];
    const recentBills = recentBillsRes.status === 'fulfilled' ? recentBillsRes.value : [];
    const openKOTs = openKOTsRes.status === 'fulfilled' ? openKOTsRes.value : [];
    const deliveryStats = deliveryStatsRes.status === 'fulfilled' ? deliveryStatsRes.value : 0;
    const dineInStats = dineInStatsRes.status === 'fulfilled' ? dineInStatsRes.value : 0;
    const takeawayStats = takeawayStatsRes.status === 'fulfilled' ? takeawayStatsRes.value : 0;
    const cancelledOrders = cancelledOrdersRes.status === 'fulfilled' ? cancelledOrdersRes.value : [];
    const editedOrders = editedOrdersRes.status === 'fulfilled' ? editedOrdersRes.value : [];
    const rawTimeline = timelineRes.status === 'fulfilled' ? timelineRes.value : [];
    const activeOrders = openKOTs.length;

    let salesTimeline = [];
    if (isSingleDay) {
      const hourlyMap = {};
      rawTimeline.forEach(h => { hourlyMap[h._id] = h; });
      for (let hr = 0; hr < 24; hr++) {
        const entry = hourlyMap[hr] || { sales: 0, orders: 0 };
        salesTimeline.push({ time: `${hr.toString().padStart(2, '0')}:00`, sales: entry.sales, orders: entry.orders });
      }
    } else {
      const dailyMap = {};
      rawTimeline.forEach(d => { dailyMap[d._id] = d; });
      const cursor = new Date(today);
      while (cursor < tomorrow) {
        const dateStr = cursor.toISOString().split('T')[0];
        const entry = dailyMap[dateStr] || { sales: 0, orders: 0 };
        const dayLabel = `${cursor.getUTCDate().toString().padStart(2, '0')}/${(cursor.getUTCMonth() + 1).toString().padStart(2, '0')}`;
        salesTimeline.push({ time: dayLabel, sales: entry.sales, orders: entry.orders });
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

    // Ensure paymentStats is an array and filter out null values
    const validPaymentStats = Array.isArray(paymentStats) 
      ? paymentStats.filter(p => p._id !== null && p._id !== undefined)
      : [];

    const response = {
      sales: Number(result.totalRevenue) || 0,
      orders: Number(result.totalBills) || 0,
      averageOrderValue: Math.round(Number(result.avgOrderValue) || 0),
      totalItems: Number(result.totalItems) || 0,
      totalDiscount: Number(result.totalDiscount) || 0,
      totalTax: Number(result.totalTax) || 0,
      paymentMethods: validPaymentStats,
      activeOrders: Number(activeOrders) || 0,
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
    
    // Cache removed to ensure immediate reflection on dashboard
    // cache.set(cacheKey, response, 30000);
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    console.error('Error stack:', error.stack);
    
    // Always return default response to prevent dashboard failure
    // This ensures the dashboard can still render even if there's an error
    const defaultResponse = {
      sales: 0,
      orders: 0,
      averageOrderValue: 0,
      totalItems: 0,
      totalDiscount: 0,
      totalTax: 0,
      paymentMethods: [],
      activeOrders: 0,
      deliveryOrders: 0,
      topItems: [],
      recentBills: [],
      openKOTs: [],
      cancelledOrders: [],
      editedOrders: []
    };
    
    // Log the error but return 200 with default data so dashboard doesn't break
    // The frontend can handle empty/zero data gracefully
    res.status(200).json(defaultResponse);
  }
};

// Generate KOT for a bill (only for new/changed items)
