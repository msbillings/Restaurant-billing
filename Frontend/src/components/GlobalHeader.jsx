import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import { Menu, UtensilsCrossed, Search, Calculator, Bell, User, Power, Phone } from 'lucide-react';
import useBroadcasts from '../hooks/useBroadcasts';

const GlobalHeader = ({
  onToggleMenu,
  onNavigate, onGoBack,
  onLogout,
  onCalculatorToggle,
  activeKOTCount = 0,
  userRole = 'Admin'
}) => {const { t } = useLanguage();
  const [searchBillNo, setSearchBillNo] = useState('');

  // Fetch broadcasts and unread count
  const { unreadCount } = useBroadcasts(userRole);

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter' && searchBillNo.trim()) {
      onNavigate('history');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('executeBillSearch', { detail: searchBillNo }));
      }, 300);
    }
  };

  return (
    <div className="h-16 flex items-center justify-between px-3 sm:px-6 bg-white border-b border-border shrink-0 z-20 shadow-sm w-full">
      {/* Left section: Hamburger & Logo */}
      <div className="flex items-center gap-4">
        {onToggleMenu &&
        <button
          onClick={onToggleMenu}
          className="p-1.5 rounded-lg text-text-main hover:bg-surface-hover shadow-sm">
          
            <Menu size={24} />
          </button>
        }
        <div className="flex items-center gap-2 text-primary cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <div className="w-8 h-8 flex items-center justify-center text-primary">
            <UtensilsCrossed size={28} />
          </div>
          <span className="font-extrabold text-xl tracking-tight hidden sm:inline">{t("msbillings")}</span>
        </div>
      </div>

      {/* Middle section: New Order & Search */}
      <div className="flex items-center gap-4 flex-1 justify-center px-4 max-w-2xl">
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('createNewOrder'));
            onNavigate('billing');
          }}
          className="bg-danger hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-colors whitespace-nowrap">{t("New Order")}


        </button>
        
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text" placeholder={t("Bill No")}

            value={searchBillNo}
            onChange={(e) => setSearchBillNo(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-md focus:outline-none focus:border-primary text-sm text-text-main" />
          
        </div>
      </div>

      {/* Right section: Support & Icons */}
      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface border border-border rounded-md">
          <div className="bg-red-100 p-1.5 rounded-full text-danger">
            <Phone size={14} />
          </div>
          <div className="flex flex-col text-xs">
            <span className="text-text-muted font-bold text-[9px] uppercase leading-none">{t("Call For Support")}</span>
            <span className="text-text-main font-bold leading-tight">9701800140</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-text-muted">
          <button onClick={onCalculatorToggle} className="hover:text-primary transition-colors">
            <Calculator size={20} />
          </button>
          <button className="hover:text-primary transition-colors relative" onClick={() => onNavigate('operations')}>
            <Bell size={20} />
            {unreadCount > 0 &&
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full border border-white text-[10px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            }
          </button>
          <button className="hover:text-primary transition-colors" onClick={() => onNavigate('settings')}>
            <User size={20} />
          </button>
          <button onClick={onLogout} className="text-danger hover:text-red-700 transition-colors ml-2">
            <Power size={20} />
          </button>
        </div>
      </div>
    </div>);

};

export default GlobalHeader;