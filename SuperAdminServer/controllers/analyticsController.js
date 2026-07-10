import mongoose from 'mongoose';
import Client from '../models/Client.js';

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
