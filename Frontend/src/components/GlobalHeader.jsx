import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import { Menu, Search, Calculator, Bell, User, Power, Phone } from 'lucide-react';
import useBroadcasts from '../hooks/useBroadcasts';
import logoImg from '../assets/images/logo.png';

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
    <div className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 bg-white border-b border-border shrink-0 z-20 shadow-xs w-full">
      {/* Left section: Hamburger & Logo */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {onToggleMenu && (
          <button
            onClick={onToggleMenu}
            className="p-1.5 rounded-lg text-text-main hover:bg-surface-hover shadow-xs touch-target flex items-center justify-center">
            <Menu size={22} />
          </button>
        )}
        <div className="flex items-center cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <img
            src={logoImg}
            alt="msbillings"
            style={{ height: '38px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </div>
      </div>

      {/* Middle section: New Order & Search */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-center px-2 sm:px-4 max-w-2xl">
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('createNewOrder'));
            onNavigate('billing');
          }}
          className="bg-danger hover:bg-red-700 text-white font-bold py-1.5 px-3 sm:px-6 rounded-lg shadow-xs transition-colors whitespace-nowrap text-xs sm:text-sm">
          {t("New Order")}
        </button>
        
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text" 
            placeholder={t("Bill No")}
            value={searchBillNo}
            onChange={(e) => setSearchBillNo(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            className="w-full pl-9 pr-4 py-1.5 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-xs sm:text-sm text-text-main" />
        </div>
      </div>

      {/* Right section: Support & Icons */}
      <div className="flex items-center gap-2 sm:gap-5 shrink-0">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface border border-border rounded-lg">
          <div className="bg-red-100 p-1 rounded-full text-danger">
            <Phone size={14} />
          </div>
          <div className="flex flex-col text-xs">
            <span className="text-text-muted font-bold text-[9px] uppercase leading-none">{t("Call For Support")}</span>
            <span className="text-text-main font-bold leading-tight">9701800140</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-text-muted">
          <button onClick={onCalculatorToggle} className="hover:text-primary transition-colors p-1.5 rounded-lg touch-target flex items-center justify-center">
            <Calculator size={18} />
          </button>
          <button className="hover:text-primary transition-colors relative p-1.5 rounded-lg touch-target flex items-center justify-center" onClick={() => onNavigate('operations')}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-danger rounded-full border border-white text-[9px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {(userRole === 'Admin' || userRole === 'admin') && (
            <button className="hover:text-primary transition-colors p-1.5 rounded-lg touch-target flex items-center justify-center" onClick={() => onNavigate('settings')}>
              <User size={18} />
            </button>
          )}
          <button onClick={onLogout} className="text-danger hover:text-red-700 transition-colors p-1.5 rounded-lg touch-target flex items-center justify-center">
            <Power size={18} />
          </button>
        </div>
      </div>
    </div>);

};

export default GlobalHeader;