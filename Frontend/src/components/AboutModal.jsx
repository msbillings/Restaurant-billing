import { useLanguage } from "../context/LanguageContext";
import React from 'react';
import { X, ShieldCheck, Heart, Server, Sparkles } from 'lucide-react';
import logoImg from '../assets/images/logo.png';

const AboutModal = ({ isOpen, onClose, version }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up relative">

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 py-6 px-6 sm:px-7 relative overflow-hidden flex items-center justify-between text-white">
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="bg-white px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center shrink-0 min-w-[130px] overflow-hidden">
              <img src={logoImg} alt="MS Billings" className="h-10 sm:h-12 w-auto object-contain scale-110" />
            </div>
            <span className="bg-white/25 backdrop-blur-sm text-white text-xs sm:text-sm font-black px-3 py-1.5 rounded-full border border-white/30 shadow-xs">
              v{version || '6.0.83'}
            </span>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 bg-black/15 hover:bg-black/30 text-white rounded-xl transition-colors z-10 cursor-pointer"
            title={t("Close")}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm mb-5 leading-relaxed">
            {t("The most advanced point-of-sale and restaurant management ecosystem. Empowering restaurants with Real-time Analytics, AI Face Attendance, and seamless Multi-floor management.")}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col items-center">
              <ShieldCheck size={20} className="text-emerald-500 mb-1.5" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("Enterprise Secure")}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{t("Isolated Database")}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col items-center">
              <Server size={20} className="text-blue-500 mb-1.5" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("Cloud Sync Ready")}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{t("Instant Real-time")}</span>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 font-medium">
              {t("Made with")}
              <Heart size={13} className="text-rose-500 fill-rose-500 mx-0.5" />
              {t("by")}
              <span className="text-slate-800 dark:text-slate-200 font-bold ml-1">{t("MS Tech Hive")}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              © {new Date().getFullYear()} {t("MS Tech Hive. All rights reserved.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;