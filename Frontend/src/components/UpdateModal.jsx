import React from 'react';
import { Rocket, Sparkles, Zap, ArrowRight, ShieldCheck, Download } from 'lucide-react';

const UpdateModal = ({ isOpen, onInstall }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl shadow-indigo-500/20 border border-slate-200 dark:border-slate-700/50 animate-slide-up relative"
      >
        {/* Banner */}
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 text-white relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-white/20 rounded-full blur-xl animate-pulse"></div>
              <div className="bg-white/20 p-4 rounded-full backdrop-blur-md border border-white/30 shadow-2xl relative mb-4">
                <Rocket size={40} className="text-white animate-bounce-slow" />
              </div>
            </div>
            
            <h2 className="text-2xl font-black tracking-tight drop-shadow-md flex items-center justify-center gap-2">
              <Sparkles size={20} className="text-pink-200" />
              Update Ready!
              <Sparkles size={20} className="text-pink-200" />
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 text-center bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">
            A New Version is Available
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            We've just downloaded the latest version of MS Billing in the background. It comes with performance improvements, new features, and bug fixes. 
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl flex items-center gap-3">
              <div className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-500 p-2 rounded-xl">
                <Zap size={18} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Speed</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Optimized</p>
              </div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 p-2 rounded-xl">
                <ShieldCheck size={18} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Enhanced</p>
              </div>
            </div>
          </div>

          <button 
            onClick={onInstall}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 group transform hover:scale-[1.02] active:scale-95"
          >
            Restart & Install Now
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 font-medium">
            Takes less than 10 seconds.
          </p>
        </div>
      </div>
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default UpdateModal;
