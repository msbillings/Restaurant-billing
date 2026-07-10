import React, { useState, useEffect } from 'react';
import { Users, Search, Star, TrendingUp, Calendar } from 'lucide-react';

const CRM = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCustomers = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';
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

  const filteredCustomers = customers.filter(c => 
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  if (loading) return <div className="p-8 text-center text-text-muted">Loading CRM...</div>;

  return (
    <div className="h-full flex flex-col bg-background p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 shrink-0">
        <h1 className="text-2xl font-black text-text-main flex items-center gap-2">
          <Users className="text-primary" /> CUSTOMER DIRECTORY (CRM)
        </h1>
        <div className="relative w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by Name or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 bg-surface border border-border rounded-xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-primary text-text-main"
          />
          <Search className="absolute left-3 top-2.5 text-text-muted" size={18} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
        <div className="bg-surface p-4 rounded-2xl border border-border flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center"><Users size={24} /></div>
          <div>
            <p className="text-sm text-text-muted font-bold">Total Customers</p>
            <p className="text-2xl font-black text-text-main">{customers.length}</p>
          </div>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-border flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center"><Star size={24} /></div>
          <div>
            <p className="text-sm text-text-muted font-bold">VIP Members</p>
            <p className="text-2xl font-black text-text-main">{customers.filter(c => c.isVIP).length}</p>
          </div>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-border flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center"><TrendingUp size={24} /></div>
          <div>
            <p className="text-sm text-text-muted font-bold">Total Revenue</p>
            <p className="text-2xl font-black text-text-main">₹{customers.reduce((acc, c) => acc + (c.totalSpend || 0), 0).toFixed(0)}</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto bg-surface rounded-2xl border border-border">
        <table className="w-full text-left border-collapse">
          <thead className="bg-background/50 sticky top-0 backdrop-blur-sm z-10">
            <tr>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border">Customer</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border hidden sm:table-cell">Contact</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border">Visits</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border text-right">Total Spend</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border hidden md:table-cell">Last Visit</th>
              <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border hidden lg:table-cell">Favorites</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredCustomers.map(customer => (
              <tr key={customer._id} className="hover:bg-background/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main">{customer.name || 'Guest'}</span>
                    {customer.isVIP && <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">VIP</span>}
                  </div>
                  <div className="sm:hidden text-xs text-text-muted mt-1">{customer.phone}</div>
                </td>
                <td className="p-4 hidden sm:table-cell text-sm text-text-muted font-mono">{customer.phone}</td>
                <td className="p-4 text-sm font-bold text-text-main">{customer.totalVisits}</td>
                <td className="p-4 text-sm font-bold text-success text-right">₹{customer.totalSpend?.toFixed(2) || '0.00'}</td>
                <td className="p-4 hidden md:table-cell text-sm text-text-muted flex items-center gap-1">
                  <Calendar size={14} /> {new Date(customer.lastVisit).toLocaleDateString()}
                </td>
                <td className="p-4 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {customer.favoriteItems?.slice(0, 2).map((item, i) => (
                      <span key={i} className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-text-muted whitespace-nowrap">
                        {item.itemName} ({item.count})
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-text-muted font-medium">No customers found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CRM;
