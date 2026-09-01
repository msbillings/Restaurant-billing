import React from 'react';
import { useLanguage } from "../context/LanguageContext";
import { ArrowRight, Download, CheckCircle2, X, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

const UpdateModal = ({ isOpen, onInstall, onClose, isDownloading, downloadProgress = 0, updateInfo }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const newVersion = updateInfo?.version ? `v${updateInfo.version}` : '';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 dark:bg-blue-500 p-3 rounded-xl text-white shadow-md shadow-blue-500/30 flex items-center justify-center shrink-0">
              {isDownloading ? (
                <RefreshCw size={24} className="animate-spin" />
              ) : (
                <Download size={24} className="animate-bounce" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                  {isDownloading ? t("Downloading Update...") : t("Software Update Ready")}
                </h2>
                {newVersion && (
                  <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles size={12} /> {newVersion}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {isDownloading 
                  ? t("Downloading the latest MS Billings update in background...") 
                  : t("A new version of MS Billing has been downloaded and is ready to install.")}
              </p>
            </div>
          </div>

          {onClose && !isDownloading && (
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
          {isDownloading ? (
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                {t("The application is downloading the latest update assets from GitHub. You can continue using MS Billings while the download completes.")}
              </p>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>{t("Download Progress")}</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-700">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 ease-out shadow-sm"
                    style={{ width: `${Math.max(5, Math.min(100, downloadProgress))}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2.5">
                <Sparkles size={16} className="text-blue-600 shrink-0" />
                <span>{t("Once the download finishes, you will be prompted to restart and apply updates.")}</span>
              </div>
            </div>
          ) : (
            <>
              <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed text-sm">
                {t("We have downloaded the latest version of MS Billing. To apply these updates and ensure optimal performance, the application needs to restart.")}
              </p>
              
              <div className="space-y-3 mb-8 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span className="font-medium">{t("Performance and stability improvements")}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span className="font-medium">{t("Real-time auto-updater & instant sync")}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span className="font-medium">{t("Latest bug fixes & UI optimizations")}</span>
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
                  className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 text-sm cursor-pointer"
                >
                  <span>{t("Restart and Install Update")}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
              <div className="text-right mt-3">
                 <p className="text-xs text-slate-400">{t("The restart will take approximately 10 seconds.")}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;