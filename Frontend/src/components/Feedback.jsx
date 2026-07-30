import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, ArrowLeft, Star, MessageSquare, ThumbsUp, Utensils, Coffee } from 'lucide-react';

const Feedback = ({ onNavigate }) => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    rating: 5,
    foodQuality: 5,
    service: 5,
    ambience: 5,
    comments: ''
  });

  const fetchData = async () => {
    try {
      const [feedbackRes, statsRes] = await Promise.all([
        axios.get('http://localhost:5002/api/feedback', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get('http://localhost:5002/api/feedback/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);
      setFeedbacks(feedbackRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching feedback', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5002/api/feedback', formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setIsModalOpen(false);
      setFormData({
        customerName: '', phoneNumber: '', rating: 5, foodQuality: 5, service: 5, ambience: 5, comments: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error submitting feedback', error);
      alert('Error submitting feedback');
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={16} className={i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
    ));
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Customer Feedback</h1>
            <p className="text-sm text-gray-500">View and manage customer reviews</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm"
        >
          <Plus size={20} /> Add Feedback
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
      ) : (
        <>
          {/* Stats Section */}
          {stats && stats.totalReviews > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 text-yellow-400 mb-1">
                  <Star size={24} className="fill-yellow-400" />
                </div>
                <h3 className="text-3xl font-bold text-gray-800">{stats.averageRating.toFixed(1)}</h3>
                <p className="text-xs text-gray-500 font-medium">Average Rating</p>
                <p className="text-[10px] text-gray-400 mt-1">Based on {stats.totalReviews} reviews</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <Utensils size={24} className="text-orange-500 mb-1" />
                <h3 className="text-2xl font-bold text-gray-800">{stats.averageFoodQuality.toFixed(1)}<span className="text-sm text-gray-400 font-normal">/5</span></h3>
                <p className="text-xs text-gray-500 font-medium">Food Quality</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <ThumbsUp size={24} className="text-blue-500 mb-1" />
                <h3 className="text-2xl font-bold text-gray-800">{stats.averageService.toFixed(1)}<span className="text-sm text-gray-400 font-normal">/5</span></h3>
                <p className="text-xs text-gray-500 font-medium">Service</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <Coffee size={24} className="text-purple-500 mb-1" />
                <h3 className="text-2xl font-bold text-gray-800">{stats.averageAmbience.toFixed(1)}<span className="text-sm text-gray-400 font-normal">/5</span></h3>
                <p className="text-xs text-gray-500 font-medium">Ambience</p>
              </div>
            </div>
          )}

          {/* Feedback List */}
          <div className="space-y-4">
            {feedbacks.length === 0 ? (
              <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">
                No feedback received yet.
              </div>
            ) : (
              feedbacks.map(feedback => (
                <div key={feedback._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">{feedback.customerName}</h3>
                      <p className="text-xs text-gray-400">{new Date(feedback.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="flex bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      {renderStars(feedback.rating)}
                    </div>
                  </div>
                  
                  {feedback.comments && (
                    <div className="bg-gray-50 p-4 rounded-lg text-gray-700 italic flex gap-3 mb-4 border border-gray-100">
                      <MessageSquare size={18} className="text-gray-400 mt-1 flex-shrink-0" />
                      <p className="text-sm">"{feedback.comments}"</p>
                    </div>
                  )}
                  
                  <div className="flex gap-6 text-xs text-gray-500 border-t border-gray-100 pt-3 mt-2">
                    <span className="flex gap-1 items-center">Food: {renderStars(feedback.foodQuality)}</span>
                    <span className="flex gap-1 items-center">Service: {renderStars(feedback.service)}</span>
                    <span className="flex gap-1 items-center">Ambience: {renderStars(feedback.ambience)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Add Feedback Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">Log Customer Feedback</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input 
                    type="text" required
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
                  <input 
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-gray-100 py-4">
                {[
                  { label: 'Overall Rating', field: 'rating' },
                  { label: 'Food Quality', field: 'foodQuality' },
                  { label: 'Service', field: 'service' },
                  { label: 'Ambience', field: 'ambience' }
                ].map((item) => (
                  <div key={item.field} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                    <label className="text-xs font-semibold text-gray-700">{item.label}</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormData({...formData, [item.field]: star})}
                        >
                          <Star size={16} className={star <= formData[item.field] ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments (Optional)</label>
                <textarea 
                  value={formData.comments}
                  onChange={(e) => setFormData({...formData, comments: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  rows="3"
                  placeholder="What did the customer think?"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-medium shadow-lg shadow-primary/30 transition-all">Submit Feedback</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;
