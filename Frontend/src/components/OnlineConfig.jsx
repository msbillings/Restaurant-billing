import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { ArrowLeft, Globe, Save, Settings, Clock, MapPin, DollarSign, Store } from 'lucide-react';

const OnlineConfig = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/online-configs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setConfig(response.data);
    } catch (error) {
      console.error('Error fetching online config', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig({
      ...config,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${getApiUrl()}/online-configs`, config, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('Online order settings saved successfully!');
    } catch (error) {
      console.error('Error saving online config', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 p-3 sm:p-6 overflow-y-auto custom-scrollbar w-full">
      <div className="flex items-center justify-between mb-4 sm:mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{t("Online Order Configuration")}</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">{t("Manage settings for your direct ordering website")}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">{t("Direct Website Store")}</h2>
              <p className="text-xs sm:text-sm text-slate-500">{t("Your personal zero-commission ordering platform")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto pt-2 sm:pt-0">
            <span className="text-xs sm:text-sm font-bold text-slate-700">{t("Enable Ordering")}</span>
            <label className="relative inline-flex items-center cursor-pointer touch-target">
              <input
                type="checkbox"
                name="isOnlineEnabled"
                className="sr-only peer"
                checked={config?.isOnlineEnabled || false}
                onChange={handleInputChange} />
              
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-6 sm:space-y-8">
          
          {/* General Settings */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings size={16} className="text-slate-400" />
              <span>{t("General Settings")}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t("Your Website Domain")}</label>
                <input
                  type="text"
                  name="domainName"
                  placeholder={t("e.g. order.myrestaurant.com")}
                  value={config?.domainName || ''}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t("Store Status")}</label>
                <select
                  name="storeStatus"
                  value={config?.storeStatus || 'open'}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                  <option value="open">{t("Accepting Orders (Open)")}</option>
                  <option value="busy">{t("Too Busy (Pause temporarily)")}</option>
                  <option value="closed">{t("Closed for the day")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">{t("Contact Phone Number")}</label>
                <input
                  type="text"
                  name="contactPhone"
                  placeholder={t("For customer inquiries")}
                  value={config?.contactPhone || ''}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Delivery & Ordering Rules */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Store size={16} className="text-slate-400" />
              <span>{t("Delivery & Ordering Rules")}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <DollarSign size={14} className="text-slate-400" />
                  <span>{t("Minimum Order Value (₹)")}</span>
                </label>
                <input
                  type="number"
                  name="minOrderValue"
                  value={config?.minOrderValue || 0}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <DollarSign size={14} className="text-slate-400" />
                  <span>{t("Standard Delivery Fee (₹)")}</span>
                </label>
                <input
                  type="number"
                  name="deliveryFee"
                  value={config?.deliveryFee || 0}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <MapPin size={14} className="text-slate-400" />
                  <span>{t("Delivery Radius (km)")}</span>
                </label>
                <input
                  type="number"
                  name="deliveryRadiusKm"
                  value={config?.deliveryRadiusKm || 5}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Clock size={14} className="text-slate-400" />
                  <span>{t("Est. Preparation Time (mins)")}</span>
                </label>
                <input
                  type="number"
                  name="prepTimeMinutes"
                  value={config?.prepTimeMinutes || 30}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-70 shadow-md touch-target text-xs sm:text-sm">
              {saving ?
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>{t("Saving...")}</span></> :
                <><Save size={18} /><span>{t("Save Configuration")}</span></>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );

};

export default OnlineConfig;