import React, { useState, useEffect } from 'react';
import { Save, Building, Phone, MapPin, Mail, FileText, Settings as SettingsIcon, User, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import Toast from './Toast';
import { apiUpdateProfile } from '../api/auth';

const Settings = ({ user, setUser }) => {
  const [settings, setSettings] = useState({
    restaurantName: 'ABC RESTAURANT',
    restaurantType: 'South Indian & Chinese',
    address: 'Main Road, Hyderabad - 500001',
    phone: '9876543210',
    email: 'support@abcrestaurant.com',
    gstin: '36ABCDE1234F1Z5',
    upiId: 'maheshsiva864@oksbi',
    ownerPin: '786786',
    footerMessage: '*** THANK YOU! VISIT AGAIN ***',
    kotPrinter: '',
    billingPrinter: '',
    silentPrinting: true,
    enableQrPayment: true,
    enableCgst: true,
    cgstRate: 2.5,
    enableSgst: true,
    sgstRate: 2.5,
    enableGst: false,
    gstRate: 5,
    logo: ''
  });

  const [username, setUsername] = useState(user ? user.username : '');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [systemPrinters, setSystemPrinters] = useState([]);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      if (!parsed.upiId || parsed.upiId === 'msbillings@upi') parsed.upiId = 'maheshsiva864@oksbi';
      if (!parsed.ownerPin) parsed.ownerPin = '786786';
      setSettings(prev => ({ ...prev, ...parsed }));
    }

    // Load available printers if running in Desktop App
    if (window.electronAPI && window.electronAPI.getPrinters) {
      window.electronAPI.getPrinters().then(printers => {
        setSystemPrinters(printers || []);
      }).catch(err => console.error("Failed to load printers:", err));
    }
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save restaurant settings to localStorage
      localStorage.setItem('restaurantSettings', JSON.stringify(settings));
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
        const tenantDb = localStorage.getItem('resto_db_name') || '';
        const token = localStorage.getItem('accessToken') || '';
        await fetch(`${API_BASE_URL}/config/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-DB': tenantDb,
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ restaurantSettings: settings })
        });
      } catch (e) {}

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));

      // Save profile name
      if (username !== user?.username) {
        const response = await apiUpdateProfile(username);
        // Update global user state
        setUser(response.user);
        // Update localStorage user
        localStorage.setItem('user', JSON.stringify(response.user));
      }

      setToast({ message: 'Settings saved successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ message: 'Failed to save settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    if (field === 'ownerPin') {
      value = value.replace(/\D/g, '').slice(0, 6);
    }
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setToast({ message: 'Image size should be less than 2MB', type: 'error' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('logo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-secondary/10 rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
              <SettingsIcon className="text-primary" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-main">Restaurant Settings</h1>
              <p className="text-sm text-text-muted">Configure your restaurant information and preferences</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          <div className="flex flex-col gap-4">
            {/* Profile Information */}
            <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <User className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-bold text-text-main">Profile Information</h2>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <User size={14} />
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main"
                  placeholder="Enter username"
                />
              </div>
            </div>

            {/* Desktop Printers */}
            <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <FileText className="text-primary" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-main">Desktop Printers <span className="text-sm font-normal text-primary">(v1.4.5)</span></h2>
                    <p className="text-xs text-text-muted mt-0.5">Configure auto-printing</p>
                  </div>
                </div>
                {!window.electronAPI && (
                  <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">
                    WEB APP MODE
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                    Default KOT Printer
                  </label>
                  <select
                    value={settings.kotPrinter}
                    onChange={(e) => handleInputChange('kotPrinter', e.target.value)}
                    disabled={!window.electronAPI}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main disabled:opacity-50"
                  >
                    <option value="">-- Select Printer --</option>
                    {systemPrinters.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                    Default Billing Printer
                  </label>
                  <select
                    value={settings.billingPrinter}
                    onChange={(e) => handleInputChange('billingPrinter', e.target.value)}
                    disabled={!window.electronAPI}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main disabled:opacity-50"
                  >
                    <option value="">-- Select Printer --</option>
                    {systemPrinters.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border mt-4">
                  <div className="space-y-0.5">
                    <label className="text-sm font-semibold text-text-main">Silent Printing</label>
                    <p className="text-xs text-text-muted">Print directly without showing the print dialog</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={settings.silentPrinting !== false}
                      onChange={(e) => handleInputChange('silentPrinting', e.target.checked)}
                      disabled={!window.electronAPI}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                {!window.electronAPI && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    Silent printing is only available in the Desktop App. In the web version, a print dialog will always appear.
                  </p>
                )}
              </div>
            </div>

            {/* Restaurant Information */}
            <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-bold text-text-main">Restaurant Information</h2>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Restaurant Logo */}
              <div className="md:col-span-2 space-y-2 pb-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <ImageIcon size={14} />
                  Printed Bill Logo
                </label>
                <div className="flex flex-wrap items-center gap-4 bg-background p-3 rounded-xl border border-border">
                  {settings.logo ? (
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg border border-border shadow-sm">
                        <img src={settings.logo} alt="Restaurant Logo" className="h-14 max-w-[140px] object-contain" />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInputChange('logo', '')}
                        className="flex items-center gap-2 px-3 py-2 bg-error/10 hover:bg-error/20 text-error rounded-lg text-sm font-bold transition-all"
                      >
                        <Trash2 size={16} />
                        Remove Logo
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-bold cursor-pointer transition-all">
                      <Upload size={16} />
                      Upload Logo (PNG/JPG)
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                  <span className="text-xs text-text-muted">Displayed at top of printed bills (max 2MB)</span>
                </div>
              </div>

              {/* Restaurant Name */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <Building size={14} />
                  Restaurant Name
                </label>
                <input
                  type="text"
                  value={settings.restaurantName}
                  onChange={(e) => handleInputChange('restaurantName', e.target.value)}
                  onKeyPress={(e) => {
                    if (!/[a-zA-Z\s]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main"
                  placeholder="Enter restaurant name"
                />
              </div>

              {/* Restaurant Type */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />
                  Restaurant Type
                </label>
                <input
                  type="text"
                  value={settings.restaurantType}
                  onChange={(e) => handleInputChange('restaurantType', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main"
                  placeholder="e.g., South Indian & Chinese"
                />
              </div>

              {/* Address */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <MapPin size={14} />
                  Address
                </label>
                <textarea
                  value={settings.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main resize-none"
                  placeholder="Enter full address"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <Phone size={14} />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  onKeyPress={(e) => {
                    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main"
                  placeholder="Enter phone number"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <Mail size={14} />
                  Email
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onKeyPress={(e) => {
                    if (!/[a-zA-Z0-9@._-]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main"
                  placeholder="Enter email address"
                />
              </div>

              {/* GSTIN */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />
                  GSTIN
                </label>
                <input
                  type="text"
                  value={settings.gstin}
                  onChange={(e) => handleInputChange('gstin', e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main"
                  placeholder="Enter GSTIN"
                />
              </div>

              {/* Individual Tax Configuration */}
              <div className="space-y-3 p-4 bg-background rounded-xl border border-border">
                <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                  <FileText size={14} className="text-primary" />
                  Individual Tax Options (CGST, SGST, GST)
                </h3>
                <p className="text-xs text-text-muted">Toggle ON/OFF each tax option and set its default percentage rate.</p>

                {/* CGST Option */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.enableCgst !== false}
                        onChange={(e) => handleInputChange('enableCgst', e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-sm font-semibold text-text-main">Enable CGST</span>
                  </div>
                  {settings.enableCgst !== false && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={settings.cgstRate !== undefined ? settings.cgstRate : 2.5}
                        onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-center bg-surface"
                      />
                      <span className="text-xs font-bold text-text-muted">%</span>
                    </div>
                  )}
                </div>

                {/* SGST Option */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.enableSgst !== false}
                        onChange={(e) => handleInputChange('enableSgst', e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-sm font-semibold text-text-main">Enable SGST</span>
                  </div>
                  {settings.enableSgst !== false && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={settings.sgstRate !== undefined ? settings.sgstRate : 2.5}
                        onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-center bg-surface"
                      />
                      <span className="text-xs font-bold text-text-muted">%</span>
                    </div>
                  )}
                </div>

                {/* GST / IGST Option */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.enableGst === true}
                        onChange={(e) => handleInputChange('enableGst', e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-sm font-semibold text-text-main">Enable GST (or IGST)</span>
                  </div>
                  {settings.enableGst === true && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={settings.gstRate !== undefined ? settings.gstRate : 5}
                        onChange={(e) => handleInputChange('gstRate', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-border rounded-lg text-sm font-mono text-center bg-surface"
                      />
                      <span className="text-xs font-bold text-text-muted">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* UPI ID */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />
                  UPI Payment VPA / ID
                </label>
                <input
                  type="text"
                  value={settings.upiId || ''}
                  onChange={(e) => handleInputChange('upiId', e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main font-mono"
                  placeholder="e.g. restaurant@upi or 9876543210@ybl"
                />
              </div>

              {/* Dynamic QR Payment Toggle */}
              <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                <div className="space-y-0.5">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                    <FileText size={14} className="text-primary" />
                    Dynamic QR Code Payment
                  </label>
                  <p className="text-xs text-text-muted">Show dynamic scan-to-pay UPI QR code on checkout screen & printed bills</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.enableQrPayment !== false}
                    onChange={(e) => handleInputChange('enableQrPayment', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Owner Security PIN */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <User size={14} />
                  Owner Security PIN (Reports Lock)
                </label>
                <input
                  type="password"
                  value={settings.ownerPin || '786786'}
                  onChange={(e) => handleInputChange('ownerPin', e.target.value)}
                  maxLength={10}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main font-mono tracking-widest font-bold"
                  placeholder="••••••"
                />
              </div>

              {/* Footer Message */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <FileText size={14} />
                  Footer Message
                </label>
                <input
                  type="text"
                  value={settings.footerMessage}
                  onChange={(e) => handleInputChange('footerMessage', e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main"
                  placeholder="Enter footer message for receipts"
                />
              </div>
            </div>
          </div>
          </div>

          {/* Preview Section */}
          <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
            <h2 className="text-xl font-bold text-text-main mb-4">Receipt Preview</h2>
            <div className="bg-white border border-border rounded-xl p-4 max-w-xs mx-auto">
              {settings.logo && (
                <div className="flex justify-center mb-2">
                  <img src={settings.logo} alt="Logo Preview" className="max-h-14 max-w-[140px] object-contain" />
                </div>
              )}
              <div className="text-center font-bold text-lg mb-2">{settings.restaurantName}</div>
              <div className="text-center text-sm text-gray-600 mb-4">
                {settings.restaurantType}<br/>
                {settings.address.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                Ph: {settings.phone}<br/>
                GSTIN: {settings.gstin}
              </div>
              <div className="border-t border-b border-dashed py-2 my-4 text-center font-bold">
                RECEIPT
              </div>
              <div className="text-center text-sm mb-4">
                {settings.footerMessage}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-3 px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save size={20} />
            <span>{loading ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Settings;