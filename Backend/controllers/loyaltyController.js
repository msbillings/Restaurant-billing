import LoyaltyConfigDefault from '../models/LoyaltyConfig.js';
import CustomerDefault from '../models/Customer.js';
import SettingDefault from '../models/Setting.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { resolveTenantInfo } from './whatsappController.js';
import { uploadImage } from '../utils/cloudinary.js';

// @desc    Get loyalty configuration
// @route   GET /api/loyalty/config
// @access  Private
export const getConfig = async (req, res) => {
  try {
    const LoyaltyConfig = getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault);
    let config = await LoyaltyConfig.findOne();
    if (!config) {
      config = await LoyaltyConfig.create({});
    }
    res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching loyalty config:', error);
    res.status(500).json({ message: 'Server error fetching configuration.' });
  }
};

// @desc    Update loyalty configuration
// @route   POST /api/loyalty/config
// @access  Private (Admin)
export const updateConfig = async (req, res) => {
  try {
    const LoyaltyConfig = getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault);
    const {
      enabled,
      loyaltyMode,
      conversionRate,
      redemptionValue,
      minBillAmount,
      maxRedemptionPercent,
      walletExpiry,
      autoExpiryEnabled,
      expiryWarningDays,
      expiryWarningNotify,
      welcomeBonus,
      itemBonusRules,
      whatsappNotify,
      loyaltyImageUrl,
      attachImageToReceipt,
      tiers,
      milestoneRewards
    } = req.body;

    let config = await LoyaltyConfig.findOne();

    if (!config) {
      config = new LoyaltyConfig({});
    }

    if (enabled !== undefined) config.enabled = enabled;
    if (loyaltyMode !== undefined) config.loyaltyMode = loyaltyMode;
    if (conversionRate !== undefined) config.conversionRate = Number(conversionRate);
    if (redemptionValue !== undefined) config.redemptionValue = Number(redemptionValue);
    if (minBillAmount !== undefined) config.minBillAmount = Number(minBillAmount);
    if (maxRedemptionPercent !== undefined) config.maxRedemptionPercent = Number(maxRedemptionPercent);
    if (walletExpiry !== undefined) config.walletExpiry = Number(walletExpiry);
    if (autoExpiryEnabled !== undefined) config.autoExpiryEnabled = autoExpiryEnabled;
    if (expiryWarningDays !== undefined) config.expiryWarningDays = Number(expiryWarningDays);
    if (expiryWarningNotify !== undefined) config.expiryWarningNotify = expiryWarningNotify;
    if (welcomeBonus !== undefined) config.welcomeBonus = Number(welcomeBonus);
    if (itemBonusRules !== undefined) config.itemBonusRules = itemBonusRules;
    if (whatsappNotify !== undefined) config.whatsappNotify = whatsappNotify;
    if (attachImageToReceipt !== undefined) config.attachImageToReceipt = attachImageToReceipt;
    if (tiers !== undefined) config.tiers = tiers;
    if (milestoneRewards !== undefined) config.milestoneRewards = milestoneRewards;

    if (loyaltyImageUrl !== undefined) {
      if (loyaltyImageUrl && loyaltyImageUrl.startsWith('data:image/')) {
        try {
          const tenantId = req.user?.db || req.tenantDb || 'default';
          const uploadRes = await uploadImage(loyaltyImageUrl, {
            folder: `msbillings/${tenantId}/loyalty`,
            publicId: `loyalty_poster_${Date.now()}`
          });
          if (uploadRes && uploadRes.url) {
            config.loyaltyImageUrl = uploadRes.url;
          } else {
            config.loyaltyImageUrl = loyaltyImageUrl;
          }
        } catch (uploadErr) {
          console.warn('[Loyalty] Cloudinary upload warning, saving URI directly:', uploadErr.message);
          config.loyaltyImageUrl = loyaltyImageUrl;
        }
      } else {
        config.loyaltyImageUrl = loyaltyImageUrl;
      }
    }

    await config.save();
    res.status(200).json(config);
  } catch (error) {
    console.error('Error updating loyalty config:', error);
    res.status(500).json({ message: 'Server error updating configuration.' });
  }
};

// @desc    Get loyalty stats (members, points, wallet balance)
// @route   GET /api/loyalty/stats
// @access  Private
export const getStats = async (req, res) => {
  try {
    const Customer = getTenantModel(req, 'Customer', CustomerDefault);
    const stats = await Customer.aggregate([
      {
        $group: {
          _id: null,
          totalPoints: { $sum: "$points" },
          totalWallet: { $sum: "$walletBalance" },
          activeMembers: {
            $sum: { $cond: [{ $gt: ["$points", 0] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats.length > 0 ? stats[0] : { totalPoints: 0, totalWallet: 0, activeMembers: 0 };

    res.status(200).json({
      activeMembers: result.activeMembers || 0,
      pointsDistributed: result.totalPoints || 0,
      totalWalletBalance: result.totalWallet || 0
    });
  } catch (error) {
    console.error('Error fetching loyalty stats:', error);
    res.status(500).json({ message: 'Server error fetching stats.' });
  }
};

// @desc    Get customer points + wallet balance by phone
// @route   GET /api/loyalty/customer/:phone
// @access  Private
export const getCustomerLoyalty = async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone) return res.status(400).json({ message: 'Phone number required' });
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);

    const Customer = getTenantModel(req, 'Customer', CustomerDefault);
    const LoyaltyConfig = getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault);

    const [customer, config] = await Promise.all([
      Customer.findOne({
        $or: [{ phone: cleanPhone }, { phone: phone.trim() }]
      }).lean(),
      LoyaltyConfig.findOne().lean()
    ]);

    res.status(200).json({
      phone: customer?.phone || cleanPhone,
      name: customer?.name || '',
      points: customer?.points || 0,
      walletBalance: customer?.walletBalance || 0,
      totalSpend: customer?.totalSpend || 0,
      totalVisits: customer?.totalVisits || 0,
      isVIP: customer?.isVIP || false,
      config: {
        enabled: config?.enabled ?? true,
        loyaltyMode: config?.loyaltyMode || 'spend',
        conversionRate: config?.conversionRate || 100,
        redemptionValue: config?.redemptionValue || 1,
        maxRedemptionPercent: config?.maxRedemptionPercent ?? 100,
        minBillAmount: config?.minBillAmount || 0,
        welcomeBonus: config?.welcomeBonus || 0
      }
    });
  } catch (error) {
    console.error('Error fetching customer loyalty:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manual adjustment of customer points / wallet by admin
// @route   POST /api/loyalty/adjust
// @access  Private (Admin)
export const adjustCustomerPoints = async (req, res) => {
  try {
    const { phone, customerId, pointsDelta, walletDelta, reason } = req.body;
    if (!phone && !customerId) return res.status(400).json({ message: 'Phone number or customerId required' });

    const Customer = getTenantModel(req, 'Customer', CustomerDefault);
    let customer = null;

    if (customerId) {
      customer = await Customer.findById(customerId);
    }
    if (!customer && phone) {
      const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
      customer = await Customer.findOne({
        $or: [{ phone: cleanPhone }, { phone: phone.trim() }]
      });
    }

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (pointsDelta !== undefined) {
      customer.points = Math.max(0, (customer.points || 0) + Number(pointsDelta));
    }
    if (walletDelta !== undefined) {
      customer.walletBalance = Math.max(0, (customer.walletBalance || 0) + Number(walletDelta));
    }

    await customer.save();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SEND WHATSAPP NOTIFICATION ON ADJUSTMENT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
      const LoyaltyConfig = getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault);
      const loyaltyConfig = await LoyaltyConfig.findOne().lean();
      
      const cleanPhone = (customer.phone || '').trim().replace(/\D/g, '').slice(-10);
      if (loyaltyConfig?.whatsappNotify !== false && cleanPhone && cleanPhone.length >= 10) {
        const { whatsappService, restaurantName } = await resolveTenantInfo(req);
        await whatsappService.ensureConnection();

        if (whatsappService.status === 'CONNECTED' || Boolean(whatsappService.sock?.user?.id)) {
          let adjustmentText = '';
          if (pointsDelta && pointsDelta !== 0) {
            adjustmentText += `\n⭐ *Points ${Number(pointsDelta) > 0 ? 'Credited' : 'Deducted'}:* ${Number(pointsDelta) > 0 ? '+' : ''}${pointsDelta} pts`;
          }
          if (walletDelta && walletDelta !== 0) {
            adjustmentText += `\n💳 *Wallet Balance ${Number(walletDelta) > 0 ? 'Added' : 'Deducted'}:* ${Number(walletDelta) > 0 ? '+' : ''}₹${walletDelta}`;
          }

          const customerDisplayName = (customer.name && customer.name !== 'Guest') ? customer.name : 'Valued Customer';
          const restName = restaurantName || 'our restaurant';
          const msg =
`🎉 Hi *${customerDisplayName}*!

Your *${restName}* Loyalty Account has been updated! 🎁
${adjustmentText}${reason ? `\n📝 *Note:* ${reason}` : ''}

🏆 *Total Points:* ${customer.points} pts
💰 *Wallet Balance:* ₹${(customer.walletBalance || 0).toFixed(0)}

Use your wallet balance on your next visit! 😊`;

          await whatsappService.sendMessage(cleanPhone, msg);
          console.log(`[Loyalty] Sent manual adjustment WhatsApp alert to +91${cleanPhone}`);
        } else {
          console.warn(`[Loyalty] WhatsApp not connected for tenant (status: ${whatsappService?.status})`);
        }
      }
    } catch (waErr) {
      console.warn('[Loyalty] Adjustment WhatsApp notification error:', waErr?.message);
    }

    res.status(200).json({
      success: true,
      message: 'Loyalty balance updated successfully',
      customer: {
        phone: customer.phone,
        name: customer.name,
        points: customer.points,
        walletBalance: customer.walletBalance
      }
    });
  } catch (error) {
    console.error('Error adjusting customer points:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Test WhatsApp loyalty alert delivery
// @route   POST /api/loyalty/test-whatsapp
// @access  Public/Private with tenant header or auth
export const testLoyaltyWhatsApp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      return res.status(400).json({ message: 'Please provide a valid 10-digit phone number' });
    }

    const { whatsappService, restaurantName } = await resolveTenantInfo(req);
    await whatsappService.ensureConnection();

    const waStatus = whatsappService.getStatus();
    if (waStatus.status !== 'CONNECTED' && !Boolean(whatsappService.sock?.user?.id)) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp gateway is not connected. Please scan QR code in WhatsApp settings first.'
      });
    }

    let restName = restaurantName;
    if (!restName) {
      try {
        const Setting = getTenantModel(req, 'Setting', SettingDefault);
        const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
        let sVal = settingsDoc?.value;
        if (typeof sVal === 'string') {
          try { sVal = JSON.parse(sVal); } catch (e) {}
        }
        if (sVal?.restaurantName) {
          restName = sVal.restaurantName;
        }
      } catch (err) {}
    }
    if (!restName) restName = 'Our Restaurant';
    const testMessage =
`🌟 *TEST LOYALTY NOTIFICATION*

Hi there! This is a test WhatsApp notification from *${restName}* Loyalty Program! 🍽️

⭐ *Points Earned:* 25 pts
🏆 *Total Points:* 150 pts
💰 *Wallet Balance:* ₹150

Your automatic customer WhatsApp notifications are working perfectly! 🎉`;

    await whatsappService.sendMessage(cleanPhone, testMessage);
    console.log(`[Loyalty] Sent test WhatsApp message to +91${cleanPhone}`);

    res.status(200).json({
      success: true,
      message: `Test loyalty message sent successfully to +91 ${cleanPhone}!`
    });
  } catch (error) {
    console.error('Error sending test loyalty WhatsApp:', error);
    res.status(500).json({ message: error.message || 'Failed to send WhatsApp message' });
  }
};

// @desc    Get targeted audience count and list based on points / status
// @route   GET /api/loyalty/campaign/audience
// @access  Private (Admin)
export const getCampaignAudience = async (req, res) => {
  try {
    const { filterType = 'all_with_points', minPoints = 0, maxPoints } = req.query;
    const Customer = getTenantModel(req, 'Customer', CustomerDefault);

    let query = {};

    if (filterType === 'all_with_points') {
      query.points = { $gt: 0 };
    } else if (filterType === 'min_points') {
      query.points = { $gte: Math.max(0, Number(minPoints) || 0) };
    } else if (filterType === 'range_points') {
      const min = Math.max(0, Number(minPoints) || 0);
      const max = Number(maxPoints) || 999999;
      query.points = { $gte: min, $lte: max };
    } else if (filterType === 'vip') {
      query.isVIP = true;
    } else if (filterType === 'all') {
      query = {};
    }

    const allMatched = await Customer.find(query)
      .select('name phone points walletBalance isVIP totalVisits totalSpend lastVisit')
      .sort({ points: -1 })
      .lean();

    // Filter valid 10-digit phone numbers for WhatsApp
    const validCustomers = allMatched.filter(c => {
      const clean = (c.phone || '').replace(/\D/g, '').slice(-10);
      return clean.length >= 10;
    });

    res.status(200).json({
      success: true,
      totalMatched: validCustomers.length,
      customers: validCustomers.slice(0, 100)
    });
  } catch (error) {
    console.error('Error fetching campaign audience:', error);
    res.status(500).json({ message: error.message || 'Error fetching audience' });
  }
};

// @desc    Send automated bulk WhatsApp campaign targeted by points
// @route   POST /api/loyalty/campaign/send
// @access  Private (Admin)
export const sendLoyaltyCampaign = async (req, res) => {
  try {
    const {
      filterType = 'all_with_points',
      minPoints = 0,
      maxPoints,
      selectedPhones,
      messageTemplate,
      imageUrl,
      imageBase64,
      restaurantName: bodyRestaurantName
    } = req.body;

    if (!messageTemplate || !messageTemplate.trim()) {
      return res.status(400).json({ message: 'Campaign message text is required.' });
    }

    const { whatsappService, restaurantName } = await resolveTenantInfo(req);
    await whatsappService.ensureConnection();

    const waStatus = whatsappService.getStatus();
    if (waStatus.status !== 'CONNECTED' && !Boolean(whatsappService.sock?.user?.id)) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp gateway is offline. Please scan QR or verify connection in Settings before launching campaign.'
      });
    }

    const Customer = getTenantModel(req, 'Customer', CustomerDefault);
    let query = {};

    if (Array.isArray(selectedPhones) && selectedPhones.length > 0) {
      const cleanPhones = selectedPhones.map(p => String(p).replace(/\D/g, '').slice(-10));
      query = {
        $or: [
          { phone: { $in: cleanPhones } },
          { phone: { $in: selectedPhones } }
        ]
      };
    } else {
      if (filterType === 'all_with_points') {
        query.points = { $gt: 0 };
      } else if (filterType === 'min_points') {
        query.points = { $gte: Math.max(0, Number(minPoints) || 0) };
      } else if (filterType === 'range_points') {
        const min = Math.max(0, Number(minPoints) || 0);
        const max = Number(maxPoints) || 999999;
        query.points = { $gte: min, $lte: max };
      } else if (filterType === 'vip') {
        query.isVIP = true;
      }
    }

    const rawCustomers = await Customer.find(query).lean();
    const targetCustomers = rawCustomers.filter(c => {
      const clean = (c.phone || '').replace(/\D/g, '').slice(-10);
      return clean.length >= 10;
    });

    if (targetCustomers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No customers with valid phone numbers match your criteria.'
      });
    }

    console.log(`[Loyalty Campaign] Starting bulk WhatsApp send to ${targetCustomers.length} customers...`);

    let finalImageUrl = imageUrl || null;
    let finalImageBase64 = imageBase64 || null;

    if (finalImageBase64 && finalImageBase64.startsWith('data:image/')) {
      try {
        const tenantId = req.user?.db || req.tenantDb || 'default';
        const uploadRes = await uploadImage(finalImageBase64, {
          folder: `msbillings/${tenantId}/campaigns`,
          publicId: `campaign_${Date.now()}`
        });
        if (uploadRes && uploadRes.url) {
          finalImageUrl = uploadRes.url;
          finalImageBase64 = null;
        }
      } catch (uploadErr) {
        console.warn('[Loyalty Campaign] Cloudinary upload fallback to buffer:', uploadErr.message);
      }
    }

    const LoyaltyConfig = getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault);
    const loyaltyConfig = await LoyaltyConfig.findOne().lean();
    const pointRate = Number(loyaltyConfig?.redemptionValue || 1).toFixed(2);

    let restName = bodyRestaurantName || restaurantName;
    if (!restName) {
      try {
        const Setting = getTenantModel(req, 'Setting', SettingDefault);
        const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
        let sVal = settingsDoc?.value;
        if (typeof sVal === 'string') {
          try { sVal = JSON.parse(sVal); } catch (e) {}
        }
        if (sVal?.restaurantName) {
          restName = sVal.restaurantName;
        }
      } catch (err) {}
    }
    if (!restName) restName = req.user?.restaurantName || 'Our Restaurant';
    const restNameUpper = restName.toUpperCase();
    let sentCount = 0;
    let failCount = 0;
    const errors = [];

    for (const customer of targetCustomers) {
      const cleanPhone = customer.phone.replace(/\D/g, '').slice(-10);
      const customerDisplayName = (customer.name && customer.name !== 'Guest') ? customer.name : 'Valued Customer';
      const customerDisplayNameUpper = customerDisplayName.toUpperCase();
      const customerPoints = customer.points || 0;
      const customerWallet = Number(customer.walletBalance || 0).toFixed(0);
      const customerVisits = customer.totalVisits || 0;
      const rawSpend = Number(customer.totalSpend || 0);
      const customerSpend = rawSpend.toLocaleString('en-IN');

      // Resolve dynamic 3-tier VIP club membership: 'Silver', 'Gold', or 'Platinum VIP'
      const platTier = (loyaltyConfig?.tiers || []).find(t => t.name === 'Platinum VIP') || { minVisits: 15, minSpend: 15000 };
      const goldTier = (loyaltyConfig?.tiers || []).find(t => t.name === 'Gold') || { minVisits: 5, minSpend: 5000 };

      let membershipTier = 'Silver';
      if (customer.tier === 'Platinum VIP' || customerVisits >= platTier.minVisits || rawSpend >= platTier.minSpend || customer.isVIP) {
        membershipTier = 'Platinum VIP';
      } else if (customer.tier === 'Gold' || customerVisits >= goldTier.minVisits || rawSpend >= goldTier.minSpend) {
        membershipTier = 'Gold';
      } else {
        membershipTier = 'Silver';
      }

      // WhatsApp Read More spacer (4001 zero-width LRM characters like DayBook, Analytics & E-Bill)
      const READ_MORE = String.fromCharCode(8206).repeat(4001);

      // Interpolate tags with full support for case transformations and dynamic customer metrics
      let personalizedMessage = messageTemplate
        // Handle restaurant name and all uppercase variations
        .replace(/\{restaurantName\.toUpperCase\(\)\}/gi, restNameUpper)
        .replace(/\{restaurant\.toUpperCase\(\)\}/gi, restNameUpper)
        .replace(/\{restaurantName:upper\}/gi, restNameUpper)
        .replace(/\{restaurant_upper\}/gi, restNameUpper)
        .replace(/\{restaurantName\}/gi, restName)
        .replace(/\{restaurant\}/gi, restName)
        // Handle customer name variations
        .replace(/\{customerName\.toUpperCase\(\)\}/gi, customerDisplayNameUpper)
        .replace(/\{customerName:upper\}/gi, customerDisplayNameUpper)
        .replace(/\{customer_upper\}/gi, customerDisplayNameUpper)
        .replace(/\{customerName\}/gi, customerDisplayName)
        .replace(/\{name\}/gi, customerDisplayName)
        // Dynamic customer metrics (visits, spend, tier)
        .replace(/\{totalVisits\}|\{visits\}/gi, String(customerVisits))
        .replace(/\{totalSpend\}|\{spend\}/gi, customerSpend)
        .replace(/\{membershipTier\}|\{tier\}|\{vipStatus\}/gi, membershipTier)
        // Dynamic loyalty rate
        .replace(/\{redemptionRate\}|\{rate\}|\{pointRate\}|\{pointValue\}|\{redemptionValue\}/gi, pointRate)
        // Balance and points
        .replace(/\{points\}/gi, String(customerPoints))
        .replace(/\{walletBalance\}/gi, customerWallet)
        .replace(/\{wallet\}/gi, customerWallet);

      // Handle {read_more} / {readMore} tag or preserve existing LRM spacer
      if (/\{read_more\}|\{readmore\}|\{readMore\}/i.test(personalizedMessage)) {
        personalizedMessage = personalizedMessage.replace(/\{read_more\}|\{readmore\}|\{readMore\}/gi, `\n${READ_MORE}\n`);
      } else if (!personalizedMessage.includes(String.fromCharCode(8206))) {
        // If not explicitly provided and message is multi-line, auto-insert READ_MORE after 2-line header
        const lines = personalizedMessage.split('\n');
        if (lines.length > 3) {
          const previewLines = lines.slice(0, 2).join('\n');
          const detailLines = lines.slice(2).join('\n');
          personalizedMessage = `${previewLines}\n${READ_MORE}\n━━━━━━━━━━━━━━━━━━━━\n${detailLines.replace(/^(\s*━━━━━━━━━━━━━━━━━━━━\s*\n)+/, '')}`;
        }
      }

      try {
        if (finalImageUrl || finalImageBase64) {
          await whatsappService.sendCampaignMessage(cleanPhone, {
            imageUrl: finalImageUrl,
            imageBase64: finalImageBase64,
            caption: personalizedMessage
          });
        } else {
          await whatsappService.sendMessage(cleanPhone, personalizedMessage);
        }
        sentCount++;
        console.log(`[Loyalty Campaign] Sent ${sentCount}/${targetCustomers.length} to +91${cleanPhone} (${customerDisplayName})`);
      } catch (sendErr) {
        failCount++;
        errors.push({ phone: cleanPhone, name: customerDisplayName, error: sendErr.message });
        console.warn(`[Loyalty Campaign] Failed for +91${cleanPhone}:`, sendErr.message);
      }

      // 1.5 second pacing delay to protect WhatsApp account from spam limits
      if (targetCustomers.length > 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    res.status(200).json({
      success: true,
      message: `Campaign complete! Sent ${sentCount} messages (${failCount} failed).`,
      summary: {
        totalTargeted: targetCustomers.length,
        sentCount,
        failCount,
        errors
      }
    });
  } catch (error) {
    console.error('Error executing loyalty campaign:', error);
    res.status(500).json({ message: error.message || 'Failed to send campaign.' });
  }
};

// @desc    Get loyalty expiration statistics and upcoming expiring customer balances
// @route   GET /api/loyalty/expiry/stats
// @access  Private (Admin)
export const getExpiryStats = async (req, res) => {
  try {
    const Customer = getTenantModel(req, 'Customer', CustomerDefault);
    const LoyaltyConfig = getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault);

    const config = await LoyaltyConfig.findOne().lean();
    const walletExpiryDays = Number(config?.walletExpiry || 365);
    const warningDays = Number(config?.expiryWarningDays || 7);
    const autoExpiryEnabled = config?.autoExpiryEnabled !== false;

    const customersWithBalance = await Customer.find({
      $or: [{ points: { $gt: 0 } }, { walletBalance: { $gt: 0 } }]
    }).lean();

    const now = Date.now();
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let healthyCount = 0;
    const expiringSoonList = [];
    const expiredList = [];

    const tierStats = { Silver: 0, Gold: 0, 'Platinum VIP': 0 };

    for (const c of customersWithBalance) {
      const lastActivity = new Date(c.lastVisit || c.updatedAt || c.createdAt || now).getTime();
      const expiryTimestamp = lastActivity + walletExpiryDays * 86400000;
      const daysRemaining = Math.ceil((expiryTimestamp - now) / 86400000);

      const customerTier = c.tier || (c.isVIP ? 'Platinum VIP' : ((c.totalVisits || 0) >= 5 ? 'Gold' : 'Silver'));
      tierStats[customerTier] = (tierStats[customerTier] || 0) + 1;

      if (daysRemaining <= 0) {
        expiredCount++;
        expiredList.push({
          id: c._id,
          name: c.name || 'Valued Customer',
          phone: c.phone,
          points: c.points || 0,
          walletBalance: c.walletBalance || 0,
          tier: customerTier,
          daysOverdue: Math.abs(daysRemaining),
          lastVisit: c.lastVisit
        });
      } else if (daysRemaining <= warningDays) {
        expiringSoonCount++;
        expiringSoonList.push({
          id: c._id,
          name: c.name || 'Valued Customer',
          phone: c.phone,
          points: c.points || 0,
          walletBalance: c.walletBalance || 0,
          tier: customerTier,
          daysRemaining,
          warningSent: Boolean(c.expiryWarningSent),
          lastVisit: c.lastVisit
        });
      } else {
        healthyCount++;
      }
    }

    res.status(200).json({
      success: true,
      config: {
        autoExpiryEnabled,
        walletExpiryDays,
        warningDays,
        expiryWarningNotify: config?.expiryWarningNotify !== false
      },
      stats: {
        totalWithBalance: customersWithBalance.length,
        expiringSoonCount,
        expiredCount,
        healthyCount,
        tierStats
      },
      expiringSoonList: expiringSoonList.slice(0, 50),
      expiredList: expiredList.slice(0, 50)
    });
  } catch (error) {
    console.error('Error fetching loyalty expiry stats:', error);
    res.status(500).json({ message: 'Server error fetching expiry stats.' });
  }
};

// @desc    Execute expiry check: send warning alerts & archive/reset expired points
// @route   POST /api/loyalty/expiry/audit
// @access  Private (Admin)
export const runLoyaltyExpiryAudit = async (req, res) => {
  try {
    const Customer = getTenantModel(req, 'Customer', CustomerDefault);
    const LoyaltyConfig = getTenantModel(req, 'LoyaltyConfig', LoyaltyConfigDefault);

    const config = await LoyaltyConfig.findOne().lean();
    const walletExpiryDays = Number(config?.walletExpiry || 365);
    const warningDays = Number(config?.expiryWarningDays || 7);
    const autoExpiryEnabled = config?.autoExpiryEnabled !== false;
    const expiryWarningNotify = config?.expiryWarningNotify !== false;

    const { whatsappService, restaurantName } = await resolveTenantInfo(req);
    const restName = restaurantName || "our restaurant";

    const customersWithBalance = await Customer.find({
      $or: [{ points: { $gt: 0 } }, { walletBalance: { $gt: 0 } }]
    });

    const now = Date.now();
    let warningsSent = 0;
    let expiredResetCount = 0;
    let healthyCount = 0;
    const actionsTaken = [];

    const READ_MORE = String.fromCharCode(8206).repeat(4001);

    for (const customer of customersWithBalance) {
      const cleanPhone = (customer.phone || '').replace(/\D/g, '').slice(-10);
      const lastActivity = new Date(customer.lastVisit || customer.updatedAt || customer.createdAt || now).getTime();
      const expiryTimestamp = lastActivity + walletExpiryDays * 86400000;
      const daysRemaining = Math.ceil((expiryTimestamp - now) / 86400000);
      customer.pointsExpiryDate = new Date(expiryTimestamp);

      // Auto update customer tier based on loyalty config tiers
      const visits = customer.totalVisits || 0;
      const spend = customer.totalSpend || 0;
      if (customer.isVIP || visits >= 15 || spend >= 15000) {
        customer.tier = 'Platinum VIP';
      } else if (visits >= 5 || spend >= 5000) {
        customer.tier = 'Gold';
      } else {
        customer.tier = 'Silver';
      }

      // 1. Check for Pre-Expiry Warning (e.g. 7 days or less remaining)
      if (daysRemaining > 0 && daysRemaining <= warningDays) {
        if (!customer.expiryWarningSent && expiryWarningNotify && cleanPhone.length >= 10) {
          const customerName = (customer.name && customer.name !== 'Guest') ? customer.name : 'Valued Customer';
          const warningMsg =
`⏰ *LOYALTY POINTS EXPIRATION ALERT* ⏰
🏨 *${restName.toUpperCase()}* | *ACTION REQUIRED*
${READ_MORE}
━━━━━━━━━━━━━━━━━━━━
Dear *${customerName}*,

You have active loyalty rewards at *${restName}* that are scheduled to expire soon!

⭐ *Available Points:* *${customer.points} Points*
💰 *Wallet Value:* *₹${Number(customer.walletBalance || 0).toFixed(0)}*
⏳ *Time Remaining:* *Only ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''} Left!*

Don't let your rewards go to waste! Visit us this week or order online to redeem your points on delicious food before they reset. 🍽️

━━━━━━━━━━━━━━━━━━━━
🥂 _We look forward to serving you again at ${restName}!_`;

          try {
            if (whatsappService && (whatsappService.status === 'CONNECTED' || Boolean(whatsappService.sock?.user?.id))) {
              await whatsappService.sendMessage(cleanPhone, warningMsg);
              customer.expiryWarningSent = true;
              warningsSent++;
              actionsTaken.push({
                phone: cleanPhone,
                name: customerName,
                action: 'WARNING_DISPATCHED',
                daysRemaining
              });
            }
          } catch (waErr) {
            console.warn(`[Expiry Audit] Warning WhatsApp dispatch failed for +91${cleanPhone}:`, waErr.message);
          }
        }
      }

      // 2. Check for Expired Accounts (0 or negative days remaining)
      if (daysRemaining <= 0) {
        if (autoExpiryEnabled) {
          const pointsCleared = customer.points;
          const walletCleared = customer.walletBalance;

          customer.points = 0;
          customer.walletBalance = 0;
          customer.expiryWarningSent = false;
          expiredResetCount++;

          actionsTaken.push({
            phone: cleanPhone,
            name: customer.name || 'Valued Customer',
            action: 'POINTS_EXPIRED_RESET',
            pointsCleared,
            walletCleared
          });
        }
      } else if (daysRemaining > warningDays) {
        healthyCount++;
      }

      await customer.save();
    }

    res.status(200).json({
      success: true,
      message: `Loyalty expiry audit finished. ${warningsSent} warning alerts sent, ${expiredResetCount} inactive accounts reset.`,
      stats: {
        totalEvaluated: customersWithBalance.length,
        warningsSent,
        expiredResetCount,
        healthyCount
      },
      actionsTaken
    });
  } catch (error) {
    console.error('Error executing loyalty expiry audit:', error);
    res.status(500).json({ message: error.message || 'Server error running expiry audit.' });
  }
};

