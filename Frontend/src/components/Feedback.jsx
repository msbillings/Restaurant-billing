import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { Plus, ArrowLeft, Star, MessageSquare, ThumbsUp, Utensils, Coffee, Settings2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import logoImg from '../assets/images/logo.png';

const Feedback = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [googleReviewLink, setGoogleReviewLink] = useState(localStorage.getItem('googleReviewLink') || '');
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [tempGoogleLink, setTempGoogleLink] = useState('');

  const saveGoogleLink = () => {
    localStorage.setItem('googleReviewLink', tempGoogleLink);
    setGoogleReviewLink(tempGoogleLink);
    setIsGoogleModalOpen(false);
  };

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
      axios.get(`${getApiUrl()}/feedback`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      }),
      axios.get(`${getApiUrl()}/feedback/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })]
      );
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
      await axios.post(`${getApiUrl()}/feedback`, formData, {
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

  const handlePrintQR = () => {
    const svgElement = document.getElementById('google-qr-code');
    if (!svgElement) return;

    let customLogo = '';
    try {
      const savedSettings = JSON.parse(localStorage.getItem('restaurantSettings'));
      if (savedSettings && savedSettings.logo) {
        customLogo = savedSettings.logo;
      }
    } catch(e) {}

    const svgData = new XMLSerializer().serializeToString(svgElement.querySelector('svg'));
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code</title>
          <style>
            body { display: flex; justify-content: space-between; align-items: center; height: 100vh; margin: 0; flex-direction: column; font-family: sans-serif; text-align: center; box-sizing: border-box; padding: 40px; }
            .content-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; }
            .custom-logo { max-height: 200px; max-width: 400px; margin-bottom: 50px; object-fit: contain; }
            svg { width: 400px; height: 400px; }
            h1 { margin-top: 30px; font-size: 28px; color: #111; }
            p { font-size: 18px; color: #555; margin-top: 10px; max-width: 400px; }
            .footer { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: auto; opacity: 0.7; }
            .footer-text { font-size: 14px; color: #777; font-weight: bold; }
            .ms-logo { height: 80px; object-fit: contain; }
          </style>
        </head>
        <body>
          <div class="content-wrapper">
            ${customLogo ? '<img src="' + customLogo + '" alt="Restaurant Logo" class="custom-logo" />' : ''}
            ${svgData}
            <h1>Review Us on Google!</h1>
            <p>Scan this QR code with your phone camera to leave a review.</p>
          </div>
          <div class="footer">
            <span class="footer-text">Powered by</span>
            <img src="${logoImg}" alt="MS Billings" class="ms-logo" />
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 250);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, i) =>
    <Star key={i} size={16} className={i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t("Customer Feedback")}</h1>
            <p className="text-sm text-gray-500">{t("View and manage customer reviews")}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setTempGoogleLink(googleReviewLink); setIsGoogleModalOpen(true); }}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm">
            <Settings2 size={18} />{t("Google Setup")}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm">
            
            <Plus size={20} />{t("Add Feedback")}
          </button>
        </div>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

      <>
          {/* Stats Section */}
          {stats && stats.totalReviews > 0 &&
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 text-yellow-400 mb-1">
                  <Star size={24} className="fill-yellow-400" />
                </div>
                <h3 className="text-3xl font-bold text-gray-800">{stats.averageRating.toFixed(1)}</h3>
                <p className="text-xs text-gray-500 font-medium">{t("Average Rating")}</p>
                <p className="text-[10px] text-gray-400 mt-1">{t("Based on")}{stats.totalReviews}{t("reviews")}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <Utensils size={24} className="text-orange-500 mb-1" />
                <h3 className="text-2xl font-bold text-gray-800">{stats.averageFoodQuality.toFixed(1)}<span className="text-sm text-gray-400 font-normal">/5</span></h3>
                <p className="text-xs text-gray-500 font-medium">{t("Food Quality")}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <ThumbsUp size={24} className="text-blue-500 mb-1" />
                <h3 className="text-2xl font-bold text-gray-800">{stats.averageService.toFixed(1)}<span className="text-sm text-gray-400 font-normal">/5</span></h3>
                <p className="text-xs text-gray-500 font-medium">{t("Service")}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <Coffee size={24} className="text-purple-500 mb-1" />
                <h3 className="text-2xl font-bold text-gray-800">{stats.averageAmbience.toFixed(1)}<span className="text-sm text-gray-400 font-normal">/5</span></h3>
                <p className="text-xs text-gray-500 font-medium">{t("Ambience")}</p>
              </div>
            </div>
        }

          {googleReviewLink && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 flex gap-6 items-center">
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 shrink-0" id="google-qr-code">
                <QRCodeSVG value={googleReviewLink} size={100} level="H" includeMargin={true} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Star className="text-blue-500 fill-blue-500" size={24} /> {t("Google Reviews QR Code")}
                </h2>
                <p className="text-gray-500 mt-1 max-w-xl text-sm">
                  {t("Print or show this QR code to your customers so they can easily leave a Google Review! Live ratings fetching is currently mocked until a Google Places API Key is provided.")}
                </p>
                <div className="flex gap-4 mt-3">
                  <a href={googleReviewLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-bold flex items-center gap-1">
                    {t("Test Link")} &rarr;
                  </a>
                  <button onClick={handlePrintQR} className="text-gray-600 hover:text-gray-900 text-sm font-bold flex items-center gap-1 underline">
                    {t("Print QR Code")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback List */}
          <div className="space-y-4">
            {feedbacks.length === 0 ?
          <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">{t("No feedback received yet.")}

          </div> :

          feedbacks.map((feedback) =>
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
                  
                  {feedback.comments &&
            <div className="bg-gray-50 p-4 rounded-lg text-gray-700 italic flex gap-3 mb-4 border border-gray-100">
                      <MessageSquare size={18} className="text-gray-400 mt-1 shrink-0" />
                      <p className="text-sm">"{feedback.comments}"</p>
                    </div>
            }
                  
                  <div className="flex gap-6 text-xs text-gray-500 border-t border-gray-100 pt-3 mt-2">
                    <span className="flex gap-1 items-center">{t("Food:")}{renderStars(feedback.foodQuality)}</span>
                    <span className="flex gap-1 items-center">{t("Service:")}{renderStars(feedback.service)}</span>
                    <span className="flex gap-1 items-center">{t("Ambience:")}{renderStars(feedback.ambience)}</span>
                  </div>
                </div>
          )
          }
          </div>
        </>
      }

      {/* Google Setup Modal */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings2 className="text-blue-500" size={20}/> {t("Google Reviews Setup")}</h2>
              <button onClick={() => setIsGoogleModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("Your Google Review Link")}</label>
              <input
                type="url"
                value={tempGoogleLink}
                onChange={(e) => setTempGoogleLink(e.target.value)}
                placeholder="https://g.page/r/.../review"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none mb-6"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsGoogleModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">{t("Cancel")}</button>
                <button onClick={saveGoogleLink} className="flex-1 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
                  <QrCode size={18} /> {t("Generate QR & Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Feedback Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">{t("Log Customer Feedback")}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Customer Name")}</label>
                  <input
                  type="text" required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Phone Number (Optional)")}</label>
                  <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-gray-100 py-4">
                {[
              { label: 'Overall Rating', field: 'rating' },
              { label: 'Food Quality', field: 'foodQuality' },
              { label: 'Service', field: 'service' },
              { label: 'Ambience', field: 'ambience' }].
              map((item) =>
              <div key={item.field} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                    <label className="text-xs font-semibold text-gray-700">{item.label}</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) =>
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, [item.field]: star })}>
                    
                          <Star size={16} className={star <= formData[item.field] ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                        </button>
                  )}
                    </div>
                  </div>
              )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Comments (Optional)")}</label>
                <textarea
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                rows="3" placeholder={t("What did the customer think?")} />

              
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">{t("Cancel")}</button>
                <button type="submit" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-medium shadow-lg shadow-primary/30 transition-all">{t("Submit Feedback")}</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default Feedback;