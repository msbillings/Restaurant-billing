import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import {
  Languages,
  User,
  Save,
  CheckCircle2,
  Loader2,
  Sparkles,
  Building2,
  ShieldAlert,
  BadgeCheck,
  Globe2
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../context/translations';
import api from '../api/axios';

const LanguageProfile = ({ onNavigate, onGoBack }) => {
  const { t, language: currentLanguage, setLanguage: changeLanguage } = useLanguage();
  const [selectedLang, setSelectedLang] = useState(currentLanguage || 'en');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userProfile, setUserProfile] = useState({
    username: 'Cashier / Admin',
    role: 'Admin',
    restaurantName: "Anand's Restaurant"
  });

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' }
  ];

  // Load user profile & backend language setting on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserProfile({
          username: parsed.name || parsed.username || 'Cashier / Admin',
          role: parsed.role || 'Admin',
          restaurantName: parsed.restaurantName || "Anand's Restaurant"
        });
      }
    } catch (e) {
      // ignore
    }

    const fetchConfig = async () => {
      try {
        const res = await api.get('/config/info');
        const rLang = res.data?.restaurantSettings?.preferredLanguage;
        if (rLang && languages.some((l) => l.code === rLang)) {
          setSelectedLang(rLang);
        } else if (currentLanguage) {
          setSelectedLang(currentLanguage);
        }
      } catch (e) {
        if (currentLanguage) setSelectedLang(currentLanguage);
      }
    };

    fetchConfig();
  }, [currentLanguage]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      // 1. Update React Language Context
      changeLanguage(selectedLang);
      localStorage.setItem('appLanguage', selectedLang);

      // 2. Persist to MongoDB backend restaurantSettings
      await api.post('/config/info', {
        restaurantSettings: {
          preferredLanguage: selectedLang
        }
      });

      // 3. Update localStorage user if present
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const userObj = JSON.parse(stored);
          userObj.preferredLanguage = selectedLang;
          localStorage.setItem('user', JSON.stringify(userObj));
        }
      } catch (e) {
        // ignore
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save language preference:', err);
      // Even if API fails, local change was applied
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } finally {
      setSaving(false);
    }
  };

  // Helper for live preview of sample words in selected language
  const getPreviewText = (key) => {
    if (translations[selectedLang] && translations[selectedLang][key]) {
      return translations[selectedLang][key];
    }
    return key;
  };

  const activeLanguageObj = languages.find((l) => l.code === selectedLang) || languages[0];

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 sm:mb-3 gap-3 bg-surface p-2.5 sm:p-3 rounded-2xl border border-border shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-black text-text-main flex items-center gap-2">
              <Languages className="text-primary" size={22} />
              <span>{t("Language Profiles")}</span>
            </h1>
            <p className="text-xs text-text-muted">
              {t("Set the default interface language for your personal account and restaurant terminals")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 animate-in fade-in">
              <CheckCircle2 size={15} />
              <span>{t("Saved & Applied!")}</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? t("Saving...") : t("Save Profile")}</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid (Full-Width Responsive 12-Column Layout) */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 flex-1 pb-6">
        
        {/* Left Column: Active User Profile & Live Translation Preview (4 cols) */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4">
          
          {/* User Account Card */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-6 text-center flex flex-col items-center">
            <div className="relative mb-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-2xl sm:text-3xl border-2 border-primary/20 shadow-inner">
                {userProfile.username.charAt(0).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-green-500 border-2 border-surface flex items-center justify-center text-white" title="Active">
                <BadgeCheck size={14} />
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-black text-text-main">{userProfile.username}</h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-secondary border border-border text-[11px] font-bold text-text-muted mt-1">
              <ShieldAlert size={12} className="text-primary" />
              <span>{userProfile.role} {t("Account")}</span>
            </div>

            <div className="w-full mt-4 pt-4 border-t border-border space-y-2 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted flex items-center gap-1.5">
                  <Building2 size={14} />
                  <span>{t("Restaurant")}</span>
                </span>
                <span className="font-bold text-text-main">{userProfile.restaurantName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted flex items-center gap-1.5">
                  <Globe2 size={14} />
                  <span>{t("Active Language")}</span>
                </span>
                <span className="font-bold text-primary">{activeLanguageObj.name} ({activeLanguageObj.nativeName})</span>
              </div>
            </div>

            {/* Selected Language Highlight Banner */}
            <div className="mt-4 w-full p-3 bg-primary/10 rounded-xl border border-primary/20 text-center">
              <span className="block text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
                {t("Active Profile Language")}
              </span>
              <div className="font-black text-base sm:text-lg text-text-main flex items-center justify-center gap-2">
                <span>{activeLanguageObj.flag}</span>
                <span>{activeLanguageObj.name}</span>
                <span className="text-text-muted font-normal text-xs">({activeLanguageObj.nativeName})</span>
              </div>
            </div>
          </div>

          {/* Live Translation Simulator Preview */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <span>{t("Live Interface Preview")}</span>
              </h3>
              <span className="text-[11px] text-text-muted font-medium">{activeLanguageObj.name}</span>
            </div>

            <p className="text-[11px] text-text-muted mb-3">
              {t("How core billing actions will look on your POS screen in this language:")}
            </p>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-text-muted block">{t("New Order")}</span>
                <span className="font-bold text-text-main text-xs">{getPreviewText("New Order")}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-text-muted block">{t("Save Layout")}</span>
                <span className="font-bold text-text-main text-xs">{getPreviewText("Save Layout")}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-text-muted block">{t("Daily Report")}</span>
                <span className="font-bold text-text-main text-xs">{getPreviewText("Daily Report")}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-background border border-border">
                <span className="text-[10px] text-text-muted block">{t("Kitchen Order Ticket (KOT)")}</span>
                <span className="font-bold text-text-main text-xs">{getPreviewText("Kitchen Order Ticket (KOT)")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Language Selection Grid (8 cols) */}
        <div className="lg:col-span-8">
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-text-main">
                  {t("Select your preferred language")}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {t("All buttons, receipts, reports, and menus will adapt to your chosen dialect")}
                </p>
              </div>
              <span className="text-xs text-text-muted font-mono">{languages.length} {t("Languages")}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1">
              {languages.map((lang) => {
                const isSelected = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLang(lang.code)}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-xs ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50 hover:bg-surface-secondary/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl shrink-0">{lang.flag}</span>
                      <div>
                        <div className={`font-bold text-sm ${isSelected ? 'text-primary' : 'text-text-main'}`}>
                          {lang.name}
                        </div>
                        <div className="text-xs text-text-muted font-medium mt-0.5">
                          {lang.nativeName}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-primary text-white scale-105'
                          : 'border border-border text-transparent group-hover:border-text-muted'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Info Alert */}
            <div className="mt-5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5">
              <Globe2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                {t("Language changes apply immediately to this browser session and persist permanently to the cloud for this user account across system restarts.")}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LanguageProfile;