import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import {
  FileText, Laptop, Receipt, Users, Banknote, Wallet, CreditCard, Coins, Package, Bell,
  LayoutGrid, RefreshCw, HelpCircle, MonitorPlay, IndianRupee, Languages, UserCog,
  MessageSquarePlus, Truck, Monitor,
  UtensilsCrossed, Printer, Percent, Tags, MonitorSmartphone, Settings as SettingsIcon,
  Globe, ToggleLeft, Clock, ListChecks, Shield, Lock, Award, LineChart, Search, X, SearchX } from
'lucide-react';
import BackButton from './common/BackButton';

const Operations = ({ onNavigate, onGoBack, userRole }) => {const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

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
      return (
        <button
          key={feature.id}
          onClick={() => handleFeatureClick(feature.id)}
          className="group flex flex-col items-center justify-center p-4 bg-white rounded-lg hover:shadow-md border border-gray-100 hover:border-primary/30 transition-all active:scale-95 duration-200 min-h-[110px]">
          
            <div className="mb-3 text-gray-700 transition-transform group-hover:scale-110 group-hover:text-primary">
              <Icon size={30} strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-600 text-center leading-tight group-hover:text-primary transition-colors">
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

        {/* Dynamic Search Input */}
        <div className="relative w-full sm:w-72">
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

    </div>);

};

export default Operations;