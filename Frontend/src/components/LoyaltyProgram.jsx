import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { ArrowLeft, Wallet, Award, Gift, TrendingUp, Users } from 'lucide-react';

const LoyaltyProgram = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [enabled, setEnabled] = useState(true);
  const [conversionRate, setConversionRate] = useState('100'); // Rs 100 = 1 Point
  const [redemptionValue, setRedemptionValue] = useState('1'); // 1 Point = Rs 1
  const [walletExpiry, setWalletExpiry] = useState('365'); // days
  const [stats, setStats] = useState({ activeMembers: 0, pointsDistributed: 0, totalWalletBalance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch config
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        const configRes = await axios.get(`${getApiUrl()}/loyalty/config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const config = configRes.data;
        if (config) {
          setEnabled(config.enabled ?? true);
          setConversionRate(config.conversionRate ?? '100');
          setRedemptionValue(config.redemptionValue ?? '1');
          setWalletExpiry(config.walletExpiry ?? '365');
        }

        // Fetch stats
        const statsRes = await axios.get(`${getApiUrl()}/loyalty/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (statsRes.data) {
          setStats(statsRes.data);
        }
      } catch (err) {
        console.error('Error fetching loyalty data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      await axios.post(`${getApiUrl()}/loyalty/config`, {
        enabled,
        conversionRate: Number(conversionRate),
        redemptionValue: Number(redemptionValue),
        walletExpiry: Number(walletExpiry)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(t('Loyalty & Wallet configuration saved successfully!'));
    } catch (err) {
      console.error('Error saving loyalty configuration:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save configuration.';
      alert(`${t('Failed to save configuration')}: ${errMsg}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background p-2.5 sm:p-6 overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-6 gap-2.5 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-black text-text-main tracking-tight flex items-center gap-1.5 truncate">
              <Award className="text-primary shrink-0" size={20} />
              <span>{t("Loyalty & Wallet")}</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-text-muted truncate">{t("Reward your best customers with points and wallet balance")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 self-start sm:self-auto shrink-0">
          <label className="flex items-center cursor-pointer gap-2">
            <span className="text-xs sm:text-sm font-bold text-text-main">{t("Enable")}</span>
            <div className={`relative inline-flex h-6 w-11 sm:h-7 sm:w-12 items-center rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-surface-hover border border-border'}`}>
              <input type="checkbox" className="sr-only" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span className={`inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6 sm:translate-x-6' : 'translate-x-1'}`} />
            </div>
          </label>
          <button onClick={handleSave} className="bg-primary hover:bg-primary-hover text-white px-3.5 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer">{t("Save Rules")}</button>
        </div>
      </div>

      <div className={`flex-1 max-w-4xl mx-auto w-full space-y-3 sm:space-y-6 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        
        {/* KPI Cards - 3 tiles on one row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-surface p-2.5 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-3">
            <div className="min-w-0 w-full">
              <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider truncate">{t("Active Members")}</div>
              <div className="text-base sm:text-2xl font-black text-text-main mt-0.5">{loading ? '...' : stats.activeMembers.toLocaleString()}</div>
            </div>
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Users size={16} />
            </div>
          </div>

          <div className="bg-surface p-2.5 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-3">
            <div className="min-w-0 w-full">
              <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider truncate">{t("Points Issued")}</div>
              <div className="text-base sm:text-2xl font-black text-text-main mt-0.5">{loading ? '...' : stats.pointsDistributed.toLocaleString()}</div>
            </div>
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Award size={16} />
            </div>
          </div>

          <div className="bg-surface p-2.5 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-3">
            <div className="min-w-0 w-full">
              <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider truncate">{t("Wallet Balance")}</div>
              <div className="text-xs sm:text-2xl font-black text-emerald-600 mt-0.5 font-mono truncate">{loading ? '...' : `₹${stats.totalWalletBalance.toLocaleString()}`}</div>
            </div>
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
              <Wallet size={16} />
            </div>
          </div>
        </div>

        {/* Conversion Rules Card */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-8">
          <h2 className="text-sm sm:text-lg font-bold text-text-main mb-4 sm:mb-6 flex items-center gap-2">
            <TrendingUp className="text-primary shrink-0" size={18} />
            <span>{t("Point Conversion Rules")}</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            <div className="space-y-2.5 sm:space-y-3 bg-background p-3 sm:p-4 rounded-xl border border-border">
              <h3 className="font-bold text-text-muted uppercase text-[10px] sm:text-xs tracking-wider">{t("Earning Points")}</h3>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="font-bold text-text-main text-xs sm:text-sm">{t("For every ₹")}</span>
                <input
                  type="number"
                  value={conversionRate}
                  onChange={(e) => setConversionRate(e.target.value)}
                  className="w-20 sm:w-24 px-2.5 py-1.5 sm:py-2 bg-surface border border-border rounded-xl font-bold text-center text-xs sm:text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-text-main"
                />
                <span className="font-bold text-text-main text-xs sm:text-sm">{t("spent, earn")} <strong className="text-primary text-sm sm:text-base">{t("1 Point")}</strong></span>
              </div>
            </div>

            <div className="space-y-2.5 sm:space-y-3 bg-background p-3 sm:p-4 rounded-xl border border-border">
              <h3 className="font-bold text-text-muted uppercase text-[10px] sm:text-xs tracking-wider">{t("Redeeming Points")}</h3>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="font-bold text-text-main text-xs sm:text-sm">{t("1 Point equals ₹")}</span>
                <input
                  type="number"
                  value={redemptionValue}
                  onChange={(e) => setRedemptionValue(e.target.value)}
                  className="w-20 sm:w-24 px-2.5 py-1.5 sm:py-2 bg-surface border border-border rounded-xl font-bold text-center text-xs sm:text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-text-main"
                />
                <span className="font-bold text-text-main text-xs sm:text-sm">{t("in Wallet Balance")}</span>
              </div>
            </div>
            
            <div className="space-y-2.5 sm:space-y-3 md:col-span-2 pt-3 sm:pt-4 border-t border-border">
              <h3 className="font-bold text-text-muted uppercase text-[10px] sm:text-xs tracking-wider flex items-center gap-1.5">
                <Gift size={14} className="text-primary" />
                <span>{t("Wallet Expiry")}</span>
              </h3>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="font-bold text-text-main text-xs sm:text-sm">{t("Wallet balance expires after")}</span>
                <input
                  type="number"
                  value={walletExpiry}
                  onChange={(e) => setWalletExpiry(e.target.value)}
                  className="w-20 sm:w-24 px-2.5 py-1.5 sm:py-2 bg-background border border-border rounded-xl font-bold text-center text-xs sm:text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-text-main"
                />
                <span className="font-bold text-text-main text-xs sm:text-sm">{t("days of inactivity.")}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

};

export default LoyaltyProgram;