import React, { useState } from 'react';
import { Shield, Key, Loader2, ServerCrash, User, Eye, EyeOff } from 'lucide-react';

const LicenseScreen = ({ onValidLicense }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const SUPERADMIN_API_URL = import.meta.env.VITE_SUPERADMIN_API_URL || 'http://localhost:4000';
      const response = await fetch(`${SUPERADMIN_API_URL}/api/clients/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // Login Successful!
        // Setup local database configuration
        if (data.databaseName && data.plainTextPassword) {
          try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
            const setupResponse = await fetch(`${API_BASE_URL}/config/setup`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Tenant-DB': data.databaseName
              },
              body: JSON.stringify({
                databaseName: data.databaseName,
                username: data.restaurantName,
                password: data.plainTextPassword
              })
            });
            
            if (!setupResponse.ok) {
              throw new Error('Database setup failed on backend');
            }
          } catch (setupErr) {
            console.error('Failed to configure local database:', setupErr);
            setError('Failed to setup local database. Please try again or contact support.');
            setLoading(false);
            return; // STOP! Don't save login!
          }
        }

        // We save the license key locally so old code still works, but activation was via email/password!
        localStorage.setItem('resto_license', data.licenseKey || 'ACCOUNT-LOGIN');
        localStorage.setItem('resto_license_expiry', data.validUntil);
        if (data.databaseName) {
          localStorage.setItem('resto_db_name', data.databaseName);
        }
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
          await fetch(`${API_BASE_URL}/config/info`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-DB': data.databaseName || localStorage.getItem('resto_db_name') || ''
            },
            body: JSON.stringify({ licenseExpiry: data.validUntil })
          });
        } catch (e) {}
        onValidLicense();
      } else {
        setError(data.message || 'Invalid email or password.');
      }
    } catch (err) {
      setError(`Connection Error: ${err.message}. Please check your internet connection or contact support.`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    localStorage.setItem('resto_license', 'MSBILL-DEMO-TEAM-2026');
    localStorage.setItem('resto_license_expiry', '2126-12-31T23:59:59.000Z');
    localStorage.setItem('resto_db_name', 'client_demo_db');
    onValidLicense();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Header Header */}
        <div className="bg-primary p-8 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="relative z-10 flex justify-center mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-xl">
              <Shield size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-black relative z-10">msbilling</h1>
          <p className="text-primary-100 mt-2 font-medium relative z-10">Software Activation Required</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <p className="text-center text-text-muted mb-6 text-sm">
            Please enter your registered Email and Password to activate the POS terminal.
          </p>

          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-text-main mb-2 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-text-muted" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="restaurant@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-surface border-2 border-border rounded-xl text-lg font-bold text-text-main tracking-wider focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all placeholder:text-gray-300 placeholder:font-normal"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-text-main mb-2 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Key size={18} className="text-text-muted" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 bg-surface border-2 border-border rounded-xl text-lg font-bold text-text-main tracking-wider focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all placeholder:text-gray-300"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-muted hover:text-primary transition-colors focus:outline-none"
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
                <ServerCrash size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm font-bold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Verifying License...</span>
                </>
              ) : (
                <>
                  <Shield size={20} />
                  <span>Activate Software</span>
                </>
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-text-muted uppercase">Or for presentations</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-3.5 rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
            >
              <span className="text-lg">🚀</span>
              <span>Quick Demo Mode (No License Required)</span>
            </button>
          </form>
        </div>

        <div className="bg-surface p-4 text-center border-t border-border">
          <p className="text-xs text-text-muted font-medium">
            Need a license? Visit <a href="https://mstechhive.com" className="text-primary hover:underline font-bold">mstechhive.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LicenseScreen;
