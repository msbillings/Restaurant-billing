import DiscountDefault from '../models/Discount.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';

// Get all discounts
export const getDiscounts = async (req, res) => {
  try {
    const Discount = getTenantModel(req, 'Discount', DiscountDefault);
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.status(200).json(discounts);
  } catch (error) {
    console.error('[getDiscounts] Error:', error);
    if (error.code === 'TENANT_NOT_RESOLVED') {
      return handleTenantError(error, res);
    }
    res.status(500).json({ message: 'Error fetching discounts', error: error.message });
  }
};

// Helper: validate start & end dates
const validateTimelineDates = (hasTimeline, startDate, endDate, startTime, endTime) => {
  if (!hasTimeline) return null;

  if (!startDate || !endDate) {
    return 'Both Start Date and End Date are required when setting an offer timeline.';
  }

  const sDate = new Date(`${startDate.split('T')[0]}T${startTime || '00:00'}:00`);
  const eDate = new Date(`${endDate.split('T')[0]}T${endTime || '23:59'}:00`);

  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
    return 'Invalid Start Date or End Date provided.';
  }

  if (sDate > eDate) {
    return 'Start Date & Time cannot be later than End Date & Time.';
  }

  return null;
};

// Helper: check for overlapping active offers for same category / all items
const checkActiveOfferConflicts = async (Discount, { applicableTo, targetCategory, excludeId = null }) => {
  const query = { isActive: true };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const activeDiscounts = await Discount.find(query);
  const conflicts = [];

  for (const item of activeDiscounts) {
    if (applicableTo === 'all') {
      if (item.applicableTo === 'all') {
        conflicts.push(`Active offer "${item.name}" (${item.type === 'percentage' ? `${item.value}%` : (item.type === 'bogo' ? 'BOGO' : `₹${item.value}`)}) is already applied to All Menu Items.`);
      } else if (item.applicableTo === 'category' && item.targetCategory) {
        conflicts.push(`Active offer "${item.name}" is applied to category "${item.targetCategory}".`);
      }
    } else if (applicableTo === 'category' && targetCategory) {
      if (item.applicableTo === 'all') {
        conflicts.push(`Active offer "${item.name}" is already applied to All Menu Items (including "${targetCategory}").`);
      } else if (item.applicableTo === 'category' && item.targetCategory && item.targetCategory.toLowerCase() === targetCategory.toLowerCase()) {
        conflicts.push(`Category "${targetCategory}" is already applied in active offer "${item.name}" (${item.type === 'percentage' ? `${item.value}%` : (item.type === 'bogo' ? 'BOGO' : `₹${item.value}`)}).`);
      }
    }
  }

  return conflicts;
};

// Create a new discount
export const createDiscount = async (req, res) => {
  try {
    const Discount = getTenantModel(req, 'Discount', DiscountDefault);
    const {
      name,
      type,
      value,
      isActive,
      buyQty,
      getQty,
      applicableTo,
      targetCategory,
      targetItems,
      hasTimeline,
      startDate,
      endDate,
      startTime,
      endTime,
      validityDays
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Offer / Discount title is required' });
    }

    const existing = await Discount.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: `An offer or discount named "${name.trim()}" already exists in your restaurant. Please choose a unique name.` });
    }

    // Date & Time Validation
    const dateError = validateTimelineDates(hasTimeline, startDate, endDate, startTime, endTime);
    if (dateError) {
      return res.status(400).json({ message: dateError });
    }

    // Check for conflicts
    const conflicts = await checkActiveOfferConflicts(Discount, {
      applicableTo: applicableTo || 'all',
      targetCategory: targetCategory || ''
    });

    const newDiscount = new Discount({
      name: name.trim(),
      type: type || 'percentage',
      value: value ? Number(value) : 0,
      isActive: isActive !== undefined ? isActive : true,
      buyQty: buyQty ? Number(buyQty) : 2,
      getQty: getQty ? Number(getQty) : 1,
      applicableTo: applicableTo || 'all',
      targetCategory: targetCategory || '',
      targetItems: targetItems || [],
      hasTimeline: !!hasTimeline,
      startDate: hasTimeline && startDate ? new Date(startDate) : null,
      endDate: hasTimeline && endDate ? new Date(endDate) : null,
      startTime: startTime || '00:00',
      endTime: endTime || '23:59',
      validityDays: validityDays ? Number(validityDays) : 0
    });

    await newDiscount.save();
    res.status(201).json({
      ...newDiscount.toObject(),
      conflictWarnings: conflicts
    });
  } catch (error) {
    console.error('[createDiscount] Error:', error);
    if (error.code === 'TENANT_NOT_RESOLVED') {
      return handleTenantError(error, res);
    }
    res.status(400).json({ message: error.message || 'Error creating discount' });
  }
};

// Update a discount
export const updateDiscount = async (req, res) => {
  try {
    const Discount = getTenantModel(req, 'Discount', DiscountDefault);
    const { id } = req.params;
    const {
      name,
      type,
      value,
      isActive,
      buyQty,
      getQty,
      applicableTo,
      targetCategory,
      targetItems,
      hasTimeline,
      startDate,
      endDate,
      startTime,
      endTime,
      validityDays
    } = req.body;

    if (name && name.trim()) {
      const duplicate = await Discount.findOne({ name: name.trim(), _id: { $ne: id } });
      if (duplicate) {
        return res.status(400).json({ message: `Another offer named "${name.trim()}" already exists in your restaurant.` });
      }
    }

    // Date & Time Validation
    const dateError = validateTimelineDates(hasTimeline, startDate, endDate, startTime, endTime);
    if (dateError) {
      return res.status(400).json({ message: dateError });
    }

    // Check for conflicts
    const conflicts = await checkActiveOfferConflicts(Discount, {
      applicableTo: applicableTo || 'all',
      targetCategory: targetCategory || '',
      excludeId: id
    });

    const payload = {
      name: name?.trim(),
      type: type || 'percentage',
      value: value ? Number(value) : 0,
      isActive: isActive !== undefined ? isActive : true,
      buyQty: buyQty ? Number(buyQty) : 2,
      getQty: getQty ? Number(getQty) : 1,
      applicableTo: applicableTo || 'all',
      targetCategory: targetCategory || '',
      targetItems: targetItems || [],
      hasTimeline: !!hasTimeline,
      startDate: hasTimeline && startDate ? new Date(startDate) : null,
      endDate: hasTimeline && endDate ? new Date(endDate) : null,
      startTime: startTime || '00:00',
      endTime: endTime || '23:59',
      validityDays: validityDays ? Number(validityDays) : 0
    };

    const updatedDiscount = await Discount.findByIdAndUpdate(id, payload, { new: true });
    if (!updatedDiscount) {
      return res.status(404).json({ message: 'Discount not found' });
    }
    res.status(200).json({
      ...updatedDiscount.toObject(),
      conflictWarnings: conflicts
    });
  } catch (error) {
    console.error('[updateDiscount] Error:', error);
    if (error.code === 'TENANT_NOT_RESOLVED') {
      return handleTenantError(error, res);
    }
    res.status(400).json({ message: error.message || 'Error updating discount' });
  }
};

// Delete a discount
export const deleteDiscount = async (req, res) => {
  try {
    const Discount = getTenantModel(req, 'Discount', DiscountDefault);
    const { id } = req.params;
    const deletedDiscount = await Discount.findByIdAndDelete(id);
    if (!deletedDiscount) {
      return res.status(404).json({ message: 'Discount not found' });
    }
    res.status(200).json(deletedDiscount);
  } catch (error) {
    console.error('[deleteDiscount] Error:', error);
    if (error.code === 'TENANT_NOT_RESOLVED') {
      return handleTenantError(error, res);
    }
    res.status(500).json({ message: 'Error deleting discount', error: error.message });
  }
};
