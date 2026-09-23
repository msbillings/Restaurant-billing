import React, { useState, useEffect } from 'react';
import { X, Sparkles, MessageCircle, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';

const LoyaltyRedemptionModal = ({ isOpen, onClose, customer, billAmount, onRedeemSuccess }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [liveCustomer, setLiveCustomer] = useState(customer);

  useEffect(() => {
    if (isOpen) {
      setOtpSent(false);
      setOtp('');
      setError('');
      setTimeLeft(0);
      
      setLiveCustomer(prev => (prev?.phone === customer?.phone && prev?.points !== undefined ? prev : customer));
      
      if (customer?.phone) {
        api.get(`/loyalty/customer/${customer.phone}`)
          .then(res => {
            if (res.data) {
              setLiveCustomer(res.data);
            }
          })
          .catch(err => console.warn('Failed to fetch live loyalty data', err));
      }
    }
  }, [isOpen, customer?.phone]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  if (!isOpen || !customer) return null;

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      setError('');
      await api.post('/loyalty/generate-otp', {
        phone: customer.phone,
        billAmount
      });
      setOtpSent(true);
      setTimeLeft(300); // 5 minutes
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      setError('Please enter a valid OTP.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await api.post('/loyalty/verify-otp', {
        phone: customer.phone,
        otp,
        billAmount
      });
      onRedeemSuccess(res.data.discountAmount, res.data.pointsDeducted);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'fadeInScale 0.2s ease' }}
      >
        {/* Header */}
        <div
          className="p-5 text-white flex justify-between items-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <ShieldCheck size={24} color="white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Loyalty Redemption</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>Secure OTP Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-all relative z-10"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <X size={20} color="white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Customer Info Card */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-sm text-gray-500 font-medium">Customer</span>
              <span className="font-bold text-gray-800">{liveCustomer?.name || customer?.name || 'Valued Customer'}</span>
            </div>
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-sm text-gray-500 font-medium">Phone</span>
              <span className="font-bold text-gray-800 font-mono">{liveCustomer?.phone || customer?.phone}</span>
            </div>
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-sm text-gray-500 font-medium">Points Balance</span>
              <span className="font-black px-2 py-0.5 rounded-md" style={{ color: '#d97706', background: '#fef3c7' }}>
                {liveCustomer?.points ?? customer?.points ?? 0} pts
              </span>
            </div>
            <div className="flex justify-between items-center pt-2.5 border-t border-gray-200">
              <span className="text-sm text-gray-500 font-medium">Wallet Balance</span>
              <span className="font-black px-2 py-0.5 rounded-md" style={{ color: '#16a34a', background: '#dcfce7' }}>
                ₹{Number(liveCustomer?.walletBalance || customer?.walletBalance || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Send OTP Phase */}
          {!otpSent ? (
            <div className="text-center">
              <p className="text-gray-500 text-sm mb-5">
                An OTP will be sent to <strong className="text-gray-800 font-mono">{customer?.phone}</strong> via WhatsApp.
              </p>
              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full font-bold py-3 px-4 rounded-xl text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                style={{ background: '#25D366' }}
              >
                {loading
                  ? <span className="block w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                  : <MessageCircle size={20} />
                }
                Send OTP to WhatsApp
              </button>
            </div>
          ) : (
            /* Verify OTP Phase */
            <div className="space-y-4">
              <div className="p-3 rounded-lg text-sm flex items-center justify-center gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
                <CheckCircle2 size={16} />
                OTP sent to WhatsApp successfully!
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-center font-mono font-bold text-gray-800"
                  style={{ fontSize: '1.5rem', letterSpacing: '0.5em', borderColor: otp.length === 6 ? '#f59e0b' : '' }}
                  maxLength={6}
                  autoFocus
                />
              </div>

              <div className="text-center text-sm text-gray-400">
                {timeLeft > 0
                  ? <span>OTP valid for: <strong style={{ color: '#d97706' }}>{formatTime(timeLeft)}</strong></span>
                  : <button onClick={handleSendOtp} disabled={loading} className="font-bold hover:underline" style={{ color: '#d97706' }}>Resend OTP</button>
                }
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length < 4}
                className="w-full text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
              >
                {loading && <span className="block w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />}
                ✓ Verify &amp; Redeem Points
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default LoyaltyRedemptionModal;
