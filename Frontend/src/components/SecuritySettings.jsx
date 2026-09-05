import React, { useState, useEffect } from 'react';
import { useLanguage } from "../context/LanguageContext";
import { Shield, Key, Save, Lock, LayoutDashboard, LineChart, Banknote, FileX, Plus, Trash2, Settings as SettingsIcon, Loader2, Eye, EyeOff } from 'lucide-react';
import BackButton from './common/BackButton';
import { getApiUrl } from '../config.js';

const AVAILABLE_FEATURES = [
  { id: 'dashboard', name: 'Dashboard Access', icon: LayoutDashboard, color: 'text-blue-500' },
  { id: 'analytics', name: 'Analytics Access', icon: LineChart, color: 'text-purple-500' },
  { id: 'daybook', name: 'Cash Flow (Daybook)', icon: Banknote, color: 'text-emerald-500' },
  { id: 'cancel-order', name: 'Order Cancellation', icon: FileX, color: 'text-red-500' },
  { id: 'edited-bills', name: 'Edited Bills', icon: FileX, color: 'text-orange-500' },
  { id: 'history', name: 'Bill History', icon: FileX, color: 'text-blue-500' },
  { id: 'kothistory', name: 'KOT History', icon: FileX, color: 'text-purple-500' },
  { id: 'menu', name: 'Menu Management', icon: SettingsIcon, color: 'text-gray-500' },
  { id: 'inventory', name: 'Inventory', icon: SettingsIcon, color: 'text-emerald-500' },
  { id: 'staff', name: 'Staff / Users', icon: SettingsIcon, color: 'text-blue-500' },
  { id: 'settings', name: 'System Settings', icon: SettingsIcon, color: 'text-gray-500' },
];

const SecuritySettings = ({ onGoBack }) => {
  const { t } = useLanguage();
  const [ownerPin, setOwnerPin] = useState('1234');
  const [showMasterPin, setShowMasterPin] = useState(true);
  const [showLockPins, setShowLockPins] = useState({});
  const [requireMasterPin, setRequireMasterPin] = useState(true);
  const [customLocks, setCustomLocks] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    const fetchSecurity = async () => {
      try {
        const API_BASE_URL = getApiUrl();
        const token = localStorage.getItem('accessToken');
        const dbName = localStorage.getItem('resto_db_name');
        
        const res = await fetch(`${API_BASE_URL}/config/security`, {
          headers: {
            'X-Tenant-DB': dbName || '',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setRequireMasterPin(data.requireMasterPin !== false);
          
          if (data.ownerPin !== undefined && data.ownerPin !== null && data.ownerPin !== '') {
            setOwnerPin(String(data.ownerPin));
          } else {
            setOwnerPin('1234');
          }

          if (data.customLocks && Object.keys(data.customLocks).length > 0) {
            setCustomLocks(data.customLocks);
          } else {
            // Provide defaults if empty
            const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            const initialLocks = {};
            if (s.requireDashboardPin) initialLocks['dashboard'] = { enabled: true, pin: '' };
            if (s.requireAnalyticsPin) initialLocks['analytics'] = { enabled: true, pin: '' };
            if (s.requireDaybookPin) initialLocks['daybook'] = { enabled: true, pin: '' };
            if (s.requireCancelPin !== false) initialLocks['cancel-order'] = { enabled: true, pin: '' };
            setCustomLocks(initialLocks);
          }
        }
      } catch (err) {
        console.error('Failed to fetch security settings:', err);
      }
    };
    fetchSecurity();
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const API_BASE_URL = getApiUrl();
      const token = localStorage.getItem('accessToken');
      const dbName = localStorage.getItem('resto_db_name');
      
      const response = await fetch(`${API_BASE_URL}/config/security`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-DB': dbName || '',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requireMasterPin, ownerPin, customLocks })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSaved(true);
        if (data.ownerPin !== undefined) {
          setOwnerPin(String(data.ownerPin));
        }
        if (data.customLocks) {
          setCustomLocks(data.customLocks);
        }
        setTimeout(() => setSaved(false), 2500);
      } else {
        console.error('Failed to save settings to server');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLock = (featureId) => {
    setCustomLocks(prev => ({
      ...prev,
      [featureId]: { enabled: true, pin: '' }
    }));
    setShowAddMenu(false);
  };

  const removeLock = (featureId) => {
    setCustomLocks(prev => {
      const next = { ...prev };
      delete next[featureId];
      return next;
    });
  };

  const updateLock = (featureId, field, value) => {
    setCustomLocks(prev => ({
      ...prev,
      [featureId]: { ...prev[featureId], [field]: value }
    }));
  };

  const toggleLockPinVisibility = (featureId) => {
    setShowLockPins(prev => ({
      ...prev,
      [featureId]: !prev[featureId]
    }));
  };

  const ToggleSwitch = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer ml-auto">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  );

  const availableToAdd = AVAILABLE_FEATURES.filter(f => !customLocks[f.id]);

  return (
    <div className="h-full flex flex-col bg-gray-50 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto">
      <div className="flex items-center gap-3 mb-2.5 sm:mb-3 shrink-0">
        <BackButton onClick={onGoBack} />
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Shield className="text-primary" /> {t("Security & Passwords")}</h2>
          <p className="text-sm text-gray-500">{t("Build your custom security vault by locking specific features")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Master PIN */}
        <div className={`bg-white rounded-2xl shadow-sm border p-6 relative overflow-hidden transition-colors ${requireMasterPin ? 'border-orange-200' : 'border-gray-200 opacity-70'}`}>
          {requireMasterPin && <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -z-0"></div>}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Shield size={20} className="text-orange-500" /> {t("Master Security Vault")}
              </label>
              <ToggleSwitch checked={requireMasterPin} onChange={setRequireMasterPin} />
            </div>
            
            {requireMasterPin && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-xs text-gray-500 mb-2">{t("This PIN protects this settings page and can unlock ANY module, even if they have their own PINs.")}</p>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showMasterPin ? "text" : "password"}
                    value={ownerPin}
                    maxLength={4}
                    onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full pl-11 pr-12 py-3 bg-orange-50/50 border border-orange-200 rounded-xl font-mono text-lg tracking-widest font-bold text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all"
                    placeholder="1234"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPin(!showMasterPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-orange-400 hover:text-orange-600 p-1 transition-colors"
                    title={showMasterPin ? t("Hide PIN") : t("Show PIN")}
                  >
                    {showMasterPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Module Specific PINs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
            <h3 className="font-bold text-gray-800">{t("Custom Feature Locks")}</h3>
            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">{Object.keys(customLocks).length} {t("Active")}</span>
          </div>
          
          {Object.keys(customLocks).length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Shield size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t("No specific features are locked yet.")}</p>
              <p className="text-xs mt-1">{t("Click 'Add Lock' to protect a feature.")}</p>
            </div>
          )}

          <div className="space-y-4">
            {Object.entries(customLocks).map(([featureId, lock]) => {
              const featureDef = AVAILABLE_FEATURES.find(f => f.id === featureId) || { name: featureId, icon: Lock, color: 'text-gray-500' };
              const Icon = featureDef.icon;
              const isRevealed = !!showLockPins[featureId];
              
              return (
                <div key={featureId} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3 relative group transition-all hover:border-primary/30">
                  <button 
                    onClick={() => removeLock(featureId)}
                    className="absolute top-3 right-4 text-gray-300 hover:text-red-500 transition-colors"
                    title={t("Remove lock")}
                  >
                    <Trash2 size={16} />
                  </button>
                  
                  <div className="flex items-center justify-between pr-8">
                    <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg bg-gray-50 ${featureDef.color.replace('text-', 'bg-').replace('-500', '-50')} border border-gray-100`}>
                        <Icon size={16} className={featureDef.color} />
                      </div>
                      {t(featureDef.name)}
                    </label>
                    <ToggleSwitch checked={lock.enabled} onChange={(v) => updateLock(featureId, 'enabled', v)} />
                  </div>
                  
                  {lock.enabled && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                          <Lock size={15} />
                        </div>
                        <input
                          type={isRevealed ? "text" : "password"}
                          value={lock.pin !== undefined ? lock.pin : ''}
                          maxLength={4}
                          onChange={(e) => updateLock(featureId, 'pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="w-full pl-10 pr-10 py-2.5 bg-gray-50/70 border border-gray-200 rounded-lg font-mono tracking-widest text-gray-800 font-semibold focus:outline-none focus:bg-white focus:border-primary transition-all text-sm"
                          placeholder={t("Custom 4-digit PIN (leave blank to use Master PIN)")}
                        />
                        <button
                          type="button"
                          onClick={() => toggleLockPinVisibility(featureId)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                          title={isRevealed ? t("Hide PIN") : t("Show PIN")}
                        >
                          {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 px-1">
                        {lock.pin ? t("Custom PIN active for this feature") : t("Using Master Security Vault PIN")}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 relative z-20">
            <button 
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all font-bold text-sm">
              <Plus size={18} /> {t("Add New Feature Lock")}
            </button>
            
            {showAddMenu && (
              <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-border shadow-2xl rounded-2xl overflow-hidden z-30 animate-in slide-in-from-bottom-2 fade-in duration-200">
                <div className="p-3 bg-gray-50 border-b border-gray-100 font-bold text-xs text-gray-500 uppercase tracking-wider">{t("Select Feature to Lock")}</div>
                <div className="max-h-64 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {availableToAdd.length === 0 ? (
                    <div className="col-span-full p-4 text-center text-sm text-gray-500">{t("All features are already locked!")}</div>
                  ) : (
                    availableToAdd.map(f => (
                      <button
                        key={f.id}
                        onClick={() => addLock(f.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 text-left transition-colors"
                      >
                        <div className={`p-2 rounded-lg bg-white border border-gray-100 shadow-sm ${f.color}`}>
                          <f.icon size={16} />
                        </div>
                        <span className="font-semibold text-gray-700 text-sm">{t(f.name)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 mt-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-lg ${saved ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/30'} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {saved ? t("Security Settings Saved Successfully!") : loading ? t("Saving...") : t("Save Security Settings")}
          </button>
        </div>
      </div>
      
      {/* Click outside overlay for add menu */}
      {showAddMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)}></div>
      )}
    </div>
  );
};

export default SecuritySettings;
