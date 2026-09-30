import mongoose from 'mongoose';
import Client from '../models/Client.js';
import { getTenantDb } from '../utils/clusterManager.js';

// Simple in-memory cache for DB sizes
export const dbSizeCache = new Map();
let isFetchingSizes = false;

// Simple in-memory cache for Live Revenue
let liveRevenueCache = 0;
let isFetchingRevenue = false;

const updateLiveRevenue = async () => {
  if (isFetchingRevenue) return;
  isFetchingRevenue = true;
  try {
    const clients = await Client.find({ status: 'Active' }).lean();
    let totalTodayRevenue = 0;
    
    // Get start of day IST
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(today.getTime() + istOffset);
    istTime.setUTCHours(0, 0, 0, 0);
    const startOfDayUTC = new Date(istTime.getTime() - istOffset);

    for (const client of clients) {
      if (!client.databaseName) continue;
      try {
        const tenantDb = await getTenantDb(client.cluster, client.databaseName);
        const billsCollection = tenantDb.collection('bills');
        const todayBills = await billsCollection.find({ 
          createdAt: { $gte: startOfDayUTC },
          status: 'Paid'
        }).toArray();
        const revenue = todayBills.reduce((acc, bill) => acc + (bill.grandTotal || bill.total || 0), 0);
        totalTodayRevenue += revenue;
      } catch (e) {
        // ignore individual tenant errors to not break loop
      }
    }
    liveRevenueCache = totalTodayRevenue;
  } catch (err) {
    console.error('[Analytics] Error updating live revenue:', err.message);
  } finally {
    isFetchingRevenue = false;
  }
};

// Start background task to fetch live revenue every 1 minute
setInterval(updateLiveRevenue, 60 * 1000);
setTimeout(updateLiveRevenue, 10000);

const updateDbSizes = async () => {
  if (isFetchingSizes) return;
  isFetchingSizes = true;
  try {
    const clients = await Client.find({ status: 'Active' }).lean();
    for (const client of clients) {
      if (!client.databaseName) continue;
      try {
        const tenantDb = await getTenantDb(client.cluster, client.databaseName);
        const stats = await tenantDb.db.stats();
        dbSizeCache.set(client.databaseName, {
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          collections: stats.collections || 0,
          timestamp: Date.now()
        });
      } catch (e) {
        console.error(`[Analytics] Failed to fetch db stats for ${client.databaseName}:`, e.message);
      }
    }
  } catch (err) {
    console.error('[Analytics] Error updating db sizes:', err.message);
  } finally {
    isFetchingSizes = false;
  }
};

// Start background task to fetch DB sizes every 5 minutes
setInterval(updateDbSizes, 5 * 60 * 1000);
// Initial fetch
setTimeout(updateDbSizes, 5000);

export const getGlobalAnalytics = async (req, res) => {
  try {
    // 1. Get all active clients
    const clients = await Client.find({ status: 'Active' });
    if (!clients || clients.length === 0) {
      return res.status(200).json({
        totalGMV: 0,
        totalOrders: 0,
        totalCustomers: 0,
        aov: 0,
        topItems: []
      });
    }

    let globalGMV = 0;
    let globalOrders = 0;
    let globalCustomers = 0;
    const itemSales = {};

    const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restopos_superadmin';
    const connectionPart = baseUri.split('?')[0];
    const queryPart = baseUri.includes('?') ? `?${baseUri.split('?')[1]}` : '';
    const lastSlashIndex = connectionPart.lastIndexOf('/');
    const uriPrefix = connectionPart.substring(0, lastSlashIndex);

    // 2. Loop through each client's database
    for (const client of clients) {
      if (!client.databaseName) continue;
      
      const tenantUri = `${uriPrefix}/${client.databaseName}${queryPart}`;
      
      try {
        const tenantConn = await mongoose.createConnection(tenantUri).asPromise();
        
        // Use native MongoDB collections to avoid schema definition overhead
        const billsCollection = tenantConn.collection('bills');
        const customersCollection = tenantConn.collection('customers');

        // Aggregate Customers
        const customerCount = await customersCollection.countDocuments();
        globalCustomers += customerCount;

        // Aggregate Bills (GMV, Orders, Top Items)
        // We only want paid bills or all bills? Let's take all bills for GMV.
        const bills = await billsCollection.find({}).toArray();
        globalOrders += bills.length;

        for (const bill of bills) {
          globalGMV += (bill.total || 0);

          if (bill.items && Array.isArray(bill.items)) {
            for (const item of bill.items) {
              const itemName = item.name || 'Unknown Item';
              if (!itemSales[itemName]) {
                itemSales[itemName] = { quantity: 0, revenue: 0 };
              }
              itemSales[itemName].quantity += (item.quantity || 1);
              itemSales[itemName].revenue += ((item.price || 0) * (item.quantity || 1));
            }
          }
        }

        // Close connection immediately to save resources
        await tenantConn.close();
      } catch (err) {
        console.error(`Error querying tenant DB ${client.databaseName}:`, err.message);
        // Continue to next client even if one fails
      }
    }

    const aov = globalOrders > 0 ? (globalGMV / globalOrders) : 0;

    // Sort Top Items by Quantity
    const topItems = Object.keys(itemSales)
      .map(name => ({
        name,
        quantity: itemSales[name].quantity,
        revenue: itemSales[name].revenue
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    res.status(200).json({
      totalGMV: globalGMV,
      totalOrders: globalOrders,
      totalCustomers: globalCustomers,
      aov: aov,
      topItems: topItems,
      activeRestaurantsScanned: clients.length
    });

  } catch (error) {
    console.error('Global Analytics Error:', error);
    res.status(500).json({ message: 'Error calculating global analytics', error: error.message });
  }
};

export const exportGlobalCustomers = async (req, res) => {
  try {
    const clients = await Client.find({ status: 'Active' });
    
    if (!clients || clients.length === 0) {
      return res.status(404).send('No active clients found');
    }

    const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/restopos_superadmin';
    const connectionPart = baseUri.split('?')[0];
    const queryPart = baseUri.includes('?') ? `?${baseUri.split('?')[1]}` : '';
    const lastSlashIndex = connectionPart.lastIndexOf('/');
    const uriPrefix = connectionPart.substring(0, lastSlashIndex);

    let csvContent = 'Restaurant Name,Customer Name,Phone,Email,Total Orders,Total Spent\n';

    for (const client of clients) {
      if (!client.databaseName) continue;
      
      const tenantUri = `${uriPrefix}/${client.databaseName}${queryPart}`;
      
      try {
        const tenantConn = await mongoose.createConnection(tenantUri).asPromise();
        const customersCollection = tenantConn.collection('customers');
        
        const customers = await customersCollection.find({}).toArray();
        
        customers.forEach(c => {
          const name = c.name ? c.name.replace(/,/g, '') : 'Unknown';
          const phone = c.phone || c.phoneNo || '';
          const email = c.email ? c.email.replace(/,/g, '') : '';
          const totalOrders = c.totalVisits || 0;
          const totalSpent = c.totalSpend || 0;
          
          csvContent += `"${client.restaurantName}","${name}","${phone}","${email}",${totalOrders},${totalSpent}\n`;
        });

        await tenantConn.close();
      } catch (err) {
        console.error(`Error querying tenant DB ${client.databaseName}:`, err.message);
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="global_customers_${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('Export Customers Error:', error);
    res.status(500).send('Error exporting customers');
  }
};

export const getRealtimeAnalytics = async (req, res) => {
  try {
    const clients = await Client.find({ status: 'Active' }).lean();
    
    // Build realtime active list
    const realtimeStats = clients.map(client => {
      const dbName = client.databaseName;
      const metrics = client.realtimeMetrics || {};
      const dbSizeInfo = dbSizeCache.get(dbName) || { dataSize: 0, storageSize: 0 };
      
      const lastActive = metrics.lastActive ? new Date(metrics.lastActive) : new Date(0);
      const isCurrentlyActive = (Date.now() - lastActive.getTime()) < (5 * 60 * 1000); // active in last 5 mins
      
      const printQueue = metrics.printQueue || { queuedKOTs: 0, queuedBills: 0, failedPrints: 0, printNodesOnline: 0, oldestWaitTime: 0 };

        return {
          _id: client._id,
          restaurantName: client.restaurantName,
          cluster: client.cluster || 'cluster0',
          rpm: metrics.lastMinuteRequests || 0, // Requests per minute
          lastMinuteErrors: metrics.lastMinuteErrors || 0,
          avgLatency: (metrics.lastMinuteRequests > 0) ? (metrics.lastMinuteLatency / metrics.lastMinuteRequests) : 0,
          totalRequests: metrics.totalRequests || 0,
          dataTransferDaily: (metrics.totalReqBytes || 0) + (metrics.totalResBytes || 0), // Estimate
          printQueue: printQueue,
        dbDataSize: dbSizeInfo.dataSize || 0,
        dbStorageSize: dbSizeInfo.storageSize || 0,
        lastActive: lastActive,
        isCurrentlyActive
      };
    });

    // Fetch system metrics for global stats
    const sysDoc = await mongoose.connection.db.collection('system_metrics').findOne({ _id: 'global' });
    const activeWebSockets = sysDoc ? sysDoc.activeSockets : 0;

    // Calculate aggregations
    const totalRPM = realtimeStats.reduce((sum, r) => sum + r.rpm, 0);
    const totalErrors = realtimeStats.reduce((sum, r) => sum + r.lastMinuteErrors, 0);
    
    let totalLatencySum = 0;
    let latencySources = 0;
    realtimeStats.forEach(r => {
      if (r.rpm > 0) {
        totalLatencySum += r.avgLatency;
        latencySources++;
      }
    });
    const avgSystemLatency = latencySources > 0 ? (totalLatencySum / latencySources) : 0;

    const totalDataTransfer = realtimeStats.reduce((sum, r) => sum + r.dataTransferDaily, 0);
    const totalStorageSize = realtimeStats.reduce((sum, r) => sum + r.dbStorageSize, 0);
    const activeRestaurants = realtimeStats.filter(r => r.isCurrentlyActive).length;

    // Print Queue Aggregations
    const globalPrintJobs = realtimeStats.reduce((sum, r) => sum + r.printQueue.queuedKOTs + r.printQueue.queuedBills, 0);
    const globalFailedPrints = realtimeStats.reduce((sum, r) => sum + r.printQueue.failedPrints, 0);
    const globalActivePrintNodes = realtimeStats.reduce((sum, r) => sum + r.printQueue.printNodesOnline, 0);

    res.status(200).json({
      totalRPM,
      totalErrors,
      avgSystemLatency,
      activeWebSockets,
      liveRevenue: liveRevenueCache,
      totalDataTransfer,
      totalStorageSize,
      activeRestaurants,
      globalPrintJobs,
      globalFailedPrints,
      globalActivePrintNodes,
      restaurants: realtimeStats.sort((a, b) => b.rpm - a.rpm) // Sort by RPM descending
    });

  } catch (error) {
    console.error('Realtime Analytics Error:', error);
    res.status(500).json({ message: 'Error fetching real-time analytics', error: error.message });
  }
};
