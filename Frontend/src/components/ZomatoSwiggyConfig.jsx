import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import { useLanguage } from '../context/LanguageContext';
import { Store, Save, Zap } from 'lucide-react';
import api from '../api/axios';
import { getApiUrl } from '../config.js';

const ZomatoSwiggyConfig = ({ onGoBack }) => {
  const { t } = useLanguage();
  const [zomatoId, setZomatoId] = useState('');
  const [swiggyId, setSwiggyId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get(`${getApiUrl()}/aggregators/settings`);
        if (res.data) {
          setZomatoId(res.data.zomatoId || '');
          setSwiggyId(res.data.swiggyId || '');
        }
      } catch (err) {
        console.error('Failed to load aggregator settings', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post(`${getApiUrl()}/aggregators/settings`, { zomatoId, swiggyId });
      
      alert(t('Integration settings saved successfully'));
      setIsSaving(false);
    } catch (err) {
      alert(t('Failed to save settings'));
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-gray-100 p-4 sm:p-8 pb-24 overflow-y-auto w-full">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <BackButton onClick={onGoBack} />
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-200 text-primary">
                <Store size={22} />
              </div>
              {t("Aggregator Integration")}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{t("Connect your online delivery platforms to automatically sync orders")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Zomato Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(239,68,68,0.1)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-100 to-transparent opacity-50 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-red-500/30 group-hover:-translate-y-1 transition-transform duration-300">
                  Z
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-xl tracking-tight">Zomato</h3>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Order Sync</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                  Store / Restaurant ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1928374"
                  value={zomatoId}
                  onChange={(e) => setZomatoId(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50/50 text-gray-900 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-400 focus:bg-white outline-none font-semibold transition-all placeholder:font-normal placeholder:text-gray-400"
                />
                <p className="text-[11px] text-gray-500 ml-1">Ask your account manager for your specific ID.</p>
              </div>
            </div>
          </div>

          {/* Swiggy Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(249,115,22,0.1)] transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-100 to-transparent opacity-50 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-orange-500/30 group-hover:-translate-y-1 transition-transform duration-300">
                  S
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-xl tracking-tight">Swiggy</h3>
                  <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Order Sync</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                  Store / Restaurant ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 84729"
                  value={swiggyId}
                  onChange={(e) => setSwiggyId(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50/50 text-gray-900 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-400 focus:bg-white outline-none font-semibold transition-all placeholder:font-normal placeholder:text-gray-400"
                />
                <p className="text-[11px] text-gray-500 ml-1">Ask your account manager for your specific ID.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Webhook Info */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden mb-8">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
          <div className="flex items-start gap-5">
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
              <Zap size={24} className="animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">Webhook Setup Instructions</h4>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                To complete the integration, please share the following Webhook URLs with your onboarding team:
              </p>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-1.5 group hover:border-blue-200 transition-colors">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Zomato Webhook URL</span>
                  <code className="text-[13px] font-mono text-gray-800 font-semibold truncate select-all bg-white p-2.5 rounded-xl border border-gray-200 group-hover:border-blue-300 transition-colors">
                    https://api.msbillings.com/api/webhooks/zomato
                  </code>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-1.5 group hover:border-blue-200 transition-colors">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Swiggy Webhook URL</span>
                  <code className="text-[13px] font-mono text-gray-800 font-semibold truncate select-all bg-white p-2.5 rounded-xl border border-gray-200 group-hover:border-blue-300 transition-colors">
                    https://api.msbillings.com/api/webhooks/swiggy
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200/60 pt-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="group flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-900 hover:bg-black text-white rounded-2xl text-sm font-bold shadow-xl shadow-gray-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 min-w-[200px]"
          >
            <Save size={18} className="group-hover:scale-110 transition-transform duration-300" />
            {isSaving ? t('Saving...') : t('Save Configurations')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ZomatoSwiggyConfig;
