import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Fingerprint, Lock, Mail, Shield, AlertTriangle } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  useEffect(() => {
    // Check if the browser supports WebAuthn
    if (window.PublicKeyCredential) {
      setIsBiometricSupported(true);
    }
  }, []);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('https://restaurant-superadmin-api-maheer.vercel.app/api/auth/login', { email, password });
      localStorage.setItem('superadmin_token', res.data.token);
      localStorage.setItem('superadmin_user', JSON.stringify(res.data.admin));
      onLogin(res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (bioLoading) return;
    setError('');
    setBioLoading(true);
    try {
      // 1. Get auth options from server
      const resp = await axios.get('https://restaurant-superadmin-api-maheer.vercel.app/api/auth/webauthn/authenticate/generate');
      const options = resp.data;

      // 2. Trigger browser biometric prompt (TouchID / FaceID / Windows Hello)
      const asseResp = await startAuthentication(options);

      // 3. Verify on server
      const verificationResp = await axios.post('https://restaurant-superadmin-api-maheer.vercel.app/api/auth/webauthn/authenticate/verify', asseResp);
      
      if (verificationResp.data.verified && verificationResp.data.token) {
        localStorage.setItem('superadmin_token', verificationResp.data.token);
        localStorage.setItem('superadmin_user', JSON.stringify(verificationResp.data.admin));
        onLogin(verificationResp.data.token);
      } else {
        setError('Verification failed. Please try again or use password.');
      }
    } catch (err) {
      console.error(err);
      const errDetails = err.response?.data?.details || err.response?.data?.error || err.response?.data?.message || err.message;
      setError(`Biometric authentication failed: ${errDetails}`);
    } finally {
      setBioLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-8 text-center border-b border-border/50 bg-background/50">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30 shadow-[0_0_30px_rgba(255,92,53,0.2)]">
            <Shield className="text-primary w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">MS<span className="text-primary">BILLING</span></h1>
          <p className="text-gray-400 font-medium tracking-widest text-sm mt-1">SUPER ADMIN</p>
        </div>

        {/* Login Form */}
        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl flex items-start gap-2 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Master Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-500" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
                  placeholder="admin@msbilling.in"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Master Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying...' : 'Login with Password'}
            </button>
          </form>

          {isBiometricSupported && (
            <>
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-4 text-gray-500 font-semibold tracking-wider">Or unlock with</span>
                </div>
              </div>

              <button 
                onClick={handleBiometricLogin}
                disabled={bioLoading}
                className={`w-full py-4 bg-background border border-border hover:border-primary/50 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/10 group ${bioLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {bioLoading ? (
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Fingerprint className="w-6 h-6 text-primary" />
                  )}
                </div>
                <span className="text-gray-300 group-hover:text-white transition-colors">
                  {bioLoading ? 'Waiting for Fingerprint...' : 'TouchID / Passkey'}
                </span>
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
