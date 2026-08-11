import React from 'react';
import { useLanguage } from "../context/LanguageContext";
import { ArrowRight, Download, CheckCircle2, X, Sparkles } from 'lucide-react';

const UpdateModal = ({ isOpen, onInstall, onClose }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900/90 dark:to-slate-800/90">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 dark:bg-blue-500 p-3 rounded-xl text-white shadow-md shadow-blue-500/30 flex items-center justify-center shrink-0">
              <Download size={24} className="animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t("Software Update Available")}</h2>
                <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles size={12} /> {t("New")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {t("A new version of MS Billing is ready to install")}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
              title={t("Close")}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 bg-white dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed text-sm">
            {t("We have downloaded the latest version of MS Billing in the background. To apply these updates and ensure optimal performance, the application needs to restart.")}
          </p>
          
          <div className="space-y-3 mb-8 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span className="font-medium">{t("Performance and stability improvements")}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span className="font-medium">{t("Enhanced security protocols")}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span className="font-medium">{t("Latest features and bug fixes")}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition-colors"
              >
                {t("Remind Me Later")}
              </button>
            )}
            <button
              onClick={onInstall}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 text-sm"
            >
              <span>{t("Restart and Install Update")}</span>
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="text-right mt-3">
             <p className="text-xs text-slate-400">{t("The restart will take approximately 10 seconds.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;