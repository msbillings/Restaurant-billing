import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import { LogIn, User, Lock, Eye, EyeOff, Sparkles, RefreshCw, Camera } from 'lucide-react';
import { loginUser } from '../api/auth';
import BackgroundSlideshow from './BackgroundSlideshow';
import logoImg from '../assets/images/logo.png';

const LoginPage = ({ onLoginSuccess, onClockInClick }) => {const { t } = useLanguage();
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
      if (!err.response) {
        setError('Network Error: Cannot connect to server. Please check your network connection or API URL.');
      } else {
        setError(err.response?.data?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <BackgroundSlideshow formPosition="right">
      <div className="w-full max-w-md relative z-10 animate-fade-in mx-auto px-2 sm:px-0">
        
        {/* Mobile Logo */}
        <div className="lg:hidden text-center mb-4 sm:mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 mb-3 sm:mb-6 shadow-2xl rounded-full relative mt-2 sm:mt-4">
            <img src={logoImg} alt="MS Billing Logo" className="w-full h-full object-cover rounded-full shadow-[0_0_20px_rgba(255,100,0,0.4)] border-2 border-orange-500/50 z-10 relative" />
            <Sparkles className="absolute -top-1 -right-1 text-yellow-400 animate-pulse z-20" size={16} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-1 sm:mb-2 tracking-tight drop-shadow-lg">{t("msbillings")}</h1>
        </div>

        {/* Login Card (Premium Glassmorphism) */}
        <div className="bg-white/10 backdrop-blur-xl p-4 sm:p-8 border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative overflow-hidden w-full max-w-full" style={{ borderRadius: '20px' }}>
          
          <div className="relative z-10">
            <div className="text-center mb-4 sm:mb-8">
              <h2 className="text-xl sm:text-3xl font-black text-white mb-1 drop-shadow-md">{t("Welcome Back")}</h2>
              <p className="text-[11px] sm:text-sm text-gray-300 font-medium">{t("Sign in to continue to your dashboard")}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Username Field */}
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="username" className="text-xs sm:text-sm font-bold text-gray-200 flex items-center gap-2">
                  <User size={14} />{t("Username")}
                </label>
                <div className="relative group">
                  <div className={`relative flex items-center transition-all ${focusedField === 'username' ? 'scale-[1.01]' : ''}`}>
                    <User size={18} className={`absolute left-3.5 transition-colors ${focusedField === 'username' ? 'text-white' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      id="username" placeholder={t("Enter your username")}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="w-full py-3 sm:py-4 px-4 pl-11 sm:pl-12 pr-4 border border-white/20 bg-white/5 text-white text-sm sm:text-base placeholder:text-gray-400 focus:outline-none focus:border-white focus:bg-white/10 transition-all duration-300"
                      style={{ borderRadius: '12px' }} />
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5 sm:space-y-2">
                <label htmlFor="password" className="text-xs sm:text-sm font-bold text-gray-200 flex items-center gap-2">
                  <Lock size={14} />{t("Password")}
                </label>
                <div className="relative group">
                  <div className={`relative flex items-center transition-all ${focusedField === 'password' ? 'scale-[1.01]' : ''}`}>
                    <Lock size={18} className={`absolute left-3.5 transition-colors ${focusedField === 'password' ? 'text-white' : 'text-gray-400'}`} />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password" placeholder={t("Enter your password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="w-full py-3 sm:py-4 px-4 pl-11 sm:pl-12 pr-10 border border-white/20 bg-white/5 text-white text-sm sm:text-base placeholder:text-gray-400 focus:outline-none focus:border-white focus:bg-white/10 transition-all duration-300"
                      style={{ borderRadius: '12px' }} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-gray-400 hover:text-white transition-colors p-1">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error &&
                <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-red-100 p-3 sm:p-4 text-xs sm:text-sm text-center font-bold animate-shake" style={{ borderRadius: '12px' }}>
                  {error}
                </div>
              }

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 sm:py-4 px-6 font-black text-slate-900 bg-white hover:bg-gray-100 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
                style={{ borderRadius: '12px' }}>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ?
                    <>
                      <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                      <span>{t("Signing in...")}</span>
                    </> :
                    <>
                      <LogIn size={18} />
                      <span>{t("Sign In Securely")}</span>
                    </>
                  }
                </span>
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 sm:mt-8 flex flex-col items-center gap-3 sm:gap-4">
              
              {/* AI Clock In Button */}
              <button
                type="button"
                onClick={onClockInClick}
                className="w-full flex items-center justify-center gap-2 py-3 sm:py-4 px-6 border-2 border-white/30 bg-black/20 text-white hover:bg-white hover:text-slate-900 rounded-xl sm:rounded-2xl font-bold transition-all group text-sm sm:text-base">
                <Camera size={18} className="group-hover:scale-110 transition-transform" />{t("Staff AI Clock-In")}
              </button>

              <p className="text-xs sm:text-sm text-gray-300 mt-1 sm:mt-2">{t("Powered by")}
                <span className="font-bold text-white ml-1">{t("MS Tech Hive")}</span>
              </p>

              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to reset your license? You will need to re-enter your license key.')) {
                    try {
                      const API_BASE_URL = getApiUrl();
                      await fetch(`${API_BASE_URL}/config/reset`, {
                        method: 'POST',
                        headers: {
                          'X-Tenant-DB': localStorage.getItem('resto_db_name') || '',
                          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
                        }
                      });
                      localStorage.removeItem('resto_license');
                      localStorage.removeItem('resto_license_expiry');
                      localStorage.removeItem('user');
                      localStorage.removeItem('resto_db_name');
                      localStorage.removeItem('restaurantSettings');
                      localStorage.removeItem('msbillings_spaces');

                      alert('License reset successfully. Please restart the application.');
                      window.dispatchEvent(new Event('forceLogout'));
                    } catch (err) {
                      alert('Failed to reset license.');
                    }
                  }
                }}
                className="text-gray-400 hover:text-white text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 mt-1 sm:mt-2">
                <RefreshCw size={12} />{t("Reset License & Switch Account")}
              </button>
            </div>
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
    </BackgroundSlideshow>);

};

export default LoginPage;