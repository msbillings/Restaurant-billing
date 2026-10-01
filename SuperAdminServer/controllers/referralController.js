import Client from '../models/Client.js';
import Admin from '../models/Admin.js';

export const getReferrals = async (req, res) => {
  try {
    const clientsWithReferrals = await Client.find({ referredBy: { $exists: true } })
      .populate('referredBy', 'restaurantName email')
      .sort({ createdAt: -1 });

    const logs = clientsWithReferrals.map(client => ({
      _id: client._id,
      createdAt: client.createdAt,
      referrerId: client.referredBy,
      refereeId: {
        restaurantName: client.restaurantName,
        email: client.email
      },
      referrerRewardDays: client.referrerRewardDays || 0,
      refereeRewardDays: client.refereeRewardDays || 0,
      status: client.referralStatus || 'Completed'
    }));

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching referral logs:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const getSettings = async (req, res) => {
  try {
    let admin = await Admin.findOne({ role: 'SuperAdmin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'SuperAdmin not found' });
    }
    
    res.json({ 
      success: true, 
      referrerRewardDays: admin.referrerRewardDays || 7, 
      refereeRewardDays: admin.refereeRewardDays || 7 
    });
  } catch (error) {
    console.error('Error fetching referral settings:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { referrerRewardDays, refereeRewardDays } = req.body;
    if (!referrerRewardDays || referrerRewardDays < 1 || !refereeRewardDays || refereeRewardDays < 1) {
      return res.status(400).json({ success: false, message: 'Invalid reward days provided' });
    }
    
    let admin = await Admin.findOne({ role: 'SuperAdmin' });
    if (admin) {
      admin.referrerRewardDays = referrerRewardDays;
      admin.refereeRewardDays = refereeRewardDays;
      await admin.save();
    }
    
    res.json({ success: true, referrerRewardDays, refereeRewardDays });
  } catch (error) {
    console.error('Error updating referral settings:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
