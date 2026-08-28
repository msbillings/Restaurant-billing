import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import { Users, Search, Star, TrendingUp, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import BackButton from './common/BackButton';

const CRM = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const fetchCustomers = async () => {
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
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
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

  if (loading) return <div className="p-8 text-center text-text-muted">{t("Loading CRM...")}</div>;

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
            <p className="text-sm sm:text-base md:text-lg font-bold text-text-main leading-tight">{customers.filter((c) => c.isVIP).length}</p>
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
                      {customer.isVIP && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">{t("VIP")}</span>}
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
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1 max-w-[200px]">
                      {customer.favoriteItems?.slice(0, 1).map((item, i) =>
                        <span key={i} className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-text-muted truncate max-w-[140px]" title={item.itemName}>
                          {t(item.itemName)} ({item.count})
                        </span>
                      )}
                      {customer.favoriteItems?.length > 1 && (
                        <span className="text-[9px] bg-surface-hover text-text-muted px-1 py-0.5 rounded font-bold shrink-0">
                          +{customer.favoriteItems.length - 1}
                        </span>
                      )}
                    </div>
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
                  {customer.isVIP && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{t("VIP")}</span>}
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
              <div className="flex flex-wrap gap-1 mt-1.5">
                {customer.favoriteItems.slice(0, 3).map((item, i) => (
                  <span key={i} className="text-[9px] bg-background border border-border px-1.5 py-0.5 rounded text-text-muted whitespace-nowrap">{t(item.itemName)}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>);

};

export default CRM;