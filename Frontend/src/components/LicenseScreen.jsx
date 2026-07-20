import React, { useState } from 'react';
import { Shield, Key, Loader2, ServerCrash, User, Eye, EyeOff, Sparkles } from 'lucide-react';
import BackgroundSlideshow from './BackgroundSlideshow';
import logoImg from '../assets/images/logo.png';

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
      const SUPERADMIN_API_URL = import.meta.env.VITE_SUPERADMIN_API_URL || 'https://restaurant-superadmin-api-maheer.vercel.app';
      const response = await fetch(`${SUPERADMIN_API_URL}/api/clients/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
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
                password: data.plainTextPassword,
                staffAccounts: data.staffAccounts
              })
            });
            
            if (!setupResponse.ok) throw new Error('Database setup failed on backend');
          } catch (setupErr) {
            console.error('Failed to configure local database:', setupErr);
            setError('Failed to setup local database. Please try again or contact support.');
            setLoading(false);
            return; 
          }
        }

        localStorage.setItem('resto_license', data.licenseKey || 'ACCOUNT-LOGIN');
        localStorage.setItem('resto_license_expiry', data.validUntil);
        if (data.databaseName) localStorage.setItem('resto_db_name', data.databaseName);
        
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
    <BackgroundSlideshow formPosition="left">
      <div className="w-full max-w-md relative z-10 animate-fade-in mx-auto">
        
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-6 shadow-2xl rounded-full relative">
            <img src={logoImg} alt="MS Billing Logo" className="w-full h-full object-cover rounded-full shadow-[0_0_20px_rgba(255,100,0,0.4)] border-2 border-orange-500/50 z-10 relative" />
            <Sparkles className="absolute -top-1 -right-1 text-yellow-400 animate-pulse z-20" size={20} />
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight drop-shadow-lg">
            msbillings
          </h1>
          <p className="text-gray-300 font-bold uppercase tracking-widest text-sm">
            Software Activation
          </p>
        </div>

        {/* Activation Form (Premium Glassmorphism) */}
        <div className="bg-white/10 backdrop-blur-xl p-8 border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative overflow-hidden w-full" style={{ borderRadius: '24px' }}>
          
          <div className="relative z-10">
            <p className="text-center text-gray-300 mb-8 font-medium">
              Please enter your registered Email and Password to activate your terminal.
            </p>

            <form onSubmit={handleActivate} className="space-y-6">
              <div>
                <label className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-2">
                  <User size={16} />
                  Email Address
                </label>
                <div className="relative">
                  <User size={20} className="absolute left-4 top-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="restaurant@example.com"
                    className="w-full py-4 px-4 pl-12 border border-white/20 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:border-white focus:bg-white/10 transition-all duration-300"
                    style={{ borderRadius: '16px' }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-2">
                  <Key size={16} />
                  Password
                </label>
                <div className="relative">
                  <Key size={20} className="absolute left-4 top-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full py-4 px-4 pl-12 pr-12 border border-white/20 bg-white/5 text-white placeholder:text-gray-400 focus:outline-none focus:border-white focus:bg-white/10 transition-all duration-300"
                    style={{ borderRadius: '16px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-red-100 p-4 text-sm font-bold flex items-start gap-3 animate-shake" style={{ borderRadius: '16px' }}>
                  <ServerCrash size={20} className="shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full py-4 px-6 font-black text-white bg-orange-500 hover:bg-orange-600 transition-all duration-300 shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ borderRadius: '16px' }}
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
            </form>

            <div className="relative flex py-6 items-center">
              <div className="flex-grow border-t border-white/20"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Or try it out</span>
              <div className="flex-grow border-t border-white/20"></div>
            </div>

            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full py-4 px-6 font-bold text-white border-2 border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2"
              style={{ borderRadius: '16px' }}
            >
              🚀 Quick Demo Mode (No License Required)
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-fade-in { animation: fade-in 0.6s ease-out; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </BackgroundSlideshow>
  );
};

export default LicenseScreen;
