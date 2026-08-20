import OnlineConfigDefault from '../models/OnlineConfig.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Get online configuration (creates a default one if none exists)
export const getOnlineConfig = async (req, res) => {
  try {
    const OnlineConfig = getTenantModel(req, 'OnlineConfig', OnlineConfigDefault);
    let config = await OnlineConfig.findOne();
    
    if (!config) {
      config = new OnlineConfig();
      await config.save();
    }
    
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching online config', error: error.message });
  }
};

// Update online configuration
export const updateOnlineConfig = async (req, res) => {
  try {
    const OnlineConfig = getTenantModel(req, 'OnlineConfig', OnlineConfigDefault);
    let config = await OnlineConfig.findOne();
    
    if (!config) {
      config = new OnlineConfig(req.body);
      await config.save();
      return res.status(201).json(config);
    }
    
    const updatedConfig = await OnlineConfig.findByIdAndUpdate(config._id, req.body, { new: true });
    res.status(200).json(updatedConfig);
  } catch (error) {
    res.status(500).json({ message: 'Error updating online config', error: error.message });
  }
};
