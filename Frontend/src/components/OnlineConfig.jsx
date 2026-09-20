import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import {
  Globe,
  Save,
  Settings,
  Clock,
  MapPin,
  Store,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Copy,
  Sparkles,
  Smartphone,
  Percent,
  Phone,
  Radio,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';
import realtimeService from '../services/realtimeService';

const OnlineConfig = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [config, setConfig] = useState({
    isOnlineEnabled: false,
    domainName: '',
    minOrderValue: 0,
    deliveryRadiusKm: 5,
    prepTimeMinutes: 30,
    contactPhone: '',
    deliveryFee: 0,
    storeStatus: 'open'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restaurantName, setRestaurantName] = useState("Anand's Restaurant");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [configRes, infoRes] = await Promise.allSettled([
        api.get('/online-configs'),
        api.get('/config/info')
      ]);

      if (configRes.status === 'fulfilled' && configRes.value?.data) {
        setConfig(configRes.value.data);
      }

      if (infoRes.status === 'fulfilled' && infoRes.value?.data?.restaurantSettings) {
        const rSet = infoRes.value.data.restaurantSettings;
        if (rSet.restaurantName) setRestaurantName(rSet.restaurantName);
        if (!configRes.value?.data?.contactPhone && rSet.phone) {
          setConfig((prev) => ({ ...prev, contactPhone: rSet.phone }));
        }
      }
    } catch (error) {
      console.error('Error fetching online config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await api.put('/online-configs', config);
      if (res.data) setConfig(res.data);

      try {
        realtimeService.emit('onlineConfigUpdated', config);
      } catch (e) {
        // non-blocking
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (error) {
      console.error('Error saving online config:', error);
      alert('Failed to save online order settings. Please check your network.');
    } finally {
      setSaving(false);
    }
  };

  const storeUrl = config?.domainName
    ? (config.domainName.startsWith('http') ? config.domainName : `https://${config.domainName}`)
    : 'https://order.msbillings.com';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 sm:mb-3 gap-3 bg-surface p-2.5 sm:p-3 rounded-2xl border border-border shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-black text-text-main flex items-center gap-2">
              <Globe className="text-primary" size={22} />
              <span>{t("Online Order Configuration")}</span>
            </h1>
            <p className="text-xs text-text-muted">
              {t("Manage your direct zero-commission ordering website, delivery zones, and customer rules")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 animate-in fade-in">
              <CheckCircle2 size={15} />
              <span>{t("Settings Saved to Cloud!")}</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? t("Saving...") : t("Save Configuration")}</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Content (12-Column Responsive Layout) */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-muted">
          <Loader2 className="animate-spin text-primary mb-3" size={36} />
          <p className="text-sm font-medium">{t("Loading online storefront configuration...")}</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 flex-1 pb-6">
          
          {/* Left Column: Direct Store Controls & Rules (8 cols) */}
          <div className="lg:col-span-8 space-y-3 sm:space-y-4">
            
            {/* Store Activation Banner */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                  config?.isOnlineEnabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-surface-secondary text-text-muted'
                }`}>
                  <Globe size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-text-main">{t("Direct Website Store")}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      config?.isOnlineEnabled
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-surface-secondary text-text-muted'
                    }`}>
                      {config?.isOnlineEnabled ? t("Online & Live") : t("Disabled")}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("Your branded zero-commission ordering platform for direct customer deliveries")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto bg-background p-2 rounded-xl border border-border">
                <span className="text-xs font-bold text-text-main">{t("Enable Ordering")}</span>
                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    name="isOnlineEnabled"
                    className="sr-only"
                    checked={config?.isOnlineEnabled || false}
                    onChange={handleInputChange}
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    config?.isOnlineEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                      config?.isOnlineEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                </label>
              </div>
            </div>

            {/* General Storefront Settings */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                  <Settings size={18} className="text-primary" />
                  <span>{t("General Store Settings")}</span>
                </h3>
                <span className="text-[11px] text-text-muted">{t("Domain & Inquiries")}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-main mb-1.5">
                    {t("Your Website Domain / Subdomain")}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="domainName"
                      placeholder={t("e.g. order.myrestaurant.com")}
                      value={config?.domainName || ''}
                      onChange={handleInputChange}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-primary text-text-main"
                    />
                    <Globe size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">
                    {t("Custom domain or your direct msbillings ordering link")}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-main mb-1.5">
                    {t("Store Status & Availability")}
                  </label>
                  <select
                    name="storeStatus"
                    value={config?.storeStatus || 'open'}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:border-primary text-text-main"
                  >
                    <option value="open">🟢 {t("Accepting Orders (Open)")}</option>
                    <option value="busy">🟡 {t("Too Busy (Temporarily pause new orders)")}</option>
                    <option value="closed">🔴 {t("Closed for the day")}</option>
                  </select>
                  <p className="text-[10px] text-text-muted mt-1">
                    {t("Customers will see this real-time banner when browsing your menu")}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-text-main mb-1.5 flex items-center gap-1.5">
                    <Phone size={14} className="text-primary" />
                    <span>{t("Customer Inquiry & WhatsApp Support Number")}</span>
                  </label>
                  <input
                    type="tel"
                    name="contactPhone"
                    placeholder={t("e.g. 9876543210")}
                    value={config?.contactPhone || ''}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-primary text-text-main"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    {t("Displayed on digital receipts and in the order tracker for direct customer calls")}
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery & Ordering Rules */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                  <Store size={18} className="text-primary" />
                  <span>{t("Delivery & Ordering Rules")}</span>
                </h3>
                <span className="text-[11px] text-text-muted">{t("Radius & Minimums")}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Minimum Order Value */}
                <div className="p-3.5 rounded-xl bg-background border border-border">
                  <label className="block text-xs font-bold text-text-main mb-1">
                    {t("Minimum Order Value (₹)")}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                    <input
                      type="number"
                      name="minOrderValue"
                      min={0}
                      value={config?.minOrderValue ?? 0}
                      onChange={handleInputChange}
                      className="w-full pl-7 pr-3 py-2 bg-surface border border-border rounded-lg text-xs sm:text-sm font-bold font-mono text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">
                    {t("Orders below this threshold will not proceed to checkout")}
                  </p>
                </div>

                {/* Standard Delivery Fee */}
                <div className="p-3.5 rounded-xl bg-background border border-border">
                  <label className="block text-xs font-bold text-text-main mb-1">
                    {t("Standard Delivery Fee (₹)")}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                    <input
                      type="number"
                      name="deliveryFee"
                      min={0}
                      value={config?.deliveryFee ?? 0}
                      onChange={handleInputChange}
                      className="w-full pl-7 pr-3 py-2 bg-surface border border-border rounded-lg text-xs sm:text-sm font-bold font-mono text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">
                    {t("Flat rate added to customer bill for home delivery")}
                  </p>
                </div>

                {/* Delivery Radius */}
                <div className="p-3.5 rounded-xl bg-background border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary" />
                      <span>{t("Delivery Radius")}</span>
                    </label>
                    <span className="font-mono font-bold text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {config?.deliveryRadiusKm || 5} km
                    </span>
                  </div>
                  <input
                    type="range"
                    name="deliveryRadiusKm"
                    min={1}
                    max={25}
                    value={config?.deliveryRadiusKm || 5}
                    onChange={handleInputChange}
                    className="w-full accent-primary cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted mt-1">
                    <span>1 km</span>
                    <span>12 km</span>
                    <span>25 km max</span>
                  </div>
                </div>

                {/* Estimated Prep Time */}
                <div className="p-3.5 rounded-xl bg-background border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Clock size={14} className="text-primary" />
                      <span>{t("Est. Preparation Time")}</span>
                    </label>
                    <span className="font-mono font-bold text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {config?.prepTimeMinutes || 30} mins
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[15, 25, 35, 45].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, prepTimeMinutes: mins }))}
                        className={`py-1 rounded-lg text-xs font-bold transition-all ${
                          config?.prepTimeMinutes === mins
                            ? 'bg-primary text-white'
                            : 'bg-surface border border-border text-text-muted hover:border-primary'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-text-muted mt-1.5">
                    {t("Communicated to customer in order confirmation message")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Customer Storefront Simulator & Zero Commission ROI (4 cols) */}
          <div className="lg:col-span-4 space-y-3 sm:space-y-4">
            
            {/* Live Customer Storefront Simulator Card */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                  <Smartphone size={16} className="text-primary" />
                  <span>{t("Customer Storefront Preview")}</span>
                </h3>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                  {t("Mobile View")}
                </span>
              </div>

              {/* Mock Mobile Phone Shell */}
              <div className="border-2 border-border/80 rounded-2xl p-3 bg-background shadow-inner space-y-3">
                {/* Store Header Banner */}
                <div className="rounded-xl bg-linear-to-r from-primary to-orange-600 text-white p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">
                      {config?.isOnlineEnabled ? t("Direct Store") : t("Store Closed")}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      config?.storeStatus === 'open' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {config?.storeStatus === 'open' ? t("Open Now") : t("Closed")}
                    </span>
                  </div>
                  <div className="font-bold text-sm mt-1 truncate">{restaurantName}</div>
                  <div className="text-[10px] opacity-90 mt-0.5 flex items-center gap-2">
                    <span>⚡ {config?.prepTimeMinutes || 30} mins</span>
                    <span>•</span>
                    <span>📍 Max {config?.deliveryRadiusKm || 5} km</span>
                  </div>
                </div>

                {/* Delivery Fee & Min Order Chips */}
                <div className="flex items-center gap-2 text-[11px]">
                  <div className="flex-1 p-2 rounded-lg bg-surface border border-border text-center">
                    <span className="text-text-muted block text-[10px]">{t("Min Order")}</span>
                    <span className="font-bold text-text-main">₹{config?.minOrderValue || 0}</span>
                  </div>
                  <div className="flex-1 p-2 rounded-lg bg-surface border border-border text-center">
                    <span className="text-text-muted block text-[10px]">{t("Delivery")}</span>
                    <span className="font-bold text-text-main">
                      {config?.deliveryFee > 0 ? `₹${config.deliveryFee}` : t("FREE")}
                    </span>
                  </div>
                </div>

                {/* Mock Menu Item */}
                <div className="p-2.5 rounded-xl bg-surface border border-border flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-text-main">Butter Chicken / Paneer Special</div>
                    <div className="text-[10px] text-text-muted">Chef's recommendation</div>
                    <div className="text-xs font-bold text-primary mt-1">₹320</div>
                  </div>
                  <button type="button" className="px-3 py-1 bg-primary text-white text-[11px] font-bold rounded-lg shadow-2xs">
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Link & Share Card */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-5 space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <span>{t("Share Your Ordering Link")}</span>
              </h3>

              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between text-xs">
                <span className="font-mono text-text-muted truncate pr-2">{storeUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1.5 rounded-lg bg-surface border border-border hover:border-primary text-primary shrink-0 transition-colors cursor-pointer"
                  title="Copy link"
                >
                  {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-border bg-background hover:bg-surface-secondary text-text-main text-xs font-bold transition-colors"
                >
                  <ExternalLink size={14} />
                  <span>{t("Test Store")}</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
                >
                  <Copy size={14} />
                  <span>{copied ? t("Copied!") : t("Copy Link")}</span>
                </button>
              </div>
            </div>

            {/* Zero Commission ROI Card */}
            <div className="p-4 rounded-2xl bg-linear-to-br from-emerald-950/20 to-teal-950/30 border border-emerald-500/20 text-text-main space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <Percent size={16} />
                <span>{t("100% Commission-Free Ordering")}</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {t("By directing customers to order via your personal web link or WhatsApp, you save the 25% to 30% commission fees charged by third-party aggregators.")}
              </p>
              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                <span className="text-text-muted">{t("Savings per ₹10,000 orders:")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">₹2,800 saved</span>
              </div>
            </div>

          </div>

        </form>
      )}
    </div>
  );
};

export default OnlineConfig;