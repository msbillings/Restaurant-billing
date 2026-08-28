import { useLanguage } from "../context/LanguageContext";import React from 'react';
import BackButton from './common/BackButton';
import { ArrowLeft, Clock, ShieldCheck, CreditCard, ChevronRight } from 'lucide-react';

const ServiceRenewal = ({ onNavigate, onGoBack }) =>{const { t } = useLanguage();
  return (
    <div className="h-full flex flex-col bg-gray-50 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-2 sm:mb-2.5 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="text-primary shrink-0" size={22} />
              <span>{t("Service Renewal")}</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">{t("Manage your POS software subscription")}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full space-y-4 sm:space-y-6 pb-6">
        
        {/* Current Plan Status */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg border border-gray-700 p-5 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  {t("Active Subscription")}
                </span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black mb-1">{t("Enterprise POS License")}</h2>
              <p className="text-xs sm:text-sm text-gray-400">{t("Includes Multi-outlet support, KDS, and Cloud Sync")}</p>
            </div>
            <div className="text-left md:text-right border-t md:border-t-0 border-gray-700/60 pt-3 md:pt-0 w-full md:w-auto">
              <div className="text-xs sm:text-sm text-gray-400 uppercase font-bold tracking-widest mb-0.5 sm:mb-1">{t("Expires In")}</div>
              <div className="text-2xl sm:text-4xl font-black text-amber-400">{t("342 Days")}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">{t("July 7, 2027")}</div>
            </div>
          </div>
        </div>

        {/* Upgrade / Renew Options */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6">{t("Subscription Actions")}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <button className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all group text-left cursor-pointer">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <CreditCard size={20} className="sm:hidden" />
                  <CreditCard size={24} className="hidden sm:block" />
                </div>
                <div>
                  <div className="font-bold text-gray-800 group-hover:text-primary transition-colors text-xs sm:text-base">{t("Renew License")}</div>
                  <div className="text-[11px] sm:text-sm text-gray-500">{t("Pay for another year to avoid interruption")}</div>
                </div>
              </div>
              <ChevronRight className="text-gray-400 group-hover:text-primary transition-colors shrink-0" size={18} />
            </button>

            <button className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all group text-left cursor-pointer">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} className="sm:hidden" />
                  <ShieldCheck size={24} className="hidden sm:block" />
                </div>
                <div>
                  <div className="font-bold text-gray-800 group-hover:text-primary transition-colors text-xs sm:text-base">{t("Buy Add-ons")}</div>
                  <div className="text-[11px] sm:text-sm text-gray-500">{t("Add Captain App, Delivery API, or Loyalty")}</div>
                </div>
              </div>
              <ChevronRight className="text-gray-400 group-hover:text-primary transition-colors shrink-0" size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>);

};

export default ServiceRenewal;