import LoyaltyConfig from '../models/LoyaltyConfig.js';
import Customer from '../models/Customer.js';

// @desc    Get loyalty configuration
// @route   GET /api/loyalty/config
// @access  Private
export const getConfig = async (req, res) => {
  try {
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
    const { enabled, conversionRate, redemptionValue, walletExpiry } = req.body;
    let config = await LoyaltyConfig.findOne();
    
    if (config) {
      config.enabled = enabled;
      config.conversionRate = conversionRate;
      config.redemptionValue = redemptionValue;
      config.walletExpiry = walletExpiry;
      await config.save();
    } else {
      config = await LoyaltyConfig.create({
        enabled,
        conversionRate,
        redemptionValue,
        walletExpiry
      });
    }
    
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
