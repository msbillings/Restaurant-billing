import React from 'react';
import {
  FileText, Laptop, Receipt, Users, Banknote, Wallet, CreditCard, Coins, Package, Bell,
  LayoutGrid, RefreshCw, HelpCircle, MonitorPlay, IndianRupee, Languages, UserCog,
  MessageSquarePlus, Truck, Monitor,
  UtensilsCrossed, Printer, Percent, Tags, MonitorSmartphone, Settings as SettingsIcon,
  Globe, ToggleLeft, Clock, ListChecks, Shield, Award, LineChart
} from 'lucide-react';

const Operations = ({ onNavigate, userRole }) => {
  const operationsFeatures = [
    ...(userRole === 'admin' ? [{ id: 'admin', name: 'Admin Dashboard', icon: Shield }] : []),
    { id: 'billing', name: 'Orders', icon: FileText },
    { id: 'online-orders', name: 'Online Orders', icon: Laptop },
    { id: 'kothistory', name: 'KOTs', icon: Receipt },
    { id: 'crm', name: 'Customers', icon: Users },
    { id: 'daybook', name: 'Cash Flow', icon: Banknote },
    { id: 'expenses', name: 'Expense', icon: Wallet },
    { id: 'withdrawal', name: 'Withdrawal', icon: CreditCard },
    { id: 'cash-topup', name: 'Cash Top-Up', icon: Coins },
    { id: 'inventory', name: 'Inventory', icon: Package },
    { id: 'notification', name: 'Notification', icon: Bell },
    { id: 'floor', name: 'Table', icon: LayoutGrid },
    { id: 'sync', name: 'Manual Sync', icon: RefreshCw },
    { id: 'help', name: 'Help', icon: HelpCircle },
    { id: 'live-view', name: 'Live View', icon: MonitorPlay },
    { id: 'due-payment', name: 'Due Payment', icon: IndianRupee },
    { id: 'language', name: 'Language Profiles', icon: Languages },
    { id: 'staff', name: 'Billing User Profile', icon: UserCog },
    { id: 'currency', name: 'Currency Conversion', icon: IndianRupee },
    { id: 'feedback', name: 'Feedback', icon: MessageSquarePlus },
    { id: 'delivery', name: 'Delivery Boys', icon: Truck },
    { id: 'kds', name: 'LED Display', icon: Monitor },
    { id: 'reservation', name: 'Reservation', icon: Users },
    { id: 'push-orders', name: 'Push Orders', icon: Package },
    { id: 'loyalty', name: 'Loyalty & Wallet', icon: Award },
    { id: 'forecasting', name: 'Sales Forecast', icon: LineChart },
  ];

  const configFeatures = [
    { id: 'menu', name: 'Menu', icon: UtensilsCrossed },
    { id: 'bill-print', name: 'Bill / KOT Print', icon: Printer },
    { id: 'tax', name: 'Tax', icon: Percent },
    { id: 'discount', name: 'Discount', icon: Tags },
    { id: 'billing-screen', name: 'Billing Screen', icon: MonitorSmartphone },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
    { id: 'online-config', name: 'Online Order Configuration', icon: Globe },
    { id: 'menu-toggle', name: 'Menu Item On Off', icon: ToggleLeft },
    { id: 'renewal', name: 'Service Renewal', icon: Clock },
    { id: 'custom-status', name: 'Custom Order Status', icon: ListChecks },
  ];

  const handleFeatureClick = (id) => {
    // Navigate to actual pages if they exist, otherwise just ignore or show coming soon
    const implementedRoutes = ['billing', 'kothistory', 'crm', 'daybook', 'expenses', 'inventory', 'floor', 'staff', 'delivery', 'kds', 'menu', 'settings', 'tax', 'discount', 'withdrawal', 'cash-topup', 'due-payment', 'reservation', 'feedback', 'push-orders', 'bill-print', 'online-config', 'online-orders', 'sync', 'admin', 'notification', 'help', 'live-view', 'language', 'currency', 'billing-screen', 'menu-toggle', 'renewal', 'custom-status', 'loyalty', 'forecasting'];
    if (implementedRoutes.includes(id)) {
      onNavigate(id);
    } else {
      // Feature not fully implemented yet in the system, just placeholder
      console.log(`Feature ${id} coming soon!`);
    }
  };

  const renderGrid = (features) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <button
            key={feature.id}
            onClick={() => handleFeatureClick(feature.id)}
            className="group flex flex-col items-center justify-center p-4 bg-white rounded-lg hover:shadow-md border border-gray-100 hover:border-primary/30 transition-all active:scale-95 duration-200 min-h-[110px]"
          >
            <div className="mb-3 text-gray-700 transition-transform group-hover:scale-110 group-hover:text-primary">
              <Icon size={30} strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium text-gray-600 text-center leading-tight group-hover:text-primary transition-colors">
              {feature.name}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      
      <div className="mb-8">
        <h2 className="text-sm font-bold text-gray-800 mb-4 tracking-wide">Operations</h2>
        {renderGrid(operationsFeatures)}
      </div>

      <div className="mb-8 mt-2">
        <h2 className="text-sm font-bold text-gray-800 mb-4 tracking-wide">Set the configuration for your restaurant</h2>
        {renderGrid(configFeatures)}
      </div>

    </div>
  );
};

export default Operations;
