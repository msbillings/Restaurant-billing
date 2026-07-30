import React, { useState } from 'react';
import { ArrowLeft, Save, CircleDollarSign, RefreshCw, Check } from 'lucide-react';

const CurrencyConversion = ({ onNavigate }) => {
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [exchangeRates, setExchangeRates] = useState([
    { code: 'USD', name: 'US Dollar', rate: 0.012, enabled: true },
    { code: 'EUR', name: 'Euro', rate: 0.011, enabled: true },
    { code: 'GBP', name: 'British Pound', rate: 0.0094, enabled: false },
    { code: 'AED', name: 'UAE Dirham', rate: 0.044, enabled: true },
    { code: 'AUD', name: 'Australian Dollar', rate: 0.018, enabled: false },
  ]);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = (code) => {
    setExchangeRates(rates => rates.map(rate => 
      rate.code === code ? { ...rate, enabled: !rate.enabled } : rate
    ));
  };

  const handleUpdateRates = () => {
    setIsUpdating(true);
    // Simulate API call to fetch live rates
    setTimeout(() => {
      setExchangeRates(rates => rates.map(rate => ({
        ...rate,
        rate: rate.rate + (Math.random() * 0.001 - 0.0005) // Slight fluctuation
      })));
      setIsUpdating(false);
    }, 1500);
  };

  const handleSave = () => {
    alert('Currency settings saved! Enabled currencies will now appear on the printed bills and checkout screens.');
    onNavigate('operations');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <CircleDollarSign className="text-primary" /> Currency Conversion
            </h1>
            <p className="text-sm text-gray-500">Configure secondary currencies for tourist billing</p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-sm"
        >
          <Save size={18} /> Save Settings
        </button>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Base Currency Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <h2 className="text-sm font-bold text-gray-700 uppercase mb-4">Base POS Currency</h2>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <label className="block text-xs font-bold text-gray-500 mb-1">Primary Currency</label>
            <select 
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-800 font-bold focus:outline-none focus:border-primary"
            >
              <option value="INR">INR - Indian Rupee (₹)</option>
              <option value="USD">USD - US Dollar ($)</option>
            </select>
            <p className="text-xs text-gray-500 mt-3">All your menu items are priced in this base currency.</p>
          </div>
        </div>

        {/* Exchange Rates Panel */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-fit max-h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-gray-700 uppercase">Supported Currencies</h2>
            <button 
              onClick={handleUpdateRates}
              disabled={isUpdating}
              className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-dark transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isUpdating ? "animate-spin" : ""} />
              {isUpdating ? 'Fetching Live Rates...' : 'Update Live Rates'}
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="p-3 text-xs font-bold text-gray-500 uppercase">Currency</th>
                  <th className="p-3 text-xs font-bold text-gray-500 uppercase text-right">Live Rate</th>
                  <th className="p-3 text-xs font-bold text-gray-500 uppercase text-center">Enable on Bill</th>
                </tr>
              </thead>
              <tbody>
                {exchangeRates.map((rate, index) => (
                  <tr key={rate.code} className={index !== exchangeRates.length - 1 ? 'border-b border-gray-100' : ''}>
                    <td className="p-3">
                      <div className="font-bold text-gray-800">{rate.code}</div>
                      <div className="text-xs text-gray-500">{rate.name}</div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-bold text-gray-700 font-mono">
                        1 {baseCurrency} = {rate.rate.toFixed(4)} {rate.code}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggle(rate.code)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          rate.enabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            rate.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex gap-2 items-start bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
            <Check size={20} className="shrink-0 mt-0.5" />
            <p>Enabled currencies will be automatically printed at the bottom of the customer's receipt using the live exchange rate.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CurrencyConversion;
