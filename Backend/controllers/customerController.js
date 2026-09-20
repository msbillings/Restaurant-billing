import CustomerSchema from '../models/Customer.js';
import BillDefault from '../models/Bill.js';
import SettingDefault from '../models/Setting.js';
import LoyaltyConfigDefault from '../models/LoyaltyConfig.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import whatsappManager from '../services/whatsappService.js';
import { resolveTenantInfo } from './whatsappController.js';

export const searchCustomers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    const customers = await Customer.find({ phone: new RegExp(`^${q}`, 'i') }).select('phone name lastOrderType').limit(10).lean();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

export const getAllCustomers = async (req, res) => {
  try {
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const customers = await Customer.find({}).sort({ lastVisit: -1 }).lean();

    // If some customers don't have lastOrderType set yet, lookup their latest bill
    const phonesToLookup = customers.filter(c => !c.lastOrderType).map(c => c.phone);
    if (phonesToLookup.length > 0) {
      const recentBills = await Bill.find({
        customerPhone: { $in: phonesToLookup }
      }).select('customerPhone billType createdAt').sort({ createdAt: -1 }).lean();

      const phoneToBillType = {};
      recentBills.forEach(b => {
        if (b.customerPhone && !phoneToBillType[b.customerPhone]) {
          phoneToBillType[b.customerPhone] = b.billType || 'Dine-In';
        }
      });

      customers.forEach(c => {
        if (!c.lastOrderType) {
          c.lastOrderType = phoneToBillType[c.phone] || 'Dine-In';
        }
      });
    }

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const syncCustomer = async (req, phone, name, orderType = 'Dine-In') => {
  try {
    if (!phone) return;
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    let customer = await Customer.findOne({ phone: cleanPhone });
    
    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: name || 'Guest',
        lastOrderType: orderType || 'Dine-In'
      });
      await customer.save();
    } else {
      if (name && (customer.name === 'Guest' || !customer.name)) {
        customer.name = name;
      }
      if (orderType) {
        customer.lastOrderType = orderType;
      }
      await customer.save();
    }
  } catch (error) {
    console.error('Error syncing customer CRM:', error);
  }
};

export const updateCustomerFromBill = async (req, bill) => {
  try {
    if (!bill.customerPhone) return;
    const cleanPhone = bill.customerPhone.trim().replace(/\D/g, '').slice(-10);

    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const LoyaltyConfig = getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault);

    let customer = await Customer.findOne({ phone: cleanPhone });
    const isFirstVisit = !customer;

    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: bill.customerName || 'Guest',
        lastOrderType: bill.billType || 'Dine-In'
      });
    } else {
      if (bill.customerName && (customer.name === 'Guest' || !customer.name)) {
        customer.name = bill.customerName;
      }
      if (bill.billType) {
        customer.lastOrderType = bill.billType;
      }
    }

    customer.totalVisits += 1;
    customer.totalSpend += bill.total;
    customer.lastVisit = new Date();

    // Fetch dynamic VIP thresholds from settings
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
    let settings = settingsDoc?.value || {};
    if (typeof settings === 'string') {
      try { settings = JSON.parse(settings); } catch (e) { settings = {}; }
    }
    const visitLimit = (settings.vipVisitThreshold !== undefined && settings.vipVisitThreshold !== null && settings.vipVisitThreshold !== '')
      ? Number(settings.vipVisitThreshold)
      : 5;
    const spendLimit = (settings.vipSpendThreshold !== undefined && settings.vipSpendThreshold !== null && settings.vipSpendThreshold !== '')
      ? Number(settings.vipSpendThreshold)
      : 5000;

    if (customer.totalSpend >= spendLimit || customer.totalVisits >= visitLimit) {
      customer.isVIP = true;
    }

    // Update favorite items
    if (bill.items && Array.isArray(bill.items)) {
      for (const item of bill.items) {
        if (!item.name) continue;
        const existingItem = customer.favoriteItems.find(i => i.itemName === item.name);
        if (existingItem) {
          existingItem.count += (item.quantity || 1);
        } else {
          customer.favoriteItems.push({ itemName: item.name, count: (item.quantity || 1) });
        }
      }
    }

    // Keep top 20 favorites
    customer.favoriteItems.sort((a, b) => b.count - a.count);
    if (customer.favoriteItems.length > 20) {
      customer.favoriteItems = customer.favoriteItems.slice(0, 20);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LOYALTY POINTS & REELO-GRADE VIP CLUB ENGINE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let loyaltyConfig = await LoyaltyConfig.findOne().lean();
    if (!loyaltyConfig) {
      // Create default config if none exists
      const newConfig = new (getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault))({});
      await newConfig.save();
      loyaltyConfig = newConfig.toObject();
    }

    // ── 3-Tier VIP Club Progression (Silver, Gold, Platinum VIP) ──
    const configTiers = loyaltyConfig.tiers || [];
    const platTier = configTiers.find(t => t.name === 'Platinum VIP') || { minVisits: 15, minSpend: 15000, pointMultiplier: 1.5 };
    const goldTier = configTiers.find(t => t.name === 'Gold') || { minVisits: 5, minSpend: 5000, pointMultiplier: 1.25 };
    const silverTier = configTiers.find(t => t.name === 'Silver') || { minVisits: 0, minSpend: 0, pointMultiplier: 1.0 };

    if (customer.totalVisits >= platTier.minVisits || customer.totalSpend >= platTier.minSpend) {
      customer.tier = 'Platinum VIP';
      customer.isVIP = true;
    } else if (customer.totalVisits >= goldTier.minVisits || customer.totalSpend >= goldTier.minSpend) {
      customer.tier = 'Gold';
      customer.isVIP = false;
    } else {
      customer.tier = 'Silver';
      customer.isVIP = false;
    }

    const currentTierObj = customer.tier === 'Platinum VIP' ? platTier : (customer.tier === 'Gold' ? goldTier : silverTier);
    const tierMultiplier = Number(currentTierObj.pointMultiplier || 1.0);

    let totalPointsEarned = 0;
    let restaurantName = settings.restaurantName || 'our restaurant';

    if (loyaltyConfig.enabled) {
      const billTotal = bill.total || 0;
      const minBill = loyaltyConfig.minBillAmount || 0;

      if (billTotal >= minBill) {
        const mode = loyaltyConfig.loyaltyMode || 'spend';

        // --- SPEND-BASED POINTS WITH VIP MULTIPLIER ---
        if (mode === 'spend' || mode === 'both') {
          const conversionRate = loyaltyConfig.conversionRate || 100;
          const baseSpendPoints = Math.floor(billTotal / conversionRate);
          const spendPoints = Math.floor(baseSpendPoints * tierMultiplier);
          totalPointsEarned += spendPoints;
        }

        // --- ITEM-BASED BONUS POINTS ---
        if ((mode === 'item' || mode === 'both') && loyaltyConfig.itemBonusRules?.length > 0) {
          if (bill.items && Array.isArray(bill.items)) {
            for (const billItem of bill.items) {
              if (!billItem.name) continue;
              const rule = loyaltyConfig.itemBonusRules.find(
                r => r.itemName?.toLowerCase() === billItem.name?.toLowerCase()
              );
              if (rule && rule.bonusPoints > 0) {
                totalPointsEarned += rule.bonusPoints * (billItem.quantity || 1);
              }
            }
          }
        }

        // --- VISIT MILESTONE BONUS REWARDS ---
        if (loyaltyConfig.milestoneRewards && Array.isArray(loyaltyConfig.milestoneRewards)) {
          const milestoneRule = loyaltyConfig.milestoneRewards.find(m => m.visitNumber === customer.totalVisits);
          if (milestoneRule && milestoneRule.rewardPoints > 0) {
            totalPointsEarned += milestoneRule.rewardPoints;
            console.log(`[Loyalty] Customer ${customer.name || customer.phone} reached ${customer.totalVisits}th visit milestone! Awarded ${milestoneRule.rewardPoints} bonus pts.`);
          }
        }

        // --- WELCOME BONUS (first visit only) ---
        if (isFirstVisit && loyaltyConfig.welcomeBonus > 0) {
          totalPointsEarned += loyaltyConfig.welcomeBonus;
        }
      }

      const redemptionValue = loyaltyConfig.redemptionValue || 1;
      const walletRedeemed = bill.walletRedemption ? Number(bill.walletRedemption) : 0;

      // Deduct redeemed wallet balance and points if customer used wallet on this bill
      if (walletRedeemed > 0) {
        const pointsDeducted = Math.round(walletRedeemed / redemptionValue);
        customer.points = Math.max(0, (customer.points || 0) - pointsDeducted);
        customer.walletBalance = Math.max(0, (customer.walletBalance || 0) - walletRedeemed);
      }

      if (totalPointsEarned > 0) {
        const walletEarned = totalPointsEarned * redemptionValue;
        customer.points = (customer.points || 0) + totalPointsEarned;
        customer.walletBalance = (customer.walletBalance || 0) + walletEarned;

        // Save pointsEarned back to the bill
        try {
          const BillModel = getTenantModel(req, 'Bill', BillDefault);
          await BillModel.findByIdAndUpdate(bill._id, { pointsEarned: totalPointsEarned });
        } catch (billUpdateErr) {
          console.error('[Loyalty] Failed to update pointsEarned on bill:', billUpdateErr?.message);
        }
      }

      // Update Points Expiry Date on customer
      const walletExpiryDays = Number(loyaltyConfig.walletExpiry || 365);
      customer.pointsExpiryDate = new Date(Date.now() + walletExpiryDays * 86400000);
      customer.expiryWarningSent = false;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SEND WHATSAPP LOYALTY NOTIFICATION
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (loyaltyConfig.whatsappNotify !== false && (totalPointsEarned > 0 || walletRedeemed > 0) && cleanPhone && cleanPhone.length >= 10) {
        try {
          const { whatsappService } = await resolveTenantInfo(req);
          await whatsappService.ensureConnection();
          const waStatus = whatsappService.getStatus();

          if (waStatus?.status === 'CONNECTED' || Boolean(whatsappService.sock?.user?.id)) {
            const customerDisplayName = (customer.name && customer.name !== 'Guest')
              ? customer.name
              : 'Valued Customer';

            await whatsappService.sendLoyaltyMessage(cleanPhone, {
              customerName: customerDisplayName,
              pointsEarned: totalPointsEarned,
              totalPoints: customer.points,
              walletBalance: customer.walletBalance,
              tier: customer.tier,
              tierMultiplier,
              restaurantName,
              welcomeBonus: loyaltyConfig.welcomeBonus,
              isFirstVisit,
              walletRedeemed,
              imageUrl: loyaltyConfig.attachImageToReceipt !== false ? (loyaltyConfig.loyaltyImageUrl || null) : null
            });
            console.log(`[Loyalty WhatsApp] Successfully sent WhatsApp loyalty receipt to +91${cleanPhone} (Tier: ${customer.tier})`);
          } else {
            console.warn(`[Loyalty WhatsApp] WhatsApp not in CONNECTED state (status: ${waStatus?.status})`);
          }
        } catch (waErr) {
          console.warn(`[Loyalty] WhatsApp notification skipped: ${waErr?.message || 'not connected'}`);
        }
      }
    }

    await customer.save();
  } catch (error) {
    console.error('Error updating customer CRM:', error);
  }
};

export const createOrUpdateCustomer = async (req, res) => {
  try {
    const { name, phone, orderType } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    let customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: (name || 'Guest').trim(),
        lastOrderType: orderType || 'Dine-In'
      });
    } else {
      if (name && name.trim()) {
        customer.name = name.trim();
      }
      if (orderType) {
        customer.lastOrderType = orderType;
      }
    }
    await customer.save();
    res.status(200).json({ success: true, customer });
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateCustomerType = async (req, res) => {
  try {
    const { phone } = req.params;
    const { orderType } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    let customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    customer.lastOrderType = orderType;
    await customer.save();

    res.json({ success: true, customer });
  } catch (err) {
    console.error('Error updating customer type:', err);
    res.status(500).json({ message: err.message });
  }
};

