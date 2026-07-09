import CustomerSchema from '../models/Customer.js';
import BillDefault from '../models/Bill.js';
import { getTenantModel } from '../utils/tenantHelper.js';

export const getCustomerInfo = async (req, res) => {
  try {
    const { phone } = req.params;
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    const customer = await Customer.findOne({ phone });
    if (!customer) {
      return res.status(200).json({ isNew: true });
    }

    // Determine smart upsell based on favorite items
    let upsellSuggestion = null;
    if (customer.favoriteItems && customer.favoriteItems.length > 0) {
      // Sort by count descending
      const topItem = customer.favoriteItems.sort((a, b) => b.count - a.count)[0];
      upsellSuggestion = `They usually order ${topItem.itemName}. Suggest it today?`;
    }

    res.status(200).json({
      isNew: false,
      customer,
      upsellSuggestion
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCustomerFromBill = async (req, bill) => {
  try {
    if (!bill.customerPhone) return;

    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    
    let customer = await Customer.findOne({ phone: bill.customerPhone });
    
    if (!customer) {
      customer = new Customer({
        phone: bill.customerPhone,
        name: bill.customerName || 'Guest'
      });
    } else {
      if (bill.customerName && customer.name === 'Guest') {
        customer.name = bill.customerName;
      }
    }

    customer.totalVisits += 1;
    customer.totalSpend += bill.total;
    customer.lastVisit = new Date();

    // Check VIP status (e.g., spent more than 5000 or visited more than 5 times)
    if (customer.totalSpend > 5000 || customer.totalVisits >= 5) {
      customer.isVIP = true;
    }

    // Update favorite items
    for (const item of bill.items) {
      const existingItem = customer.favoriteItems.find(i => i.itemName === item.name);
      if (existingItem) {
        existingItem.count += item.quantity;
      } else {
        customer.favoriteItems.push({ itemName: item.name, count: item.quantity });
      }
    }

    // Keep only top 5 favorites
    customer.favoriteItems.sort((a, b) => b.count - a.count);
    if (customer.favoriteItems.length > 5) {
      customer.favoriteItems = customer.favoriteItems.slice(0, 5);
    }

    await customer.save();
  } catch (error) {
    console.error('Error updating customer CRM:', error);
  }
};
