import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { Users, Search, Star, TrendingUp, Calendar, ChevronLeft, ChevronRight, FileText, X, Loader2, Eye, Settings, ChevronDown, ChevronUp, Save, CheckCircle2 } from 'lucide-react';
import BackButton from './common/BackButton';
import Invoice from './Invoice';
import { getBills, getBillById } from '../api/billing';
import api from '../api/axios';

const CRM = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Modal states for viewing bills
  const [billsModal, setBillsModal] = useState({ isOpen: false, customer: null, bills: [], loading: false, error: '' });
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBillId, setLoadingBillId] = useState(null);

  const [expandedFavorites, setExpandedFavorites] = useState({});
  const [vipSettingsOpen, setVipSettingsOpen] = useState(false);
  const [vipSettings, setVipSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('resto_vip_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { vipVisitThreshold: 5, vipSpendThreshold: 5000 };
  });
  const [fullSettings, setFullSettings] = useState({});
  const [savingVipSettings, setSavingVipSettings] = useState(false);

  const toggleFavorites = (customerId) => {
    setExpandedFavorites(prev => ({
      ...prev,
      [customerId]: !prev[customerId]
    }));
  };

  const loadVipSettings = async () => {
    try {
      const res = await api.get('/config/info');
      if (res.data?.restaurantSettings) {
        const backendSettings = res.data.restaurantSettings;
        setFullSettings(backendSettings);
        
        // Use local saved settings if user recently customized them, else sync from backend
        const localSaved = localStorage.getItem('resto_vip_settings');
        if (localSaved) {
          try {
            setVipSettings(JSON.parse(localSaved));
            return;
          } catch (e) {}
        }
        
        const newVip = {
          vipVisitThreshold: backendSettings.vipVisitThreshold !== undefined ? Number(backendSettings.vipVisitThreshold) : 5,
          vipSpendThreshold: backendSettings.vipSpendThreshold !== undefined ? Number(backendSettings.vipSpendThreshold) : 5000
        };
        setVipSettings(newVip);
        localStorage.setItem('resto_vip_settings', JSON.stringify(newVip));
      }
    } catch (err) {
      console.error('Failed to load VIP settings', err);
    }
  };

  const saveVipSettings = async () => {
    // 1. Instant optimistic UI close & LocalStorage update (0ms delay)
    localStorage.setItem('resto_vip_settings', JSON.stringify(vipSettings));
    const newFullSettings = { ...fullSettings, ...vipSettings };
    setFullSettings(newFullSettings);
    setVipSettingsOpen(false);

    // 2. Non-blocking background API update
    try {
      await api.post('/config/info', { restaurantSettings: vipSettings });
    } catch (err) {
      console.error('Background save VIP settings failed:', err);
    }
  };

  const isCustomerVIP = (customer) => {
    const visits = vipSettings.vipVisitThreshold || 5;
    const spend = vipSettings.vipSpendThreshold || 5000;
    return customer.totalVisits >= visits || customer.totalSpend >= spend;
  };

  const fetchCustomers = async () => {
    try {
      const cached = localStorage.getItem('resto_crm_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomers(parsed);
          setLoading(false);
        }
      }
    } catch (e) {}

    try {
      const API_BASE_URL = getApiUrl();
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
        localStorage.setItem('resto_crm_cache', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVipSettings();
    fetchCustomers();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm));
    if (!matchesSearch) return false;
    if (filterType === 'All') return true;
    const type = c.lastOrderType || 'Dine-In';
    if (filterType === 'Dine-In') return type === 'Dine-In';
    if (filterType === 'Delivery') return type === 'Delivery';
    if (filterType === 'Pick Up') return type === 'Takeaway' || type === 'Pick Up';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredCustomers.length);
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  const getOrderTypeBadge = (customer) => {
    const currentType = customer.lastOrderType || 'Dine-In';
    if (currentType === 'Delivery') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 whitespace-nowrap">
          {t("Delivery")}
        </span>
      );
    }
    if (currentType === 'Takeaway' || currentType === 'Pick Up') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 whitespace-nowrap">
          {t("Pick Up")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 whitespace-nowrap">
        {t("Dine-In")}
      </span>
    );
  };

  const handleViewBills = async (customer) => {
    if (!customer.phone) return; // Need phone to search bills
    setBillsModal({ isOpen: true, customer, bills: [], loading: true, error: '' });
    try {
      const data = await getBills({ limit: 50, search: customer.phone });
      let customerBills = [];
      if (Array.isArray(data)) {
        customerBills = data;
      } else if (data && data.bills) {
        customerBills = data.bills;
      }
      
      // Double check filtering in case search returned fuzzy matches
      customerBills = customerBills.filter(b => b.customerPhone === customer.phone);
      
      setBillsModal(prev => ({ ...prev, bills: customerBills, loading: false }));
    } catch (err) {
      console.error('Error fetching customer bills:', err);
      setBillsModal(prev => ({ ...prev, loading: false, error: 'Failed to fetch bills' }));
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center justify-center gap-3 bg-surface p-8 rounded-3xl border border-border shadow-xl max-w-xs sm:max-w-sm w-full text-center animate-fade-in">
          <div className="relative flex items-center justify-center my-2">
            <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Users size={22} className="text-primary absolute animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-text-main">{t("Loading CRM Directory")}</h3>
            <p className="text-xs text-text-muted mt-1">{t("Fetching customer profiles & loyalty stats...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      {/* Responsive Compact Header Bar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between mb-2 sm:mb-2.5 gap-2 bg-surface p-2 sm:p-2.5 rounded-2xl border border-border shrink-0 shadow-2xs">
        {/* Row 1 on Smaller Screens / Left side on Large Desktop: Back Button + Title + Filter Pills */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 w-full xl:w-auto shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="flex items-center gap-1.5">
              <Users className="text-primary shrink-0 w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <h1 className="text-xs sm:text-sm font-bold text-text-main whitespace-nowrap">
                <span>{t("CUSTOMER DIRECTORY (CRM)")}</span>
              </h1>
            </div>
          </div>

          {/* Type Filter Pills */}
          <div className="flex bg-background p-0.5 rounded-xl border border-border shrink-0">
            {['All', 'Dine-In', 'Delivery', 'Pick Up'].map((tType) => (
              <button
                key={tType}
                type="button"
                onClick={() => setFilterType(tType)}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterType === tType
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                {t(tType)}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2 on Smaller Screens / Right side on Large Desktop: Search Bar (takes remaining width) + Pagination on SAME ROW */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full xl:w-auto flex-1 xl:flex-initial min-w-0">
          {/* Search Input: Takes remaining width dynamically on smaller screens */}
          <div className="relative flex-1 min-w-0 xl:w-48">
            <input
              type="text"
              placeholder={t("Search Name/Phone...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-2.5 py-1 pl-6 text-[11px] sm:text-xs focus:outline-none focus:border-primary text-text-main placeholder:text-text-muted" />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" size={12} />
          </div>

          {/* Pagination: Sits on the same row beside the search bar */}
          <div className="flex items-center gap-0.5 bg-background border border-border rounded-xl px-1.5 py-0.5 shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={t("Previous Page")}
            >
              <ChevronLeft size={13} />
            </button>

            <span className="text-[10px] sm:text-[11px] font-bold text-text-main px-1 select-none whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={t("Next Page")}
            >
              <ChevronRight size={13} />
            </button>
          </div>

          <button
            onClick={() => {
              loadVipSettings();
              setVipSettingsOpen(true);
            }}
            className="p-1.5 sm:p-2 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl transition-colors shrink-0 shadow-2xs cursor-pointer"
            title={t("VIP Settings")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-2.5 shrink-0">
        <div className="bg-surface p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-border flex items-center gap-2 sm:gap-3 shadow-xs">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
            <Users size={15} />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[10px] sm:text-[11px] text-text-muted font-bold truncate">{t("Customers")}</p>
            <p className="text-sm sm:text-base md:text-lg font-bold text-text-main leading-tight">{customers.length}</p>
          </div>
        </div>

        <div className="bg-surface p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-border flex items-center gap-2 sm:gap-3 shadow-xs">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-500/10 text-purple-500 rounded-lg flex items-center justify-center shrink-0">
            <Star size={15} />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[10px] sm:text-[11px] text-text-muted font-bold truncate">{t("VIP")}</p>
            <p className="text-sm sm:text-base md:text-lg font-bold text-text-main leading-tight">{customers.filter(c => isCustomerVIP(c)).length}</p>
          </div>
        </div>

        <div className="bg-surface p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-border flex items-center gap-2 sm:gap-3 shadow-xs">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center shrink-0">
            <TrendingUp size={15} />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-[10px] sm:text-[11px] text-text-muted font-bold truncate">{t("Revenue")}</p>
            <p className="text-xs sm:text-sm md:text-lg font-bold text-text-main leading-tight truncate">₹{customers.reduce((acc, c) => acc + (c.totalSpend || 0), 0).toFixed(0)}</p>
          </div>
        </div>
      </div>
      
      {/* Desktop / Tablet Table with Horizontal Scroll */}
      <div className="hidden md:block flex-1 overflow-x-auto overflow-y-auto bg-surface rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-left border-collapse">
          <thead className="bg-background/80 sticky top-0 backdrop-blur-sm z-10">
            <tr>
              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border whitespace-nowrap">{t("Customer")}</th>
              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border whitespace-nowrap">{t("Contact")}</th>
              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border whitespace-nowrap">{t("Type")}</th>
              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border whitespace-nowrap text-center">{t("Visits")}</th>
              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border text-right whitespace-nowrap">{t("Total Spend")}</th>
              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border whitespace-nowrap">{t("Last Visit")}</th>
              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border whitespace-nowrap">{t("Favorites")}</th>
              <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border whitespace-nowrap text-center">{t("Action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-muted">
                  <Users size={24} className="mx-auto text-text-muted/50 mb-1.5" />
                  <p>{t("No customers found.")}</p>
                </td>
              </tr>
            ) : (
              paginatedCustomers.map((customer) => (
                <tr key={customer._id} className="hover:bg-background/30 transition-colors h-11">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-text-main truncate max-w-[140px]">{t(customer.name || 'Guest')}</span>
                      {isCustomerVIP(customer) && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">{t("VIP")}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-text-muted font-mono whitespace-nowrap">{customer.phone}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {getOrderTypeBadge(customer)}
                  </td>
                  <td className="px-3 py-2 font-bold text-text-main whitespace-nowrap text-center">{customer.totalVisits}</td>
                  <td className="px-3 py-2 font-bold text-success text-right whitespace-nowrap">₹{customer.totalSpend?.toFixed(2) || '0.00'}</td>
                  <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                    <div className="flex items-center gap-1 text-[11px]"><Calendar size={12} /> {new Date(customer.lastVisit).toLocaleDateString()}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 w-full max-w-[280px]">
                      {customer.favoriteItems?.slice(0, 2).map((item, i) =>
                        <span key={i} className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-text-muted truncate max-w-[120px]" title={item.itemName}>
                          {t(item.itemName)} ({item.count})
                        </span>
                      )}
                      {customer.favoriteItems?.length > 2 && (
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorites(customer._id); }}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-surface-hover text-text-muted hover:text-text-main rounded transition-colors cursor-pointer border border-border shrink-0"
                          >
                            +{customer.favoriteItems.length - 2} <ChevronDown size={10} />
                          </button>
                          {expandedFavorites[customer._id] && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); toggleFavorites(customer._id); }} />
                              <div className="absolute top-full right-0 mt-1.5 w-48 bg-background border border-border rounded-xl shadow-2xl z-50 p-1.5 flex flex-col gap-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                                <div className="text-[9px] font-bold text-text-muted px-1 pb-1 mb-0.5 border-b border-border uppercase tracking-wider">{t("All Favorites")}</div>
                                {customer.favoriteItems.map((item, idx) => (
                                  <div key={idx} className="text-[10px] bg-surface-hover px-2 py-1.5 rounded-lg text-text-main flex justify-between items-center">
                                    <span className="truncate pr-2" title={item.itemName}>{t(item.itemName)}</span>
                                    <span className="font-bold text-primary shrink-0 bg-primary/10 px-1.5 rounded">x{item.count}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleViewBills(customer)}
                      disabled={!customer.phone}
                      className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center cursor-pointer"
                      title={t("View Customer Bills")}
                    >
                      <FileText size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-2.5">
        {filteredCustomers.length === 0 ? (
          <div className="py-10 p-4 text-center text-text-muted font-medium bg-surface rounded-xl border border-border text-xs sm:text-sm">
            <Users size={28} className="mx-auto text-text-muted/50 mb-2" />
            <p>{t("No customers found.")}</p>
          </div>
        ) : paginatedCustomers.map((customer) => (
          <div key={customer._id} className="bg-surface rounded-xl border border-border p-3 shadow-xs">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-text-main text-xs sm:text-sm truncate">{t(customer.name || 'Guest')}</span>
                  {isCustomerVIP(customer) && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{t("VIP")}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[11px] text-text-muted font-mono">{customer.phone}</p>
                  {getOrderTypeBadge(customer)}
                </div>
              </div>
              <span className="text-xs sm:text-sm font-black text-success shrink-0">₹{customer.totalSpend?.toFixed(0) || '0'}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1.5 pt-1.5 border-t border-border">
              <span>{t("Visits:")} <strong className="text-text-main">{customer.totalVisits}</strong></span>
              {customer.lastVisit && <span className="flex items-center gap-1"><Calendar size={11} />{new Date(customer.lastVisit).toLocaleDateString()}</span>}
            </div>
            {customer.favoriteItems?.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 relative">
                {customer.favoriteItems.slice(0, 2).map((item, i) => (
                  <span key={i} className="text-[9px] bg-background border border-border px-1.5 py-0.5 rounded text-text-muted whitespace-nowrap truncate max-w-[120px]">
                    {t(item.itemName)} ({item.count})
                  </span>
                ))}
                {customer.favoriteItems.length > 2 && (
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorites(customer._id); }}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-surface-hover text-text-muted hover:text-text-main rounded transition-colors cursor-pointer border border-border shrink-0"
                    >
                      +{customer.favoriteItems.length - 2} <ChevronDown size={10} />
                    </button>
                    {expandedFavorites[customer._id] && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); toggleFavorites(customer._id); }} />
                        <div className="absolute top-full left-0 mt-1.5 w-48 bg-background border border-border rounded-xl shadow-2xl z-50 p-1.5 flex flex-col gap-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                          <div className="text-[9px] font-bold text-text-muted px-1 pb-1 mb-0.5 border-b border-border uppercase tracking-wider">{t("All Favorites")}</div>
                          {customer.favoriteItems.map((item, idx) => (
                            <div key={idx} className="text-[10px] bg-surface-hover px-2 py-1.5 rounded-lg text-text-main flex justify-between items-center">
                              <span className="truncate pr-2" title={item.itemName}>{t(item.itemName)}</span>
                              <span className="font-bold text-primary shrink-0 bg-primary/10 px-1.5 rounded">x{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => handleViewBills(customer)}
                disabled={!customer.phone}
                className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={14} />
                {t("View Bills")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Customer Bills Modal */}
      {billsModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full sm:w-[450px] bg-background h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-border bg-surface flex items-start justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-text-main leading-tight">{t("Customer Bills")}</h2>
                  <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                    <span className="font-medium">{billsModal.customer?.name || 'Guest'}</span>
                    <span>•</span>
                    <span className="font-mono">{billsModal.customer?.phone}</span>
                  </div>
                </div>
                {!billsModal.loading && billsModal.bills.length > 0 && (
                  <div className="bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-xl flex flex-col items-center justify-center shadow-xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider leading-none mb-1 opacity-80">{t("Total Bills")}</span>
                    <span className="text-base font-black leading-none">{billsModal.bills.length}</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setBillsModal({ isOpen: false, customer: null, bills: [], loading: false, error: '' })}
                className="p-2 hover:bg-surface-hover rounded-full text-text-muted cursor-pointer transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {billsModal.loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <p className="text-sm text-text-muted">{t("Loading bills...")}</p>
                </div>
              ) : billsModal.error ? (
                <div className="p-4 bg-danger/10 text-danger rounded-xl text-sm font-medium text-center">
                  {t(billsModal.error)}
                </div>
              ) : billsModal.bills.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-text-muted">
                  <FileText size={32} className="opacity-50" />
                  <p className="text-sm font-medium">{t("No bills found for this customer")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {billsModal.bills.map(bill => (
                    <div key={bill._id} className="bg-surface border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors shadow-xs group">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-mono font-bold text-sm text-text-main group-hover:text-primary transition-colors">
                            #{bill.billNumber}
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            {new Date(bill.createdAt || bill.updatedAt).toLocaleDateString()} {new Date(bill.createdAt || bill.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                          bill.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {t(bill.status)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-2">
                        <div className="font-black text-text-main">
                          ₹{(bill.total || 0).toFixed(2)}
                        </div>
                        <button
                          onClick={async () => {
                            setLoadingBillId(bill._id);
                            try {
                              const fullBill = await getBillById(bill._id);
                              setSelectedBill(fullBill);
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setLoadingBillId(null);
                            }
                          }}
                          disabled={loadingBillId === bill._id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-bold text-text-main hover:bg-surface-hover hover:text-primary transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {loadingBillId === bill._id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                          {t("Invoice")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIP Settings Modal */}
      {vipSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2">
                <Star className="text-purple-500" size={18} />
                <h3 className="font-bold text-text-main text-sm">{t("VIP Customer Settings")}</h3>
              </div>
              <button onClick={() => setVipSettingsOpen(false)} className="text-text-muted hover:text-text-main hover:bg-surface-hover p-1.5 rounded-lg transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-text-muted mb-2">
                {t("Configure when a customer automatically becomes a VIP based on their loyalty.")}
              </p>
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">{t("Visits Required")}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={vipSettings.vipVisitThreshold}
                    onChange={(e) => setVipSettings({ ...vipSettings, vipVisitThreshold: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 text-text-main"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">{t("Visits")}</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-main mb-1.5">{t("Total Spend Required (₹)")}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={vipSettings.vipSpendThreshold}
                    onChange={(e) => setVipSettings({ ...vipSettings, vipSpendThreshold: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 text-text-main"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">₹</div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-surface flex justify-end gap-2">
              <button
                onClick={() => setVipSettingsOpen(false)}
                className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-colors cursor-pointer"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={saveVipSettings}
                disabled={savingVipSettings}
                className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {savingVipSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {t("Save Settings")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal for Viewing Full Bill */}
      {selectedBill && (
        <Invoice
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
        />
      )}

    </div>);
};

export default CRM;