import Feedback from '../models/Feedback.js';

// Get all feedback (with optional rating filter)
export const getFeedback = async (req, res) => {
  try {
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

// Create a new feedback entry (Public endpoint usually, but we'll protect it for now)
export const createFeedback = async (req, res) => {
  try {
    const newFeedback = new Feedback(req.body);
    await newFeedback.save();
    res.status(201).json(newFeedback);
  } catch (error) {
    res.status(500).json({ message: 'Error submitting feedback', error: error.message });
  }
};
