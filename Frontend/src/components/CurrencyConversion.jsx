import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import BackButton from './common/BackButton';
import { ArrowLeft, Save, CircleDollarSign, RefreshCw, Check, Search } from 'lucide-react';

const CurrencyConversion = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [baseCurrency, setBaseCurrency] = useState(localStorage.getItem('primaryCurrency') || 'INR');
  const defaultCurrencies = [
    { code: 'USD', name: 'US Dollar', rate: 0.012, enabled: true },
    { code: 'EUR', name: 'Euro', rate: 0.011, enabled: true },
    { code: 'GBP', name: 'British Pound', rate: 0.0094, enabled: false },
    { code: 'AED', name: 'UAE Dirham', rate: 0.044, enabled: true },
    { code: 'AUD', name: 'Australian Dollar', rate: 0.018, enabled: false },
    { code: 'CAD', name: 'Canadian Dollar', rate: 0.016, enabled: false },
    { code: 'SGD', name: 'Singapore Dollar', rate: 0.016, enabled: false },
    { code: 'CHF', name: 'Swiss Franc', rate: 0.011, enabled: false },
    { code: 'JPY', name: 'Japanese Yen', rate: 1.8, enabled: false },
    { code: 'CNY', name: 'Chinese Yuan', rate: 0.086, enabled: false },
    { code: 'NZD', name: 'New Zealand Dollar', rate: 0.020, enabled: false },
    { code: 'ZAR', name: 'South African Rand', rate: 0.23, enabled: false },
    { code: 'SAR', name: 'Saudi Riyal', rate: 0.045, enabled: false },
    { code: 'QAR', name: 'Qatari Riyal', rate: 0.043, enabled: false },
    { code: 'OMR', name: 'Omani Rial', rate: 0.0046, enabled: false },
    { code: 'KWD', name: 'Kuwaiti Dinar', rate: 0.0037, enabled: false },
    { code: 'BHD', name: 'Bahraini Dinar', rate: 0.0045, enabled: false }
  ];

  const [exchangeRates, setExchangeRates] = useState(() => {
    const saved = localStorage.getItem('secondaryCurrencies');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return defaultCurrencies.map(dc => {
          const found = parsed.find(p => p.code === dc.code);
          return found ? { ...dc, rate: found.rate, enabled: found.enabled } : dc;
        });
      } catch (e) {
        return defaultCurrencies;
      }
    }
    return defaultCurrencies;
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggle = (code) => {
    setExchangeRates((rates) => rates.map((rate) =>
    rate.code === code ? { ...rate, enabled: !rate.enabled } : rate
    ));
  };

  const handleUpdateRates = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
      const data = await response.json();
      if (data && data.rates) {
        setExchangeRates((rates) => rates.map((rate) => ({
          ...rate,
          rate: data.rates[rate.code] || rate.rate
        })));
      }
    } catch (error) {
      console.error("Failed to fetch live rates", error);
      alert("Failed to fetch live rates. Please check your connection.");
    }
    setIsUpdating(false);
  };

  const handleSave = () => {
    localStorage.setItem('primaryCurrency', baseCurrency);
    localStorage.setItem('secondaryCurrencies', JSON.stringify(exchangeRates));
    alert('Currency settings saved! Enabled currencies will now appear on the printed bills and checkout screens.');
    onNavigate('operations');
  };

  const getBaseRate = () => {
    if (baseCurrency === 'INR') return 1.0;
    const found = exchangeRates.find((r) => r.code === baseCurrency);
    return found ? found.rate : 1.0;
  };

  const baseRate = getBaseRate();

  return (
    <div className="h-full flex flex-col bg-gray-50 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-2.5 gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <CircleDollarSign className="text-primary" size={20} />{t("Currency Conversion")}
            </h1>
            <p className="text-xs text-gray-500">{t("Configure secondary currencies for tourist billing")}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm self-end sm:self-auto">
          
          <Save size={16} />{t("Save Settings")}
        </button>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto pb-8 pr-2">
        
        {/* Base Currency Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <h2 className="text-sm font-bold text-gray-700 uppercase mb-4">{t("Base POS Currency")}</h2>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <label className="block text-xs font-bold text-gray-500 mb-1">{t("Primary Currency")}</label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-800 font-bold focus:outline-none focus:border-primary">
              
              <option value="INR">{t("INR - Indian Rupee (₹)")}</option>
              <option value="USD">{t("USD - US Dollar ($)")}</option>
            </select>
            <p className="text-xs text-gray-500 mt-3">{t("All your menu items are priced in this base currency.")}</p>
          </div>
        </div>

        {/* Exchange Rates Panel */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-fit">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-gray-700 uppercase">{t("Supported Currencies")}</h2>
            <button
              onClick={handleUpdateRates}
              disabled={isUpdating}
              className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-dark transition-colors disabled:opacity-50">
              
              <RefreshCw size={16} className={isUpdating ? "animate-spin" : ""} />
              {isUpdating ? 'Fetching Live Rates...' : 'Update Live Rates'}
            </button>
          </div>

          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={t("Search currencies...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="p-3 text-xs font-bold text-gray-500 uppercase">{t("Currency")}</th>
                  <th className="p-3 text-xs font-bold text-gray-500 uppercase text-right">{t("Live Rate")}</th>
                  <th className="p-3 text-xs font-bold text-gray-500 uppercase text-center">{t("Enable on Bill")}</th>
                </tr>
              </thead>
              <tbody>
                {exchangeRates
                  .filter(r => 
                    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    r.code.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((rate, index, filteredArray) =>
                <tr key={rate.code} className={index !== filteredArray.length - 1 ? 'border-b border-gray-100' : ''}>
                    <td className="p-3">
                      <div className="font-bold text-gray-800">{rate.code}</div>
                      <div className="text-xs text-gray-500">{rate.name}</div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-bold text-gray-700 font-mono">
                        1 {rate.code} = {(baseRate / rate.rate).toFixed(2)} {baseCurrency}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                      onClick={() => handleToggle(rate.code)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      rate.enabled ? 'bg-green-500' : 'bg-gray-300'}`
                      }>
                      
                        <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        rate.enabled ? 'translate-x-6' : 'translate-x-1'}`
                        } />
                      
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex gap-2 items-start bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
            <Check size={20} className="shrink-0 mt-0.5" />
            <p>{t("Enabled currencies will be automatically printed at the bottom of the customer's receipt using the live exchange rate.")}</p>
          </div>
        </div>

      </div>
    </div>);

};

export default CurrencyConversion;