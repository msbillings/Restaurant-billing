import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import BackButton from './common/BackButton';
import { ArrowLeft, Save, MonitorSmartphone, LayoutGrid, List } from 'lucide-react';

const BillingScreenSettings = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [settings, setSettings] = useState({
    theme: 'light',
    layout: 'grid',
    showImages: true,
    compactMode: false,
    autoPrint: true
  });

  const handleSave = () => {
    alert('Billing screen layout preferences saved successfully!');
    onNavigate('operations');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-2.5 gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <MonitorSmartphone className="text-primary" size={20} />{t("Billing Screen Settings")}
            </h1>
            <p className="text-xs text-gray-500">{t("Customize the layout and behavior of the main POS screen")}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm self-end sm:self-auto">
          
          <Save size={16} />{t("Save Layout")}
        </button>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 overflow-y-auto">
        
        {/* Layout Mode */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-700 uppercase mb-4">{t("Menu Layout View")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSettings({ ...settings, layout: 'grid' })}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${settings.layout === 'grid' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              
              <LayoutGrid size={32} />
              <span className="font-bold">{t("Grid View")}</span>
            </button>
            <button
              onClick={() => setSettings({ ...settings, layout: 'list' })}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${settings.layout === 'list' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              
              <List size={32} />
              <span className="font-bold">{t("List View")}</span>
            </button>
          </div>
        </div>

        {/* Display Toggles */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-700 uppercase mb-4">{t("Display Preferences")}</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <div className="font-bold text-gray-800">{t("Show Item Images")}</div>
                <div className="text-xs text-gray-500">{t("Display thumbnails in the menu grid")}</div>
              </div>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.showImages ? 'bg-green-500' : 'bg-gray-300'}`}>
                <input type="checkbox" className="sr-only" checked={settings.showImages} onChange={(e) => setSettings({ ...settings, showImages: e.target.checked })} />
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showImages ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <div className="font-bold text-gray-800">{t("Compact Mode")}</div>
                <div className="text-xs text-gray-500">{t("Reduce padding to fit more items on screen")}</div>
              </div>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.compactMode ? 'bg-green-500' : 'bg-gray-300'}`}>
                <input type="checkbox" className="sr-only" checked={settings.compactMode} onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })} />
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.compactMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
            
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <div className="font-bold text-gray-800">{t("Auto-Print KOT")}</div>
                <div className="text-xs text-gray-500">{t("Automatically print to kitchen when saving bill")}</div>
              </div>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoPrint ? 'bg-green-500' : 'bg-gray-300'}`}>
                <input type="checkbox" className="sr-only" checked={settings.autoPrint} onChange={(e) => setSettings({ ...settings, autoPrint: e.target.checked })} />
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.autoPrint ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>
        </div>

      </div>
    </div>);

};

export default BillingScreenSettings;