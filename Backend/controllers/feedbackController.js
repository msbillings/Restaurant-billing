import FeedbackDefault from '../models/Feedback.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// Get all feedback (with optional rating filter)
export const getFeedback = async (req, res) => {
  try {
    const Feedback = getTenantModel(req, 'Feedback', FeedbackDefault);
    const { rating } = req.query;
    let query = {};
    if (rating) {
      query.rating = rating;
    }
    
    const feedbackList = await Feedback.find(query).sort({ createdAt: -1 });
    res.status(200).json(feedbackList);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching feedback', error: error.message });
  }
};

// Get feedback statistics
export const getFeedbackStats = async (req, res) => {
  try {
    const Feedback = getTenantModel(req, 'Feedback', FeedbackDefault);
    const stats = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          averageFoodQuality: { $avg: '$foodQuality' },
          averageService: { $avg: '$service' },
          averageAmbience: { $avg: '$ambience' }
        }
      }
    ]);
    
    res.status(200).json(stats[0] || {
      averageRating: 0, totalReviews: 0, averageFoodQuality: 0, averageService: 0, averageAmbience: 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching feedback stats', error: error.message });
  }
};

export const createFeedback = async (req, res) => {
  try {
    const Feedback = getTenantModel(req, 'Feedback', FeedbackDefault);
    const { customerName, phoneNumber, rating, foodQuality, service, ambience, comments, billId } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ message: 'Customer name is required.' });
    }

    const cleanPhone = phoneNumber ? phoneNumber.trim().replace(/\D/g, '') : '';
    if (cleanPhone && cleanPhone.length !== 10) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
    }

    const newFeedback = new Feedback({
      customerName: customerName.trim(),
      phoneNumber: cleanPhone || undefined,
      rating: Number(rating) || 5,
      foodQuality: Number(foodQuality) || 5,
      service: Number(service) || 5,
      ambience: Number(ambience) || 5,
      comments: comments ? comments.trim() : undefined,
      billId
    });

    await newFeedback.save();
    res.status(201).json(newFeedback);
  } catch (error) {
    res.status(500).json({ message: 'Error submitting feedback', error: error.message });
  }
};
