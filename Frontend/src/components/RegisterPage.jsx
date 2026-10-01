import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { User, Mail, Lock, Building, ArrowRight, CheckCircle, Shield, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';
import { getSuperadminApiUrl } from '../config';
import axios from 'axios';

const RegisterPage = () => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    restaurantName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setReferralCode(ref);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return setError(t("Passwords do not match"));
    }
    
    setLoading(true);
    setError('');
    
    try {
      const superadminApi = getSuperadminApiUrl();
      const res = await axios.post(`${superadminApi}/api/clients/register`, {
        restaurantName: formData.restaurantName,
        ownerName: formData.ownerName,
        email: formData.email,
        password: formData.password,
        referralCode: referralCode
      });
      
      if (res.data.success) {
        // Auto-activate license on this device to seamlessly login
        if (res.data.licenseKey && res.data.databaseName) {
          localStorage.setItem('resto_license', res.data.licenseKey);
          localStorage.setItem('resto_db_name', res.data.databaseName);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
        setSuccess(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || t("Failed to register. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-white">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-black mb-2">{t("Registration Successful!")}</h2>
          <p className="text-gray-400 mb-8">{t("Your restaurant account has been created successfully. You can now log in.")}</p>
          <button onClick={() => window.location.href = '/login'} className="block w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors cursor-pointer">
            {t("Go to Login")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">
        
        {/* Left Side: Info */}
        <div className="hidden md:flex flex-col justify-center">
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            Join the Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Restaurant Billing</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Create your account today and experience seamless order management, real-time analytics, and automated tax calculations.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-gray-300">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Shield size={20} /></div>
              <span className="font-medium">Secure Cloud Sync</span>
            </div>
            {referralCode && (
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400"><User size={20} /></div>
                <span className="font-medium">Special Referral Bonus Applied!</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Building size={120} />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white mb-2">{t("Create Account")}</h2>
            <p className="text-gray-400 text-sm mb-6">Start managing your restaurant efficiently.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm text-center">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t("Restaurant Name")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Building size={16} />
                  </div>
                  <input required type="text" name="restaurantName" value={formData.restaurantName} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors text-sm" placeholder="e.g. Cake Panda" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t("Owner Name")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <User size={16} />
                  </div>
                  <input required type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors text-sm" placeholder="John Doe" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t("Email Address")}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Mail size={16} />
                  </div>
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors text-sm" placeholder="john@example.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t("Password")}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <Lock size={16} />
                    </div>
                    <input required type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-emerald-500 transition-colors text-sm" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t("Confirm")}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <Lock size={16} />
                    </div>
                    <input required type={showPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-emerald-500 transition-colors text-sm" placeholder="••••••••" />
                  </div>
                </div>
              </div>

              {referralCode && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl mt-2 flex items-center justify-between">
                  <span className="text-xs text-emerald-400 font-medium">Referral Code Applied:</span>
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded">{referralCode}</span>
                </div>
              )}

              <button disabled={loading} type="submit" className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black py-3 sm:py-4 rounded-xl shadow-xl shadow-emerald-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2">
                {loading ? 'Creating Account...' : 'Sign Up Free'} <ArrowRight size={18} />
              </button>
              
              <p className="text-center text-sm text-gray-500 mt-4">
                Already have an account? <a href="/login" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">Sign In</a>
              </p>
            </form>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default RegisterPage;
