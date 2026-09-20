import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import {
  MonitorSmartphone,
  LayoutGrid,
  List,
  Save,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  Printer,
  Sparkles,
  Layers,
  Zap,
  Sliders
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';
import realtimeService from '../services/realtimeService';

const BillingScreenSettings = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [settings, setSettings] = useState({
    theme: 'light',
    layout: 'grid', // 'grid' | 'list'
    showImages: true,
    compactMode: false,
    autoPrint: true,
    showCategoryBar: true,
    fastCashBar: true
  });

  // Load from backend config / localStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const res = await api.get('/config/info');
        const cloudSettings = res.data?.restaurantSettings?.billingScreenSettings;

        if (cloudSettings) {
          setSettings((prev) => ({
            ...prev,
            ...cloudSettings
          }));
        } else {
          // Fallback to localStorage
          const localImages = localStorage.getItem('menuGrid_showImages');
          const localLayout = localStorage.getItem('menuGrid_layout');
          const localCompact = localStorage.getItem('menuGrid_compact');
          const localAutoPrint = localStorage.getItem('resto_auto_print_kot');

          setSettings((prev) => ({
            ...prev,
            showImages: localImages !== null ? JSON.parse(localImages) : prev.showImages,
            layout: localLayout || prev.layout,
            compactMode: localCompact !== null ? JSON.parse(localCompact) : prev.compactMode,
            autoPrint: localAutoPrint !== null ? JSON.parse(localAutoPrint) : prev.autoPrint
          }));
        }
      } catch (err) {
        console.warn('Could not load billing screen settings from cloud, using local settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      // 1. Persist to MongoDB backend
      await api.post('/config/info', {
        restaurantSettings: {
          billingScreenSettings: settings
        }
      });

      // 2. Sync to localStorage for instant local reactivity
      localStorage.setItem('menuGrid_showImages', JSON.stringify(settings.showImages));
      localStorage.setItem('menuGrid_layout', settings.layout);
      localStorage.setItem('menuGrid_compact', JSON.stringify(settings.compactMode));
      localStorage.setItem('resto_auto_print_kot', JSON.stringify(settings.autoPrint));

      // 3. Emit real-time update
      try {
        realtimeService.emit('settingsUpdated', { billingScreenSettings: settings });
      } catch (e) {
        // Socket emit is non-blocking
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save billing screen layout:', err);
      alert('Failed to save layout settings to server. Please check connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 sm:mb-3 gap-3 bg-surface p-2.5 sm:p-3 rounded-2xl border border-border shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-black text-text-main flex items-center gap-2">
              <MonitorSmartphone className="text-primary" size={22} />
              <span>{t("Billing Screen Settings")}</span>
            </h1>
            <p className="text-xs text-text-muted">
              {t("Customize the layout, item cards, and automatic behaviors of the main POS screen")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 animate-in fade-in">
              <CheckCircle2 size={15} />
              <span>{t("Saved to Cloud!")}</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? t("Saving...") : t("Save Layout")}</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Content Container */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-text-muted">
          <Loader2 className="animate-spin text-primary mb-3" size={32} />
          <p className="text-sm font-medium">{t("Loading POS screen preferences...")}</p>
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 flex-1 pb-6">
          {/* Left Column: Layout Modes & Live Visual Preview (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Layout Mode Selection Card */}
            <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-xs border border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
                    <LayoutGrid size={18} className="text-primary" />
                    <span>{t("Menu Layout View")}</span>
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("Choose how menu items are organized on the cashier billing screen")}
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-md uppercase">
                  {settings.layout === 'grid' ? t("Grid Mode Active") : t("List Mode Active")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, layout: 'grid' }))}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2.5 transition-all text-center ${
                    settings.layout === 'grid'
                      ? 'border-primary bg-primary/5 text-primary shadow-xs ring-2 ring-primary/20'
                      : 'border-border text-text-muted hover:border-text-muted/40 hover:bg-surface-secondary/40'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${settings.layout === 'grid' ? 'bg-primary text-white' : 'bg-surface-secondary text-text-muted'}`}>
                    <LayoutGrid size={28} />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-text-main">{t("Grid View")}</span>
                    <span className="text-[11px] text-text-muted">{t("Visual cards with food images")}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, layout: 'list' }))}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2.5 transition-all text-center ${
                    settings.layout === 'list'
                      ? 'border-primary bg-primary/5 text-primary shadow-xs ring-2 ring-primary/20'
                      : 'border-border text-text-muted hover:border-text-muted/40 hover:bg-surface-secondary/40'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${settings.layout === 'list' ? 'bg-primary text-white' : 'bg-surface-secondary text-text-muted'}`}>
                    <List size={28} />
                  </div>
                  <div>
                    <span className="font-bold text-sm block text-text-main">{t("List View")}</span>
                    <span className="text-[11px] text-text-muted">{t("Compact rows for maximum speed")}</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Live Interactive Preview Box */}
            <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-xs border border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  <span>{t("Live POS Screen Preview")}</span>
                </h3>
                <span className="text-[11px] text-text-muted">{t("Instant simulator")}</span>
              </div>

              <div className="p-3 sm:p-4 bg-background rounded-xl border border-border">
                {/* Mock Category Bar */}
                {settings.showCategoryBar && (
                  <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 border-b border-border/60">
                    <span className="text-[10px] font-bold px-2.5 py-1 bg-primary text-white rounded-lg">All</span>
                    <span className="text-[10px] font-medium px-2.5 py-1 bg-surface border border-border rounded-lg text-text-muted">Starters</span>
                    <span className="text-[10px] font-medium px-2.5 py-1 bg-surface border border-border rounded-lg text-text-muted">Main Course</span>
                    <span className="text-[10px] font-medium px-2.5 py-1 bg-surface border border-border rounded-lg text-text-muted">Beverages</span>
                  </div>
                )}

                {/* Mock Items Container */}
                {settings.layout === 'grid' ? (
                  <div className={`grid grid-cols-2 sm:grid-cols-3 ${settings.compactMode ? 'gap-2' : 'gap-3'}`}>
                    {[
                      { name: 'Paneer Butter Masala', price: '₹280', cat: 'Main' },
                      { name: 'Chicken Biryani', price: '₹340', cat: 'Biryani' },
                      { name: 'Garlic Naan', price: '₹60', cat: 'Breads' }
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`bg-surface border border-border rounded-xl flex flex-col overflow-hidden transition-all shadow-2xs ${
                          settings.compactMode ? 'p-1.5' : 'p-2.5'
                        }`}
                      >
                        {settings.showImages && (
                          <div className={`w-full bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-1.5 ${settings.compactMode ? 'h-14' : 'h-20'}`}>
                            <ImageIcon size={settings.compactMode ? 20 : 28} className="opacity-70" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-text-main truncate">{item.name}</div>
                          <div className="text-[10px] text-text-muted">{item.cat}</div>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="font-bold text-xs text-primary">{item.price}</span>
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">+</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`space-y-1.5`}>
                    {[
                      { name: 'Paneer Butter Masala', price: '₹280', cat: 'Main' },
                      { name: 'Chicken Biryani', price: '₹340', cat: 'Biryani' },
                      { name: 'Garlic Naan', price: '₹60', cat: 'Breads' }
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`bg-surface border border-border rounded-xl flex items-center justify-between px-3 py-2 shadow-2xs ${
                          settings.compactMode ? 'py-1.5' : 'py-2.5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {settings.showImages && (
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <ImageIcon size={16} />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-xs text-text-main">{item.name}</div>
                            <div className="text-[10px] text-text-muted">{item.cat}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-xs text-primary">{item.price}</span>
                          <button type="button" className="text-[10px] bg-primary text-white px-2 py-1 rounded font-bold">Add</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Display & POS Automation Toggles (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-surface p-4 sm:p-6 rounded-2xl shadow-xs border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
                  <Sliders size={18} className="text-primary" />
                  <span>{t("Display & POS Behaviors")}</span>
                </h2>
                <span className="text-xs text-text-muted">{t("Terminal Prefs")}</span>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {/* Show Item Images */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-surface-secondary/40 cursor-pointer transition-all">
                  <div className="pr-3">
                    <div className="font-bold text-xs sm:text-sm text-text-main flex items-center gap-2">
                      <ImageIcon size={16} className="text-blue-500" />
                      <span>{t("Show Item Images")}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {t("Display appetizing dish thumbnails in the menu cards")}
                    </div>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                      settings.showImages ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={settings.showImages}
                      onChange={(e) => setSettings((s) => ({ ...s, showImages: e.target.checked }))}
                    />
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                        settings.showImages ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </label>

                {/* Compact Mode */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-surface-secondary/40 cursor-pointer transition-all">
                  <div className="pr-3">
                    <div className="font-bold text-xs sm:text-sm text-text-main flex items-center gap-2">
                      <Layers size={16} className="text-purple-500" />
                      <span>{t("Compact Density Mode")}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {t("Reduces grid padding to fit 30% more menu items on screen")}
                    </div>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                      settings.compactMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={settings.compactMode}
                      onChange={(e) => setSettings((s) => ({ ...s, compactMode: e.target.checked }))}
                    />
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                        settings.compactMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </label>

                {/* Auto-Print KOT */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-surface-secondary/40 cursor-pointer transition-all">
                  <div className="pr-3">
                    <div className="font-bold text-xs sm:text-sm text-text-main flex items-center gap-2">
                      <Printer size={16} className="text-green-500" />
                      <span>{t("Auto-Print KOT on Order")}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {t("Automatically trigger kitchen tickets when saving a new order")}
                    </div>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                      settings.autoPrint ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={settings.autoPrint}
                      onChange={(e) => setSettings((s) => ({ ...s, autoPrint: e.target.checked }))}
                    />
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                        settings.autoPrint ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </label>

                {/* Show Category Bar */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-surface-secondary/40 cursor-pointer transition-all">
                  <div className="pr-3">
                    <div className="font-bold text-xs sm:text-sm text-text-main flex items-center gap-2">
                      <Zap size={16} className="text-amber-500" />
                      <span>{t("Fast Category Scroll Bar")}</span>
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {t("Show horizontal quick tabs for switching food categories")}
                    </div>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                      settings.showCategoryBar ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={settings.showCategoryBar}
                      onChange={(e) => setSettings((s) => ({ ...s, showCategoryBar: e.target.checked }))}
                    />
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                        settings.showCategoryBar ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                </label>
              </div>

              {/* Status Note */}
              <div className="mt-5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  {t("Settings saved here are stored in your restaurant's cloud database and synchronized in real-time across all billing counters.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingScreenSettings;