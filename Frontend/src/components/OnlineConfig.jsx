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
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t("Online Order Configuration")}</h1>
            <p className="text-sm text-gray-500">{t("Manage settings for your direct ordering website")}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">{t("Direct Website Store")}</h2>
              <p className="text-sm text-gray-500">{t("Your personal zero-commission ordering platform")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{t("Enable Ordering")}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="isOnlineEnabled"
                className="sr-only peer"
                checked={config?.isOnlineEnabled || false}
                onChange={handleInputChange} />
              
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-8">
          
          {/* General Settings */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2"><Settings size={16} />{t("General Settings")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Your Website Domain")}</label>
                <input
                  type="text"
                  name="domainName" placeholder={t("e.g. order.myrestaurant.com")}

                  value={config?.domainName || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Store Status")}</label>
                <select
                  name="storeStatus"
                  value={config?.storeStatus || 'open'}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                  
                  <option value="open">{t("Accepting Orders (Open)")}</option>
                  <option value="busy">{t("Too Busy (Pause temporarily)")}</option>
                  <option value="closed">{t("Closed for the day")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Contact Phone Number")}</label>
                <input
                  type="text"
                  name="contactPhone" placeholder={t("For customer inquiries")}

                  value={config?.contactPhone || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Delivery & Ordering Rules */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2"><Store size={16} />{t("Delivery & Ordering Rules")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><DollarSign size={14} />{t("Minimum Order Value (₹)")}</label>
                <input
                  type="number"
                  name="minOrderValue"
                  value={config?.minOrderValue || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><DollarSign size={14} />{t("Standard Delivery Fee (₹)")}</label>
                <input
                  type="number"
                  name="deliveryFee"
                  value={config?.deliveryFee || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={14} />{t("Delivery Radius (km)")}</label>
                <input
                  type="number"
                  name="deliveryRadiusKm"
                  value={config?.deliveryRadiusKm || 5}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Clock size={14} />{t("Est. Preparation Time (mins)")}</label>
                <input
                  type="number"
                  name="prepTimeMinutes"
                  value={config?.prepTimeMinutes || 30}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-70 shadow-sm">
              
              {saving ?
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>{t("Saving...")}</> :

              <><Save size={18} />{t("Save Configuration")}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>);

};

export default OnlineConfig;