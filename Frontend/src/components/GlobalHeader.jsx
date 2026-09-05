import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import { Menu, Search, Calculator, Bell, User, Power, Phone } from 'lucide-react';
import useBroadcasts from '../hooks/useBroadcasts';
import useNotifications from '../hooks/useNotifications';
import useOnlineStatus from '../hooks/useOnlineStatus';
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

  // Fetch broadcasts and real-time notifications unread count
  const { unreadCount: broadcastUnread } = useBroadcasts(userRole);
  const { unreadCount: notifUnread } = useNotifications(userRole);
  const unreadCount = (broadcastUnread || 0) + (notifUnread || 0);
  const { isOnline } = useOnlineStatus();

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter' && searchBillNo.trim()) {
      onNavigate('history');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('executeBillSearch', { detail: searchBillNo }));
      }, 300);
    }
  };

  return (
    <div className="min-h-[60px] h-16 sm:h-20 flex items-center justify-between px-2 sm:px-6 bg-white border-b border-border shrink-0 z-20 shadow-xs w-full">
      {/* Left section: Hamburger & Logo */}
      <div className="flex items-center gap-1 shrink-0 relative">
        {onToggleMenu && (
          <button
            onClick={onToggleMenu}
            className="p-1 rounded-lg text-text-main hover:bg-surface-hover flex items-center justify-center shrink-0">
            <Menu size={22} className="sm:w-6 sm:h-6" />
          </button>
        )}
        <button
          onClick={() => onNavigate && onNavigate(userRole === 'Chef' ? 'kds' : 'floor')}
          className="flex items-center cursor-pointer select-none py-1 px-1 min-w-[165px] sm:min-w-[210px] md:min-w-[250px] hover:opacity-90 transition-opacity focus:outline-none shrink-0 overflow-visible"
          title={t(userRole === 'Chef' ? "Go to Kitchen Display" : "Go to Table View / Floor Management")}>
          <img
            src={logoImg}
            alt="msbillings"
            className="h-11 sm:h-13 md:h-15 w-auto object-contain block transform scale-165 sm:scale-170 md:scale-190 origin-left"
            style={{ objectFit: 'contain' }}
          />
        </button>
        <span className={`relative z-[999] ml-[100px] sm:ml-[120px] md:ml-[140px] px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md border whitespace-nowrap ${isOnline ? 'bg-green-100 text-green-700 border-green-300' : 'bg-orange-100 text-orange-700 border-orange-300'}`}>
          {isOnline ? '● Online' : '● Offline'}
        </span>
      </div>

      {/* Middle section: New Order & Search (Hidden for Chef) */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-center px-2 sm:px-4 max-w-2xl">
        {userRole !== 'Chef' && (
          <>
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
                type="search" 
                name="search_top_bill_no_no_autofill"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                aria-autocomplete="none"
                placeholder={t("Bill No")}
                value={searchBillNo}
                onChange={(e) => setSearchBillNo(e.target.value)}
                onKeyDown={handleSearchKeyPress}
                className="w-full pl-9 pr-4 py-1.5 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-xs sm:text-sm text-text-main" />
            </div>
          </>
        )}
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
          <button className="hover:text-primary transition-colors relative p-1.5 rounded-lg touch-target flex items-center justify-center" onClick={() => onNavigate(userRole === 'Chef' ? 'notification' : 'operations')}>
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
        </div>
      </div>
    </div>);

};

export default GlobalHeader;