import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import { Users, Search, Star, TrendingUp, Calendar } from 'lucide-react';
import BackButton from './common/BackButton';

const CRM = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredCustomers = customers.filter((c) =>
  c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  c.phone && c.phone.includes(searchTerm)
  );

  if (loading) return <div className="p-8 text-center text-text-muted">{t("Loading CRM...")}</div>;

  return (
    <div className="h-full flex flex-col bg-background p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <h1 className="text-lg sm:text-2xl font-black text-text-main flex items-center gap-2">
            <Users className="text-primary" size={22} />{t("CUSTOMER DIRECTORY (CRM)")}
          </h1>
        </div>
        <div className="relative w-full sm:w-auto">
          <input
            type="text" placeholder={t("Search by Name or Phone...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-72 bg-surface border border-border rounded-xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-primary text-text-main" />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 shrink-0">
        <div className="bg-surface p-3 sm:p-4 rounded-2xl border border-border flex items-center gap-2 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0"><Users size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-sm text-text-muted font-bold truncate">{t("Customers")}</p>
            <p className="text-lg sm:text-2xl font-black text-text-main">{customers.length}</p>
          </div>
        </div>
        <div className="bg-surface p-3 sm:p-4 rounded-2xl border border-border flex items-center gap-2 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center shrink-0"><Star size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-sm text-text-muted font-bold truncate">{t("VIP")}</p>
            <p className="text-lg sm:text-2xl font-black text-text-main">{customers.filter((c) => c.isVIP).length}</p>
          </div>
        </div>
        <div className="bg-surface p-3 sm:p-4 rounded-2xl border border-border flex items-center gap-2 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center shrink-0"><TrendingUp size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-sm text-text-muted font-bold truncate">{t("Revenue")}</p>
            <p className="text-sm sm:text-2xl font-black text-text-main">₹{customers.reduce((acc, c) => acc + (c.totalSpend || 0), 0).toFixed(0)}</p>
          </div>
        </div>
      </div>
      
      {/* Desktop Table */}
      <div className="hidden md:block flex-1 overflow-y-auto bg-surface rounded-2xl border border-border">
        <table className="w-full text-left border-collapse">
          <thead className="bg-background/50 sticky top-0 backdrop-blur-sm z-10">
            <tr>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Customer")}</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Contact")}</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Visits")}</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border text-right">{t("Total Spend")}</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border hidden lg:table-cell">{t("Last Visit")}</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border hidden xl:table-cell">{t("Favorites")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredCustomers.map((customer) =>
            <tr key={customer._id} className="hover:bg-background/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main">{t(customer.name || 'Guest')}</span>
                    {customer.isVIP && <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{t("VIP")}</span>}
                  </div>
                </td>
                <td className="p-4 text-sm text-text-muted font-mono">{customer.phone}</td>
                <td className="p-4 text-sm font-bold text-text-main">{customer.totalVisits}</td>
                <td className="p-4 text-sm font-bold text-success text-right">₹{customer.totalSpend?.toFixed(2) || '0.00'}</td>
                <td className="p-4 hidden lg:table-cell text-sm text-text-muted">
                  <div className="flex items-center gap-1"><Calendar size={14} /> {new Date(customer.lastVisit).toLocaleDateString()}</div>
                </td>
                <td className="p-4 hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {customer.favoriteItems?.slice(0, 2).map((item, i) =>
                  <span key={i} className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-text-muted whitespace-nowrap">
                        {t(item.itemName)} ({item.count})
                      </span>
                  )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-text-muted font-medium bg-surface rounded-2xl border border-border">{t("No customers found.")}</div>
        ) : filteredCustomers.map((customer) => (
          <div key={customer._id} className="bg-surface rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-text-main">{t(customer.name || 'Guest')}</span>
                  {customer.isVIP && <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{t("VIP")}</span>}
                </div>
                <p className="text-xs text-text-muted font-mono mt-0.5">{customer.phone}</p>
              </div>
              <span className="text-base font-black text-success">₹{customer.totalSpend?.toFixed(0) || '0'}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-text-muted mt-2 pt-2 border-t border-border">
              <span>{t("Visits:")} <strong className="text-text-main">{customer.totalVisits}</strong></span>
              {customer.lastVisit && <span className="flex items-center gap-1"><Calendar size={12} />{new Date(customer.lastVisit).toLocaleDateString()}</span>}
            </div>
            {customer.favoriteItems?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {customer.favoriteItems.slice(0, 3).map((item, i) => (
                  <span key={i} className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-text-muted whitespace-nowrap">{t(item.itemName)}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>);

};

export default CRM;