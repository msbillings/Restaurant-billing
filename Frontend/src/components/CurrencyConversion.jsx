import React, { useState, useEffect, useMemo } from 'react';
import BackButton from './common/BackButton';
import {
  CircleDollarSign,
  RefreshCw,
  Save,
  CheckCircle2,
  Search,
  Calculator,
  ArrowRightLeft,
  Loader2,
  Globe2,
  TrendingUp,
  Coins
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/axios';
import realtimeService from '../services/realtimeService';

const DEFAULT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 0.012, enabled: true },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.011, enabled: true },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.0094, enabled: false },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 0.044, enabled: true },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rate: 0.018, enabled: false },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', rate: 0.016, enabled: false },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rate: 0.016, enabled: false },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', rate: 0.011, enabled: false },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 1.8, enabled: false },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 0.086, enabled: false },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', rate: 0.020, enabled: false },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', rate: 0.23, enabled: false },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', rate: 0.045, enabled: false },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼', rate: 0.043, enabled: false },
  { code: 'OMR', name: 'Omani Rial', symbol: '﷼', rate: 0.0046, enabled: false },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', rate: 0.0037, enabled: false },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', rate: 0.0045, enabled: false }
];

const CurrencyConversion = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [calcAmount, setCalcAmount] = useState(1000);

  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [exchangeRates, setExchangeRates] = useState(DEFAULT_CURRENCIES);

  // Load from backend MongoDB & localStorage on mount
  useEffect(() => {
    const loadCurrencyConfig = async () => {
      try {
        setLoading(true);
        const res = await api.get('/config/info');
        const rSettings = res.data?.restaurantSettings || {};

        if (rSettings.primaryCurrency) {
          setBaseCurrency(rSettings.primaryCurrency);
        } else {
          const localBase = localStorage.getItem('primaryCurrency');
          if (localBase) setBaseCurrency(localBase);
        }

        if (rSettings.secondaryCurrencies && Array.isArray(rSettings.secondaryCurrencies)) {
          setExchangeRates(rSettings.secondaryCurrencies);
        } else {
          const localSecondary = localStorage.getItem('secondaryCurrencies');
          if (localSecondary) {
            try {
              const parsed = JSON.parse(localSecondary);
              setExchangeRates(
                DEFAULT_CURRENCIES.map((dc) => {
                  const found = parsed.find((p) => p.code === dc.code);
                  return found ? { ...dc, rate: found.rate, enabled: found.enabled } : dc;
                })
              );
            } catch (e) {
              setExchangeRates(DEFAULT_CURRENCIES);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load currency config from server, using local defaults:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCurrencyConfig();
  }, []);

  const handleToggle = (code) => {
    setExchangeRates((prev) =>
      prev.map((item) => (item.code === code ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const handleUpdateRates = async () => {
    setIsUpdatingRates(true);
    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
      const data = await response.json();
      if (data && data.rates) {
        setExchangeRates((rates) =>
          rates.map((rate) => ({
            ...rate,
            rate: data.rates[rate.code] || rate.rate
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch live rates:', error);
      alert('Could not connect to live currency exchange service. Please check your internet connection.');
    } finally {
      setIsUpdatingRates(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      // 1. Save to MongoDB backend
      await api.post('/config/info', {
        restaurantSettings: {
          primaryCurrency: baseCurrency,
          secondaryCurrencies: exchangeRates
        }
      });

      // 2. Sync to localStorage for instant local bill printing
      localStorage.setItem('primaryCurrency', baseCurrency);
      localStorage.setItem('secondaryCurrencies', JSON.stringify(exchangeRates));

      // 3. Emit real-time event to terminals
      try {
        realtimeService.emit('settingsUpdated', {
          primaryCurrency: baseCurrency,
          secondaryCurrencies: exchangeRates
        });
      } catch (e) {
        // non-blocking
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save currency configuration:', err);
      alert('Failed to save currency settings to server.');
    } finally {
      setSaving(false);
    }
  };

  const getBaseRate = () => {
    if (baseCurrency === 'INR') return 1.0;
    const found = exchangeRates.find((r) => r.code === baseCurrency);
    return found ? found.rate : 1.0;
  };

  const baseRate = getBaseRate();

  const filteredRates = useMemo(() => {
    if (!searchQuery.trim()) return exchangeRates;
    const q = searchQuery.toLowerCase();
    return exchangeRates.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [exchangeRates, searchQuery]);

  const enabledCurrencies = useMemo(() => {
    return exchangeRates.filter((r) => r.enabled);
  }, [exchangeRates]);

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 sm:mb-3 gap-3 bg-surface p-2.5 sm:p-3 rounded-2xl border border-border shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-black text-text-main flex items-center gap-2">
              <CircleDollarSign className="text-primary" size={22} />
              <span>{t("Currency Conversion")}</span>
            </h1>
            <p className="text-xs text-text-muted">
              {t("Configure base and secondary foreign currencies for international tourist billing and receipts")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 animate-in fade-in">
              <CheckCircle2 size={15} />
              <span>{t("Saved & Synced to POS!")}</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? t("Saving...") : t("Save Settings")}</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Content (12-Column Responsive Layout) */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-text-muted">
          <Loader2 className="animate-spin text-primary mb-3" size={32} />
          <p className="text-sm font-medium">{t("Loading currency configuration...")}</p>
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 flex-1 pb-6">
          
          {/* Left Column: Base Currency Selection & Live Converter (4 cols) */}
          <div className="lg:col-span-4 space-y-3 sm:space-y-4">
            
            {/* Base Currency Card */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-5">
              <h2 className="text-xs sm:text-sm font-bold text-text-main uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                <Coins size={16} className="text-primary" />
                <span>{t("Base POS Currency")}</span>
              </h2>

              <div className="p-3.5 rounded-xl bg-background border border-border space-y-2.5">
                <label className="block text-xs font-bold text-text-main">{t("Primary POS Currency")}</label>
                <select
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-text-main font-bold focus:outline-none focus:border-primary text-xs sm:text-sm"
                >
                  <option value="INR">{t("INR - Indian Rupee (₹)")}</option>
                  <option value="USD">{t("USD - US Dollar ($)")}</option>
                  <option value="EUR">{t("EUR - Euro (€)")}</option>
                  <option value="AED">{t("AED - UAE Dirham (د.إ)")}</option>
                  <option value="GBP">{t("GBP - British Pound (£)")}</option>
                </select>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {t("All menu items, billing reports, and tax calculations are anchored to this base currency.")}
                </p>
              </div>
            </div>

            {/* Interactive Live Converter Simulator */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                  <Calculator size={16} className="text-amber-500" />
                  <span>{t("Live Conversion Preview")}</span>
                </h3>
                <span className="text-[11px] text-text-muted">{t("Cashier tool")}</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1">
                    {t("Enter Sample Amount in")} {baseCurrency}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-bold text-text-main focus:outline-none focus:border-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                      {baseCurrency}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-background border border-border space-y-2">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    {t("Enabled Currencies Equivalent:")}
                  </div>
                  {enabledCurrencies.length === 0 ? (
                    <div className="text-xs text-text-muted italic py-1">
                      {t("No secondary currencies enabled yet.")}
                    </div>
                  ) : (
                    enabledCurrencies.slice(0, 5).map((cur) => {
                      const converted = (calcAmount * cur.rate).toFixed(2);
                      return (
                        <div key={cur.code} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                          <span className="font-medium text-text-muted flex items-center gap-1">
                            <span className="font-bold text-text-main">{cur.code}</span>
                            <span>({cur.name})</span>
                          </span>
                          <span className="font-bold font-mono text-primary text-xs sm:text-sm">
                            {cur.symbol} {converted}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Print Note */}
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5">
              <Globe2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                {t("Enabled secondary currencies will automatically display below the subtotal on printed thermal receipts, giving foreign customers instant visibility in their home currency.")}
              </p>
            </div>
          </div>

          {/* Right Column: Supported Currencies Table (8 cols) */}
          <div className="lg:col-span-8">
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-6 h-full flex flex-col">
              {/* Header with Search and Update Live Rates button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
                    <TrendingUp size={18} className="text-primary" />
                    <span>{t("Supported International Currencies")}</span>
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("Toggle currencies on or off to include them on bills and receipt prints")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUpdateRates}
                    disabled={isUpdatingRates}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-surface-secondary text-primary font-bold text-xs transition-all shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    <RefreshCw size={14} className={isUpdatingRates ? "animate-spin" : ""} />
                    <span>{isUpdatingRates ? t("Fetching Rates...") : t("Update Live Rates")}</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
                <input
                  type="text"
                  placeholder={t("Search by currency name or code (e.g. USD, Euro, Dirham)...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              {/* Currencies Full-Width Table */}
              <div className="rounded-xl border border-border overflow-hidden flex-1 bg-background/40 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary/60 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      <th className="p-3 sm:px-4 sm:py-3">{t("Currency")}</th>
                      <th className="p-3 sm:px-4 sm:py-3 text-right">{t("Exchange Rate")}</th>
                      <th className="p-3 sm:px-4 sm:py-3 text-center">{t("Enable on Bill")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {filteredRates.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-text-muted">
                          {t("No currencies match your search query.")}
                        </td>
                      </tr>
                    ) : (
                      filteredRates.map((rate) => (
                        <tr key={rate.code} className="hover:bg-surface-secondary/40 transition-colors">
                          <td className="p-3 sm:px-4 sm:py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-text-main font-mono">{rate.code}</span>
                              <span className="text-text-muted text-[11px]">({rate.name})</span>
                            </div>
                          </td>
                          <td className="p-3 sm:px-4 sm:py-3 text-right">
                            <div className="font-mono font-bold text-text-main text-xs sm:text-sm">
                              1 {rate.code} = {(baseRate / rate.rate).toFixed(2)} {baseCurrency}
                            </div>
                            <div className="text-[10px] text-text-muted">
                              1 {baseCurrency} = {rate.rate.toFixed(4)} {rate.code}
                            </div>
                          </td>
                          <td className="p-3 sm:px-4 sm:py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggle(rate.code)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer ${
                                rate.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                                  rate.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default CurrencyConversion;