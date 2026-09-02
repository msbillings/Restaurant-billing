import React, { useState } from 'react';
import { useLanguage } from "../context/LanguageContext";
import { ArrowRight, Download, CheckCircle2, X, RefreshCw, Clock, ChevronDown, BellOff, Sparkles, ShieldCheck } from 'lucide-react';

const UpdateModal = ({ isOpen, onInstall, onClose, onSnooze, isDownloading, downloadProgress = 0, updateInfo }) => {
  const { t } = useLanguage();
  const [showSnoozePanel, setShowSnoozePanel] = useState(false);
  const [customAmount, setCustomAmount] = useState(2);
  const [customUnit, setCustomUnit] = useState('hours'); // 'minutes' | 'hours'

  if (!isOpen) return null;

  const newVersion = updateInfo?.version ? `v${updateInfo.version}` : '';

  const handleQuickSnooze = (minutes, label) => {
    const ms = minutes * 60 * 1000;
    if (onSnooze) {
      onSnooze(ms, label);
    } else if (onClose) {
      onClose();
    }
  };

  const handleCustomSnooze = () => {
    const amount = Math.max(1, parseInt(customAmount, 10) || 1);
    const minutes = customUnit === 'hours' ? amount * 60 : amount;
    const label = `${amount} ${customUnit === 'hours' ? (amount === 1 ? 'Hour' : 'Hours') : (amount === 1 ? 'Minute' : 'Minutes')}`;
    const ms = minutes * 60 * 1000;
    if (onSnooze) {
      onSnooze(ms, label);
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up relative">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="bg-blue-600 dark:bg-blue-500 p-2.5 sm:p-3 rounded-xl text-white shadow-md shadow-blue-500/30 flex items-center justify-center shrink-0">
              {isDownloading ? (
                <RefreshCw size={22} className="animate-spin" />
              ) : (
                <Download size={22} className="animate-bounce" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">
                  {isDownloading ? t("Downloading Update...") : t("Software Update Ready")}
                </h2>
                {newVersion && (
                  <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                     {newVersion}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {isDownloading 
                  ? t("Downloading the latest MS Billings update in background...") 
                  : t("A new version of MS Billing has been verified and is ready to install.")}
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
        <div className="p-5 sm:p-6 bg-white dark:bg-slate-900">
          {isDownloading ? (
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                {t("The application is downloading the latest MS Billings performance and security enhancements from MS Cloud Server. You can continue billing uninterrupted while the download completes.")}
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
                <ShieldCheck size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                <span>{t("Once the download finishes, you can restart immediately or snooze until after your peak restaurant hours.")}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs sm:text-sm transition-colors"
                >
                  {t("Hide & Continue Billing")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed text-xs sm:text-sm">
                {t("We have downloaded the latest version of MS Billing. To apply these updates and ensure optimal performance, the application needs a quick restart.")}
              </p>
              
              <div className="space-y-2.5 mb-5 bg-slate-50 dark:bg-slate-800/50 p-3.5 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span className="font-medium">{t("Performance and stability improvements")}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span className="font-medium">{t("Seamless isolated database sync & speed boost")}</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span className="font-medium">{t("Latest restaurant billing features & fixes")}</span>
                </div>
              </div>

              {/* Snooze / Remind Me Later Interactive Panel */}
              {showSnoozePanel ? (
                <div className="p-4 mb-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-fadeIn">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                      <Clock size={15} className="text-amber-500" />
                      <span>{t("Choose Reminder Time (Per-Shop Snooze)")}</span>
                    </div>
                    <button 
                      onClick={() => setShowSnoozePanel(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {t("Back")}
                    </button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <button
                      onClick={() => handleQuickSnooze(30, '30 Mins')}
                      className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-slate-700 dark:text-slate-200"
                    >
                      ⏱️ {t("30 Mins")}
                    </button>
                    <button
                      onClick={() => handleQuickSnooze(60, '1 Hour')}
                      className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-slate-700 dark:text-slate-200"
                    >
                      ⏱️ {t("1 Hour")}
                    </button>
                    <button
                      onClick={() => handleQuickSnooze(180, '3 Hours')}
                      className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-slate-700 dark:text-slate-200"
                    >
                      ⏱️ {t("3 Hours")}
                    </button>
                    <button
                      onClick={() => handleQuickSnooze(240, '4 Hours')}
                      className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-slate-700 dark:text-slate-200"
                    >
                      ⏱️ {t("4 Hours")}
                    </button>
                  </div>

                  <div className="mb-3">
                    <button
                      onClick={() => handleQuickSnooze(480, 'Tonight (8 Hours)')}
                      className="w-full py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5"
                    >
                      🌙 {t("Tonight (After Closing / 8 Hours)")}
                    </button>
                  </div>

                  {/* Custom Duration Input */}
                  <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">
                      {t("Or specify custom reminder duration:")}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-20 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:border-amber-500 font-bold text-center"
                      />
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:border-amber-500 font-medium"
                      >
                        <option value="minutes">{t("Minutes")}</option>
                        <option value="hours">{t("Hours")}</option>
                      </select>
                      <button
                        onClick={handleCustomSnooze}
                        className="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-lg transition-all shadow-sm"
                      >
                        {t("Set Snooze")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {!showSnoozePanel ? (
                  <button
                    onClick={() => setShowSnoozePanel(true)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5"
                  >
                    <Clock size={15} className="text-amber-500" />
                    <span>{t("Remind Me Later")}</span>
                    <ChevronDown size={14} />
                  </button>
                ) : (
                  <div></div>
                )}

                <button
                  onClick={onInstall}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-2.5 px-5 sm:px-6 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 text-xs sm:text-sm cursor-pointer ml-auto"
                >
                  <span>{t("Restart and Install Update")}</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="text-right mt-2">
                 <p className="text-[11px] text-slate-400">{t("The restart will take approximately 10 seconds.")}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;