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
      welcomeBonus,
      itemBonusRules,
      whatsappNotify,
      loyaltyImageUrl,
      attachImageToReceipt
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
    if (welcomeBonus !== undefined) config.welcomeBonus = Number(welcomeBonus);
    if (itemBonusRules !== undefined) config.itemBonusRules = itemBonusRules;
    if (whatsappNotify !== undefined) config.whatsappNotify = whatsappNotify;
    if (attachImageToReceipt !== undefined) config.attachImageToReceipt = attachImageToReceipt;

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
      const customerSpend = Number(customer.totalSpend || 0).toLocaleString('en-IN');
      const membershipTier = customer.isVIP ? 'Elite Tier' : (customerVisits >= 10 ? 'Gold Tier' : 'Silver Tier');

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

