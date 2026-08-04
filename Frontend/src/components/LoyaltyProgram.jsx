import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { ArrowLeft, Wallet, Award, Gift, TrendingUp, Users } from 'lucide-react';

const LoyaltyProgram = ({ onNavigate }) => {const { t } = useLanguage();
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
        const configRes = await axios.get('http://localhost:5002/api/loyalty/config', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const config = configRes.data;
        if (config) {
          setEnabled(config.enabled ?? true);
          setConversionRate(config.conversionRate ?? '100');
          setRedemptionValue(config.redemptionValue ?? '1');
          setWalletExpiry(config.walletExpiry ?? '365');
        }

        // Fetch stats
        const statsRes = await axios.get('http://localhost:5002/api/loyalty/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
      await axios.post('http://localhost:5002/api/loyalty/config', {
        enabled,
        conversionRate: Number(conversionRate),
        redemptionValue: Number(redemptionValue),
        walletExpiry: Number(walletExpiry)
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('Loyalty & Wallet configuration saved successfully!');
    } catch (err) {
      console.error('Error saving loyalty configuration:', err);
      alert('Failed to save configuration.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Award className="text-primary" />{t("Loyalty & Wallet")}
            </h1>
            <p className="text-sm text-gray-500">{t("Reward your best customers with points and wallet balance")}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center cursor-pointer">
            <span className="mr-3 text-sm font-bold text-gray-700">{t("Enable Program")}</span>
            <div className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
              <input type="checkbox" className="sr-only" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </label>
          <button onClick={handleSave} className="bg-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-sm">{t("Save Rules")}

          </button>
        </div>
      </div>

      <div className={`flex-1 max-w-4xl mx-auto w-full transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><Users size={24} /></div>
            <div><div className="text-2xl font-black text-gray-800">{loading ? '...' : stats.activeMembers.toLocaleString()}</div><div className="text-sm font-bold text-gray-500">{t("Active Members")}</div></div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><Award size={24} /></div>
            <div><div className="text-2xl font-black text-gray-800">{loading ? '...' : stats.pointsDistributed.toLocaleString()}</div><div className="text-sm font-bold text-gray-500">{t("Points Distributed")}</div></div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Wallet size={24} /></div>
            <div><div className="text-2xl font-black text-gray-800">{loading ? '...' : `₹${stats.totalWalletBalance.toLocaleString()}`}</div><div className="text-sm font-bold text-gray-500">{t("Total Wallet Balance")}</div></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><TrendingUp className="text-primary" />{t("Point Conversion Rules")}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-bold text-gray-700 uppercase text-xs">{t("Earning Points")}</h3>
              <div className="flex items-center gap-4">
                <span className="font-bold text-gray-600">{t("For every ₹")}</span>
                <input type="number" value={conversionRate} onChange={(e) => setConversionRate(e.target.value)} className="w-24 px-3 py-2 border border-gray-300 rounded font-bold text-center focus:border-primary focus:outline-none" />
                <span className="font-bold text-gray-600">{t("spent, earn")}<strong className="text-primary text-xl">{t("1 Point")}</strong></span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-gray-700 uppercase text-xs">{t("Redeeming Points")}</h3>
              <div className="flex items-center gap-4">
                <span className="font-bold text-gray-600">{t("1 Point equals ₹")}</span>
                <input type="number" value={redemptionValue} onChange={(e) => setRedemptionValue(e.target.value)} className="w-24 px-3 py-2 border border-gray-300 rounded font-bold text-center focus:border-primary focus:outline-none" />
                <span className="font-bold text-gray-600">{t("in Wallet Balance")}</span>
              </div>
            </div>
            
            <div className="space-y-4 md:col-span-2 pt-6 border-t border-gray-100">
              <h3 className="font-bold text-gray-700 uppercase text-xs flex items-center gap-2"><Gift size={16} />{t("Wallet Expiry")}</h3>
              <div className="flex items-center gap-4">
                <span className="font-bold text-gray-600">{t("Wallet balance expires after")}</span>
                <input type="number" value={walletExpiry} onChange={(e) => setWalletExpiry(e.target.value)} className="w-24 px-3 py-2 border border-gray-300 rounded font-bold text-center focus:border-primary focus:outline-none" />
                <span className="font-bold text-gray-600">{t("days of inactivity.")}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>);

};

export default LoyaltyProgram;