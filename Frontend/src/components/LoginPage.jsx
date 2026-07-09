import React, { useState } from 'react';
import { LogIn, User, Lock, UtensilsCrossed, Eye, EyeOff, Sparkles, RefreshCw } from 'lucide-react';
import { loginUser } from '../api/auth';

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await loginUser({ username, password });
      onLoginSuccess(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-x-hidden overflow-y-auto bg-white">
      {/* Left Side - Premium Restaurant Image */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')`
          }}
        >
          {/* Subtle Dark Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60"></div>

          {/* Content Overlay */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center p-12 text-white">
            {/* Logo */}
            <div className="text-center mb-12 animate-fade-in">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl mb-8 shadow-2xl border border-white/30 relative">
                <UtensilsCrossed size={48} className="text-white z-10 relative drop-shadow-lg" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-3xl"></div>
                <Sparkles className="absolute -top-2 -right-2 text-yellow-300 animate-pulse" size={20} />
              </div>
              <h1 className="text-5xl font-bold mb-4 tracking-tight drop-shadow-2xl text-white">
                msbillings
              </h1>
              <p className="text-xl font-semibold mb-2 text-white drop-shadow-2xl bg-black/30 backdrop-blur-md px-5 py-2.5 rounded-xl inline-block border border-white/10">
                Premium Restaurant Management
              </p>
              <p className="text-lg text-white drop-shadow-xl bg-black/30 backdrop-blur-md px-5 py-2.5 rounded-xl inline-block mt-2 border border-white/10">
                Experience the future of dining
              </p>
            </div>

            {/* Features List */}
            <div className="w-full max-w-md space-y-4 mt-8">
              <div className="flex items-center gap-4 bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg hover:bg-white/20 transition-all">
                <div className="w-12 h-12 bg-white/25 rounded-xl flex items-center justify-center shadow-md">
                  <UtensilsCrossed size={24} className="text-white drop-shadow-md" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white drop-shadow-md">Smart Ordering</h3>
                  <p className="text-white/80 text-sm drop-shadow-sm">Streamlined order management</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg hover:bg-white/20 transition-all">
                <div className="w-12 h-12 bg-white/25 rounded-xl flex items-center justify-center shadow-md">
                  <Sparkles size={24} className="text-white drop-shadow-md" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white drop-shadow-md">Real-time Analytics</h3>
                  <p className="text-white/80 text-sm drop-shadow-sm">Track your business performance</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-white/15 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg hover:bg-white/20 transition-all">
                <div className="w-12 h-12 bg-white/25 rounded-xl flex items-center justify-center shadow-md">
                  <UtensilsCrossed size={24} className="text-white drop-shadow-md" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white drop-shadow-md">Easy Billing</h3>
                  <p className="text-white/80 text-sm drop-shadow-sm">Quick and accurate invoicing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 lg:w-[30%] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-white relative overflow-y-auto min-h-screen lg:min-h-0 py-10">
        {/* Creative Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Subtle geometric pattern */}
          <div className="absolute top-0 right-0 w-full h-full opacity-5">
            <div className="absolute top-20 right-10 w-64 h-64 border-2 border-primary/20 rounded-full"></div>
            <div className="absolute top-40 right-20 w-48 h-48 border-2 border-accent/20 rounded-full"></div>
            <div className="absolute bottom-20 right-10 w-56 h-56 border-2 border-secondary/20 rounded-full"></div>
          </div>
          
          {/* Gradient accents */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tr from-accent/5 via-transparent to-transparent rounded-full blur-3xl"></div>
          
          {/* Decorative lines */}
          <div className="absolute top-1/4 right-0 w-px h-1/2 bg-gradient-to-b from-transparent via-primary/10 to-transparent"></div>
          <div className="absolute top-1/2 right-10 w-32 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"></div>
        </div>

        {/* Login Form Container */}
        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 rounded-2xl mb-6 shadow-2xl shadow-blue-500/50 relative">
              <UtensilsCrossed size={36} className="text-white z-10 relative" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
              <Sparkles className="absolute -top-1 -right-1 text-yellow-400 animate-pulse" size={16} />
            </div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent mb-2 tracking-tight">
              msbillings
            </h1>
            <p className="text-text-muted text-lg font-semibold">
              Premium Restaurant Management
            </p>
          </div>

           {/* Login Card */}
           <div className="bg-white p-6 lg:p-8 border border-gray-100 shadow-2xl relative overflow-hidden w-full" style={{ 
             borderRadius: '24px',
             boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)'
           }}>
             {/* Decorative top border */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-secondary" style={{ borderRadius: '24px 24px 0 0' }}></div>
             
             {/* Subtle inner glow */}
             <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-primary/5" style={{ borderRadius: '24px' }}></div>
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-text-main mb-2">
                  Welcome Back
                </h2>
                <p className="text-text-muted">
                  Sign in to continue to your dashboard
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Username Field */}
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-semibold text-text-main flex items-center gap-2">
                    <User size={14} />
                    Username
                  </label>
                  <div className="relative group">
                    <div className={`absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity blur-sm`} style={{ borderRadius: '16px' }}></div>
                    <div className={`relative flex items-center transition-all ${focusedField === 'username' ? 'scale-[1.02]' : ''}`}>
                      <User size={20} className={`absolute left-4 transition-colors ${focusedField === 'username' ? 'text-primary' : 'text-text-muted'}`} />
                       <input
                         type="text"
                         id="username"
                         placeholder="Enter your username"
                         value={username}
                         onChange={(e) => setUsername(e.target.value)}
                         onFocus={() => setFocusedField('username')}
                         onBlur={() => setFocusedField(null)}
                         required
                         className="w-full py-3.5 px-4 pl-12 pr-4 border-2 border-gray-200 bg-gray-50 text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary focus:bg-white focus:shadow-md focus:shadow-primary/5 transition-all duration-300 focus:ring-2 focus:ring-primary/10"
                         style={{ borderRadius: '16px' }}
                       />
                    </div>
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-semibold text-text-main flex items-center gap-2">
                    <Lock size={14} />
                    Password
                  </label>
                  <div className="relative group">
                    <div className={`absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity blur-sm`} style={{ borderRadius: '16px' }}></div>
                    <div className={`relative flex items-center transition-all ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                      <Lock size={20} className={`absolute left-4 transition-colors ${focusedField === 'password' ? 'text-primary' : 'text-text-muted'}`} />
                       <input
                         type={showPassword ? "text" : "password"}
                         id="password"
                         placeholder="Enter your password"
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         onFocus={() => setFocusedField('password')}
                         onBlur={() => setFocusedField(null)}
                         required
                         className="w-full py-3.5 px-4 pl-12 pr-12 border-2 border-gray-200 bg-gray-50 text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary focus:bg-white focus:shadow-md focus:shadow-primary/5 transition-all duration-300 focus:ring-2 focus:ring-primary/10"
                         style={{ borderRadius: '16px' }}
                       />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 text-text-muted hover:text-text-main transition-colors p-1 hover:scale-110"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>

                 {/* Error Message */}
                 {error && (
                   <div className="bg-red-50 backdrop-blur-sm border border-red-200 text-red-700 p-4 text-sm text-center font-medium animate-shake" style={{ borderRadius: '16px' }}>
                     <div className="flex items-center justify-center gap-2">
                       <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                       {error}
                     </div>
                   </div>
                 )}

                 {/* Submit Button */}
                 <button
                   type="submit"
                   disabled={loading}
                   className="w-full py-4 px-6 font-bold text-white bg-gradient-to-r from-primary via-accent to-secondary hover:from-primary-hover hover:via-accent-dark hover:to-secondary/90 transition-all duration-300 shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:hover:shadow-primary/40 transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                   style={{ borderRadius: '16px' }}
                 >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <LogIn size={20} />
                        <span>Sign In</span>
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                </button>
              </form>

              {/* Footer */}
              <div className="mt-8 flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to reset your license? You will need to re-enter your license key.')) {
                      try {
                        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
                        await fetch(`${API_BASE_URL}/config/reset`, {
                          method: 'POST',
                          headers: {
                            'X-Tenant-DB': localStorage.getItem('resto_db_name') || '',
                            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
                          }
                        });
                        // Keep 'resto_hwid' so the computer's unique hardware fingerprint remains unchanged!
                        
                        // Clear ALL restaurant-specific data to prevent old restaurant names from bleeding through
                        localStorage.removeItem('resto_license'); // Clear license key memory
                        localStorage.removeItem('resto_license_expiry'); // Clear license expiry memory
                        localStorage.removeItem('user'); // Clear user session
                        localStorage.removeItem('resto_db_name'); // CRITICAL FIX: Clear old database name
                        localStorage.removeItem('restaurantSettings'); // CRITICAL FIX: Clear old restaurant name and settings
                        localStorage.removeItem('msbillings_spaces'); // CRITICAL FIX: Clear old floor layout
                        
                        alert('License reset successfully. Please restart the application.');
                        window.dispatchEvent(new Event('forceLogout'));
                      } catch (err) {
                        alert('Failed to reset license.');
                      }
                    }
                  }}
                  className="text-text-muted hover:text-red-500 text-sm font-medium transition-colors flex items-center gap-2 group"
                >
                  <RefreshCw size={14} className="group-hover:animate-spin" />
                  Reset License & Switch Account
                </button>
                <p className="text-text-muted text-sm">
                  © 2025 MS Tech Hive . All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
