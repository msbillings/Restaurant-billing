import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import {
  FileText, Laptop, Receipt, Users, Banknote, Wallet, CreditCard, Coins, Package, Bell,
  LayoutGrid, RefreshCw, HelpCircle, MonitorPlay, IndianRupee, Languages, UserCog,
  MessageSquarePlus, Truck, Monitor, Smartphone,
  UtensilsCrossed, Printer, Percent, Tags, MonitorSmartphone, Settings as SettingsIcon,
  Globe, ToggleLeft, Clock, ListChecks, Shield, Lock, Award, LineChart, Search, X, SearchX } from
'lucide-react';
import BackButton from './common/BackButton';
import WhatsAppConnectModal from './WhatsAppConnectModal';

const Operations = ({ onNavigate, onGoBack, userRole }) => {const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const operationsFeatures = [
  ...(userRole === 'admin' || userRole === 'Admin' ? [{ id: 'admin', name: t('Admin Dashboard'), icon: Shield }] : []),
  { id: 'billing', name: t('Orders'), icon: FileText },
  { id: 'online-orders', name: t('Online Orders'), icon: Laptop },
  { id: 'kothistory', name: t('KOTs'), icon: Receipt },
  { id: 'crm', name: t('Customers'), icon: Users },
  { id: 'daybook', name: t('Cash Flow'), icon: Banknote },
  { id: 'expenses', name: t('Expense'), icon: Wallet },
  { id: 'withdrawal', name: t('Withdrawal'), icon: CreditCard },
  { id: 'cash-topup', name: t('Cash Top-Up'), icon: Coins },
  { id: 'inventory', name: t('Inventory'), icon: Package },
  { id: 'notification', name: t('Notification'), icon: Bell },
  { id: 'floor', name: t('Table'), icon: LayoutGrid },
  { id: 'sync', name: t('Manual Sync'), icon: RefreshCw },
  { id: 'help', name: t('Help'), icon: HelpCircle },
  { id: 'live-view', name: t('Live View'), icon: MonitorPlay },
  { id: 'due-payment', name: t('Due Payment'), icon: IndianRupee },
  { id: 'language', name: t('Language Profiles'), icon: Languages },
  { id: 'staff', name: t('Billing User Profile'), icon: UserCog },
  { id: 'currency', name: t('Currency Conversion'), icon: IndianRupee },
  { id: 'feedback', name: t('Feedback'), icon: MessageSquarePlus },
  { id: 'delivery', name: t('Delivery Boys'), icon: Truck },
  { id: 'kds', name: t('LED Display'), icon: Monitor },
  { id: 'reservation', name: t('Reservation'), icon: Users },
  { id: 'push-orders', name: t('Push Orders'), icon: Package },
  { id: 'loyalty', name: t('Loyalty & Wallet'), icon: Award },
  { id: 'forecasting', name: t('Sales Forecast'), icon: LineChart }];


  const configFeatures = [
  { id: 'whatsapp-bot', name: t('WhatsApp Bot Login'), icon: Smartphone, isWhatsApp: true },
  { id: 'menu', name: t('Menu'), icon: UtensilsCrossed },
  { id: 'bill-print', name: t('Bill / KOT Print'), icon: Printer },
  { id: 'tax', name: t('Tax'), icon: Percent },
  { id: 'discount', name: t('Discount'), icon: Tags },
  { id: 'billing-screen', name: t('Billing Screen'), icon: MonitorSmartphone },
  ...(userRole === 'admin' || userRole === 'Admin' ? [{ id: 'settings', name: t('Settings'), icon: SettingsIcon }] : []),
  { id: 'online-config', name: t('Online Order Configuration'), icon: Globe },
  { id: 'menu-toggle', name: t('Menu Item On Off'), icon: ToggleLeft },
  { id: 'renewal', name: t('Service Renewal'), icon: Clock },
  { id: 'custom-status', name: t('Custom Order Status'), icon: ListChecks },
  { id: 'security', name: t('Security & PINs'), icon: Lock }];


  const handleFeatureClick = (id) => {
    if (id === 'whatsapp-bot') {
      setShowWhatsAppModal(true);
      return;
    }
    // Navigate to actual pages if they exist, otherwise just ignore or show coming soon
    const implementedRoutes = ['billing', 'kothistory', 'crm', 'daybook', 'expenses', 'inventory', 'floor', 'staff', 'delivery', 'kds', 'menu', 'settings', 'tax', 'discount', 'withdrawal', 'cash-topup', 'due-payment', 'reservation', 'feedback', 'push-orders', 'bill-print', 'online-config', 'online-orders', 'sync', 'admin', 'notification', 'help', 'live-view', 'language', 'currency', 'billing-screen', 'menu-toggle', 'renewal', 'custom-status', 'loyalty', 'forecasting', 'security'];
    if (implementedRoutes.includes(id)) {
      onNavigate(id);
    } else {
      // Feature not fully implemented yet in the system, just placeholder
      console.log(`Feature ${id} coming soon!`);
    }
  };

  const filteredOperations = operationsFeatures.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const filteredConfig = configFeatures.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const noResults = filteredOperations.length === 0 && filteredConfig.length === 0;

  const renderGrid = (features) =>
  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
      {features.map((feature) => {
      const Icon = feature.icon;
      const isWA = feature.isWhatsApp;
      return (
        <button
          key={feature.id}
          onClick={() => handleFeatureClick(feature.id)}
          className={`group flex flex-col items-center justify-center p-4 bg-white rounded-lg hover:shadow-md border ${isWA ? 'border-[#25D366]/40 hover:border-[#25D366] bg-emerald-50/20' : 'border-gray-100 hover:border-primary/30'} transition-all active:scale-95 duration-200 min-h-[110px]`}>
            <div className={`mb-3 transition-transform group-hover:scale-110 ${isWA ? 'text-[#25D366]' : 'text-gray-700 group-hover:text-primary'}`}>
              {isWA ? (
                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
              ) : (
                <Icon size={30} strokeWidth={1.5} />
              )}
            </div>
            <span className={`text-[11px] font-medium text-center leading-tight transition-colors ${isWA ? 'text-[#25D366] font-bold' : 'text-gray-600 group-hover:text-primary'}`}>
              {feature.name}
            </span>
          </button>);

    })}
    </div>;


  return (
    <div className="h-full flex flex-col bg-gray-50 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto">
      {/* Header & Dynamic Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 sm:mb-3 gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800 tracking-wide">{t("Operations & Configurations")}</h2>
            <p className="text-xs text-gray-500">{t("Quick access to all restaurant modules and settings")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick WhatsApp Bot Login Header Button */}
          <button
            onClick={() => setShowWhatsAppModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer shrink-0">
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            <span>{t("WhatsApp Bot Login")}</span>
          </button>

          {/* Dynamic Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={t("Search operations...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-primary shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {noResults ? (
        /* Empty State Overlay when no operation matches */
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-dashed border-gray-200 text-center my-6 shadow-xs animate-fade-in">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <SearchX size={32} />
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-1">{t("No Operations Found")}</h3>
          <p className="text-xs text-gray-500 max-w-xs mb-4">
            {t("No operation or configuration matching")} <span className="font-semibold text-primary">"{searchQuery}"</span>
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors">
            {t("Clear Search")}
          </button>
        </div>
      ) : (
        <>
          {filteredOperations.length > 0 && (
            <div className="mb-4">
              <h2 className="text-xs sm:text-sm font-bold text-gray-700 tracking-wide mb-2.5 uppercase">{t("Operations")} ({filteredOperations.length})</h2>
              {renderGrid(filteredOperations)}
            </div>
          )}

          {filteredConfig.length > 0 && (
            <div className="mb-4 mt-2">
              <h2 className="text-xs sm:text-sm font-bold text-gray-700 tracking-wide mb-2.5 uppercase">{t("Configurations & Settings")} ({filteredConfig.length})</h2>
              {renderGrid(filteredConfig)}
            </div>
          )}
        </>
      )}

      <WhatsAppConnectModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
      />
    </div>);

};

export default Operations;