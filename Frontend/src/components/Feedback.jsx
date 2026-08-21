import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { Plus, ArrowLeft, Star, MessageSquare, ThumbsUp, Utensils, Coffee, Settings2, QrCode, Phone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import logoImg from '../assets/images/logo.png';

const Feedback = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const [feedbackRes, statsRes] = await Promise.all([
      axios.get(`${getApiUrl()}/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get(`${getApiUrl()}/feedback/stats`, {
        headers: { Authorization: `Bearer ${token}` }
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
    if (!formData.customerName.trim()) {
      alert(t("Please enter customer name"));
      return;
    }
    if (formData.phoneNumber && formData.phoneNumber.length !== 10) {
      alert(t("Please enter a valid 10-digit mobile number"));
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      await axios.post(`${getApiUrl()}/feedback`, {
        ...formData,
        customerName: formData.customerName.trim(),
        phoneNumber: formData.phoneNumber.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsModalOpen(false);
      setFormData({
        customerName: '', phoneNumber: '', rating: 5, foodQuality: 5, service: 5, ambience: 5, comments: ''
      });
      fetchData();
      alert(t("Customer feedback logged successfully!"));
    } catch (error) {
      console.error('Error submitting feedback', error);
      alert(t("Error submitting feedback: ") + (error.response?.data?.message || error.message));
    } finally {
      setIsSubmitting(false);
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
            .footer { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #888; margin-top: 20px; }
            .ms-logo { height: 24px; object-fit: contain; }
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

  const renderStars = (rating = 5, size = 15) => {
    return Array.from({ length: 5 }).map((_, i) =>
      <Star key={i} size={size} className={i < rating ? "text-amber-400 fill-amber-400" : "text-gray-200"} />
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-3 sm:p-6 overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-5 gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare className="text-primary shrink-0" size={20} />
              <span>{t("Customer Feedback")}</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-500">{t("View and manage customer reviews")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setTempGoogleLink(googleReviewLink); setIsGoogleModalOpen(true); }}
            className="flex items-center gap-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors text-xs font-bold shadow-xs cursor-pointer">
            <Settings2 size={15} />
            <span>{t("Google Setup")}</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 bg-primary hover:bg-primary-hover text-white px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs font-bold shadow-xs cursor-pointer">
            <Plus size={15} />
            <span>{t("Add Feedback")}</span>
          </button>
        </div>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

      <>
          {/* Stats Section - Compact and sleek on desktop & mobile */}
          {stats && stats.totalReviews > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-5">
              <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-gray-100 flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                  <Star size={18} className="fill-amber-400 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-base sm:text-xl font-black text-gray-800">{stats.averageRating.toFixed(1)}</h3>
                    <span className="text-[10px] text-gray-400">/5</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">{t("Average Rating")}</p>
                </div>
              </div>

              <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-gray-100 flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                  <Utensils size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-base sm:text-xl font-black text-gray-800">{stats.averageFoodQuality.toFixed(1)}</h3>
                    <span className="text-[10px] text-gray-400">/5</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">{t("Food Quality")}</p>
                </div>
              </div>

              <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-gray-100 flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                  <ThumbsUp size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-base sm:text-xl font-black text-gray-800">{stats.averageService.toFixed(1)}</h3>
                    <span className="text-[10px] text-gray-400">/5</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">{t("Service")}</p>
                </div>
              </div>

              <div className="bg-white p-2.5 sm:p-3.5 rounded-xl shadow-xs border border-gray-100 flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
                  <Coffee size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-base sm:text-xl font-black text-gray-800">{stats.averageAmbience.toFixed(1)}</h3>
                    <span className="text-[10px] text-gray-400">/5</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">{t("Ambience")}</p>
                </div>
              </div>
            </div>
          )}

          {googleReviewLink && (
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-3 sm:p-4 mb-3 sm:mb-5 flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
              <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-100 shrink-0" id="google-qr-code">
                <QRCodeSVG value={googleReviewLink} size={70} level="H" includeMargin={true} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-1.5">
                  <Star className="text-blue-500 fill-blue-500 shrink-0" size={16} />
                  <span>{t("Google Reviews QR Code")}</span>
                </h2>
                <p className="text-gray-500 mt-0.5 text-xs">
                  {t("Print or show this QR code to your customers so they can easily leave a Google Review.")}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <a href={googleReviewLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs font-bold flex items-center gap-1">
                    {t("Test Link")} &rarr;
                  </a>
                  <button onClick={handlePrintQR} className="text-gray-600 hover:text-gray-900 text-xs font-bold flex items-center gap-1 underline cursor-pointer">
                    {t("Print QR Code")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback List */}
          <div className="space-y-2.5 sm:space-y-3">
            {feedbacks.length === 0 ?
            <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-100 text-xs sm:text-sm">{t("No feedback received yet.")}</div> :

            feedbacks.map((feedback) =>
            <div key={feedback._id} className="bg-white rounded-xl shadow-xs border border-gray-100 p-3 sm:p-4 hover:border-gray-200 transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">{feedback.customerName}</h3>
                    {feedback.phoneNumber && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                        <Phone size={11} className="shrink-0" />
                        <span>+91 {feedback.phoneNumber}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                    {new Date(feedback.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', hour12: true
                    })}
                  </p>
                </div>
                <div className="flex bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-100 shrink-0">
                  {renderStars(feedback.rating, 14)}
                </div>
              </div>
              
              {feedback.comments &&
              <div className="bg-gray-50/80 p-2.5 rounded-lg text-gray-700 flex gap-2 mb-2.5 border border-gray-100/80">
                <MessageSquare size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs sm:text-sm leading-relaxed text-gray-600">"{feedback.comments}"</p>
              </div>
              }
              
              <div className="flex items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs text-gray-500 border-t border-gray-100 pt-2 mt-1 flex-wrap">
                <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                  <span className="font-medium text-gray-600">{t("Food")}:</span>
                  <span className="flex items-center">{renderStars(feedback.foodQuality || feedback.rating, 12)}</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                  <span className="font-medium text-gray-600">{t("Service")}:</span>
                  <span className="flex items-center">{renderStars(feedback.service || feedback.rating, 12)}</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                  <span className="font-medium text-gray-600">{t("Ambience")}:</span>
                  <span className="flex items-center">{renderStars(feedback.ambience || feedback.rating, 12)}</span>
                </div>
              </div>
            </div>
            )
            }
          </div>
        </>
      }

      {/* Google Setup Modal */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                <Settings2 className="text-blue-500 shrink-0" size={18}/>
                <span>{t("Google Reviews Setup")}</span>
              </h2>
              <button onClick={() => setIsGoogleModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors text-lg leading-none cursor-pointer">&times;</button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">{t("Your Google Review Link")}</label>
                <input
                  type="url"
                  value={tempGoogleLink}
                  onChange={(e) => setTempGoogleLink(e.target.value)}
                  placeholder="https://g.page/r/.../review"
                  className="w-full px-3.5 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">{t("Paste your Google Business profile review URL to generate a printable QR code.")}</p>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3 pt-1">
                <button 
                  onClick={() => setIsGoogleModalOpen(false)} 
                  className="flex-1 py-2.5 sm:py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors text-xs sm:text-sm cursor-pointer">
                  {t("Cancel")}
                </button>
                <button 
                  onClick={saveGoogleLink} 
                  className="flex-1 py-2.5 sm:py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-bold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap cursor-pointer">
                  <QrCode size={16} className="shrink-0" />
                  <span>{t("Save & Generate QR")}</span>
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
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">{t("Customer Name")}</label>
                  <input
                    type="text" required
                    maxLength="50"
                    placeholder={t("e.g., John Doe")}
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">{t("Phone Number (Optional)")}</label>
                  <input
                    type="tel"
                    pattern="[0-9]{10}"
                    maxLength="10"
                    placeholder="9876543210"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-y border-gray-100 py-3 sm:py-4">
                {[
                  { label: 'Overall Rating', field: 'rating' },
                  { label: 'Food Quality', field: 'foodQuality' },
                  { label: 'Service', field: 'service' },
                  { label: 'Ambience', field: 'ambience' }
                ].map((item) =>
                  <div key={item.field} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <label className="text-xs font-bold text-gray-700">{t(item.label)}</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) =>
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormData({ ...formData, [item.field]: star })}
                          className="p-0.5 hover:scale-110 transition-transform">
                          <Star size={18} className={star <= formData[item.field] ? "text-amber-400 fill-amber-400" : "text-gray-300"} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">{t("Comments (Optional)")}</label>
                <textarea
                  value={formData.comments}
                  maxLength="500"
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  rows="3" placeholder={t("What did the customer think?")} />
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors text-xs sm:text-sm">{t("Cancel")}</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !formData.customerName.trim() || (formData.phoneNumber && formData.phoneNumber.length !== 10)}
                  className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{t("Submit Feedback")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default Feedback;