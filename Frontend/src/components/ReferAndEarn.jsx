import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Gift, MessageSquare, ArrowLeft, Check, Copy, Users, Calendar, TrendingUp, Clock } from 'lucide-react';
import api from '../api/axios';
import BackButton from './common/BackButton';
import Toast from './Toast';

const ReferAndEarn = ({ onGoBack }) => {
  const { t } = useLanguage();
  const [referralCode, setReferralCode] = useState('REF-LOADING...');
  const [restaurantName, setRestaurantName] = useState('Your Restaurant');
  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [toast, setToast] = useState(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ totalEarnedDays: 0, totalReferrals: 0, history: [], loading: true });

  useEffect(() => {
    let isMounted = true;
    api.get('/config/info').then(res => {
      if (isMounted && res.data) {
        setReferralCode(res.data.referralCode || 'REF-NOT-FOUND');
        setRestaurantName(res.data.restaurantName || 'Your Restaurant');
      }
    }).catch(err => console.error("Error fetching refer config:", err));

    api.get('/config/referrals/history').then(res => {
      if (isMounted && res.data) {
        setStats({
          totalEarnedDays: res.data.totalEarnedDays || 0,
          totalReferrals: res.data.totalReferrals || 0,
          history: res.data.history || [],
          loading: false
        });
      }
    }).catch(err => {
      console.error("Error fetching referral history:", err);
      if (isMounted) setStats(prev => ({ ...prev, loading: false }));
    });

    return () => { isMounted = false; };
  }, []);

  // Dynamically use localhost or the current domain so the user can test locally
  const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:5173' 
    : 'https://msbillings.org';
  const inviteLink = `${baseUrl}/register?ref=${referralCode !== 'REF-LOADING...' ? referralCode : ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setToast({ message: t('Invite link copied to clipboard!'), type: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!friendName.trim()) {
      return setToast({ message: t('Please enter your friend\'s name'), type: 'error' });
    }
    const cleanPhone = friendPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return setToast({ message: t('Please enter a valid 10-digit phone number'), type: 'error' });
    }

    setSending(true);
    try {
      const res = await api.post('/whatsapp/send-referral', { 
        targetPhone: cleanPhone, 
        targetName: friendName.trim(),
        inviteLink: inviteLink // Pass the generated link (localhost or production)
      });
      setToast({ message: res.data.message, type: 'success' });
      setFriendName('');
      setFriendPhone('');
    } catch (e) {
      setToast({ message: e.response?.data?.message || t('Failed to send invite via WhatsApp.'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const previewMessage = `🎉 *Exclusive Invitation from ${restaurantName}* 🎉

Hi ${friendName || '[Friend\'s Name]'}! We highly recommend using *MSBillings* for your restaurant management.

Use our special invite link below to sign up and instantly get *Free Subscription Days* added to your account!

👉 *Click here to claim:* ${inviteLink}

Grow your restaurant with MSBillings today!`;

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 bg-background overflow-y-auto lg:overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header - Fixed Height */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-secondary/10 rounded-2xl p-4 border border-border mb-4 shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
            <Gift className="text-primary" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-main leading-tight">{t("Refer & Earn")}</h1>
            <p className="text-xs text-text-muted">{t("Invite friends to use MSBillings and earn free subscription time!")}</p>
          </div>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-4 min-h-0 pb-4 lg:pb-0">
        
        {/* Column 1: Code & Form */}
        <div className="flex flex-col gap-6 lg:gap-4 lg:overflow-y-auto lg:pr-1">
          {/* Referral Code Box */}
          <div className="bg-surface rounded-2xl p-5 border border-border shadow-md shrink-0">
            <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">{t("Your Unique Code")}</h3>
            <div className="flex flex-col xl:flex-row gap-2">
              <div className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 flex items-center justify-center">
                <span className="font-mono font-bold text-base text-primary tracking-widest">{referralCode}</span>
              </div>
              <button 
                onClick={handleCopy}
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 shrink-0 text-sm">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? t('Copied!') : t('Copy')}
              </button>
            </div>
          </div>

          {/* WhatsApp Invite Form */}
          <div className="bg-surface rounded-2xl p-5 border border-border shadow-md flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#25D366]/10 rounded-full flex items-center justify-center">
                <MessageSquare size={16} className="text-[#25D366]" />
              </div>
              <h2 className="text-base font-bold text-text-main">{t("Send WhatsApp Invite")}</h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">{t("Friend's Name")}</label>
                <input
                  type="text"
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  placeholder={t("e.g. Rahul")}
                  className="w-full px-3 py-2 border border-border rounded-xl focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] bg-background text-text-main transition outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">{t("Friend's WhatsApp Number")}</label>
                <div className="flex bg-background border border-border rounded-xl focus-within:ring-2 focus-within:ring-[#25D366]/30 focus-within:border-[#25D366] transition overflow-hidden">
                  <div className="px-3 py-2 bg-surface border-r border-border text-text-muted font-medium flex items-center justify-center text-sm">
                    +91
                  </div>
                  <input
                    type="text"
                    value={friendPhone}
                    onChange={(e) => setFriendPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 px-3 py-2 bg-transparent text-text-main outline-none text-sm"
                  />
                </div>
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !friendName || friendPhone.length < 10}
                className="w-full bg-[#25D366] hover:bg-[#1DA851] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition mt-4 text-sm">
                <MessageSquare size={16} fill="currentColor" />
                {sending ? t("Sending Invite...") : t("Send WhatsApp Message")}
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Live Preview */}
        <div className="flex flex-col bg-surface rounded-2xl border border-border shadow-md overflow-hidden lg:h-full min-h-[300px] lg:min-h-0">
          <div className="bg-[#075E54] px-4 py-2 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm">{friendName || t("Friend's Name")}</span>
              <span className="text-white/80 text-[10px]">online</span>
            </div>
          </div>
          <div className="flex-1 bg-[#E5DDD5] p-4 flex flex-col items-end overflow-y-auto">
            {/* WhatsApp Bubble */}
            <div className="bg-[#DCF8C6] p-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm relative">
              <p className="text-[#303030] whitespace-pre-wrap text-[13px] leading-relaxed">
                {previewMessage}
              </p>
              <div className="text-right mt-1">
                <span className="text-[10px] text-gray-500">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Referral Tracking */}
        <div className="flex flex-col gap-4 lg:h-full">
          
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-surface rounded-2xl p-3 border border-border shadow-md flex flex-col items-center justify-center text-center">
              <Users className="text-blue-600 mb-1" size={20} />
              <p className="text-xs font-semibold text-text-muted leading-tight">{t("Friends Joined")}</p>
              <h3 className="text-xl font-black text-text-main mt-1">
                {stats.loading ? '...' : stats.totalReferrals}
              </h3>
            </div>
            
            <div className="bg-surface rounded-2xl p-3 border border-border shadow-md flex flex-col items-center justify-center text-center">
              <Gift className="text-emerald-600 mb-1" size={20} />
              <p className="text-xs font-semibold text-text-muted leading-tight">{t("Days Earned")}</p>
              <h3 className="text-xl font-black text-emerald-600 mt-1">
                {stats.loading ? '...' : `+${stats.totalEarnedDays}`}
              </h3>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border shadow-md flex flex-col flex-1 min-h-[300px] lg:min-h-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-gray-50/50 shrink-0">
              <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                <Clock size={16} className="text-gray-500" />
                {t("Recent Activity")}
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {stats.loading ? (
                <div className="p-6 text-center text-sm text-text-muted animate-pulse">{t("Loading history...")}</div>
              ) : stats.history.length === 0 ? (
                <div className="p-6 text-center flex flex-col items-center justify-center h-full">
                  <Gift size={24} className="text-gray-300 mb-2" />
                  <h4 className="text-text-main text-sm font-bold mb-1">{t("No Referrals Yet")}</h4>
                  <p className="text-xs text-text-muted leading-tight">
                    {t("Share your link to start earning.")}
                  </p>
                </div>
              ) : (
                stats.history.map((log) => (
                  <div key={log.id} className="p-3 flex flex-col gap-2 hover:bg-gray-50/50 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-text-main truncate">{log.restaurantName}</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-0.5">
                          <span>{new Date(log.joinedAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="truncate">{log.phone}</span>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className={`font-black text-sm ${log.status === 'APPLIED' ? 'text-emerald-600' : 'text-gray-400'}`}>
                          +{log.daysEarned} {t("Days")}
                        </span>
                        {log.status === 'APPLIED' ? (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded border border-emerald-200">
                            {t("Successful")}
                          </span>
                        ) : log.status === 'PENDING' ? (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded border border-amber-200">
                            {t("Pending")}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded border border-red-200">
                            {t("Failed")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReferAndEarn;
