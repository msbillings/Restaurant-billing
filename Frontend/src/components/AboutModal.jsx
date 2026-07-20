import React from 'react';
import { X, Info, ShieldCheck, Heart, Sparkles, Code2, Server } from 'lucide-react';

const AboutModal = ({ isOpen, onClose, version }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up relative"
      >
        {/* Banner */}
        <div className="bg-gradient-to-r from-orange-500 to-rose-500 h-32 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-black/10"></div>
          <Sparkles className="absolute top-4 right-4 text-white/50" size={24} />
          <Code2 className="absolute bottom-4 left-4 text-white/50" size={32} />
          
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md shadow-lg border border-white/30 transform translate-y-6">
            <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-md">msbillings</h1>
          </div>
        </div>

        {/* Content */}
        <div className="pt-16 pb-8 px-8 text-center">
          <div className="inline-flex items-center justify-center bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1 rounded-full text-sm font-bold mb-4 border border-orange-200 dark:border-orange-800/50">
            Version {version || '6.0.0'}
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Premium Restaurant Management
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
            The most advanced point-of-sale and restaurant management ecosystem. Empowering restaurants with Real-time Analytics, AI Face Attendance, and seamless Multi-floor management.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center">
              <ShieldCheck size={24} className="text-emerald-500 mb-2" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Enterprise Secure</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center">
              <Server size={24} className="text-blue-500 mb-2" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Cloud Sync Ready</span>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-2">
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1 font-medium">
              Made with <Heart size={14} className="text-rose-500 fill-rose-500 mx-1" /> by 
              <span className="text-slate-700 dark:text-slate-300 font-bold ml-1">MS Tech Hive</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-2">
              © {new Date().getFullYear()} MS Tech Hive. All rights reserved.
            </p>
          </div>
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default AboutModal;
