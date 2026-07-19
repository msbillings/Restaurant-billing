import ServiceRequestSchema from '../models/ServiceRequest.js';
import { getTenantModel } from '../utils/tenantHelper.js';

export const createServiceRequest = async (req, res) => {
  try {
    const { tableNumber, requestType } = req.body;
    
    // We get the tenant DB based on req.subdomain (set in middleware)
    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestSchema);
    
    // Create new request
    const newRequest = new ServiceRequest({
      tableNumber,
      requestType,
      status: 'Pending'
    });
    
    await newRequest.save();
    res.status(201).json(newRequest);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getActiveRequests = async (req, res) => {
  try {
    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestSchema);
    const requests = await ServiceRequest.find({ status: 'Pending' }).sort({ createdAt: 1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resolveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const ServiceRequest = getTenantModel(req, 'ServiceRequest', ServiceRequestSchema);
    
    const request = await ServiceRequest.findByIdAndUpdate(
      id, 
      { status: 'Resolved', resolvedAt: new Date() }, 
      { new: true }
    );
    
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
