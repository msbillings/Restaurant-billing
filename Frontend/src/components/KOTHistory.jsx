import React, { useState, useEffect } from 'react';
import { apiGetTodayKOTs } from '../api/billing';
import { Printer, Calendar, Search, FileText } from 'lucide-react';
import KOT from './KOT';
import Toast from './Toast';
import useDebounce from '../hooks/useDebounce';

const KOTHistory = () => {
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKOT, setSelectedKOT] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchKOTs();
  }, [debouncedSearchTerm, selectedDate]);

  const fetchKOTs = async () => {
    try {
      setLoading(true);
      const data = await apiGetTodayKOTs(selectedDate, debouncedSearchTerm);
      setKots(data || []);
    } catch (error) {
      console.error('Error fetching KOTs:', error);
      setToast({ message: 'Failed to load KOT history', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = (kot) => {
    setSelectedKOT(kot);
  };

  const getItemsSummary = (items) => {
    if (!items || items.length === 0) return 'No items';
    const summary = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
    return summary.length > 50 ? summary.substring(0, 47) + '...' : summary;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header and Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-surface border-b border-border shrink-0 z-10 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 shadow-sm border border-orange-200">
            <Printer size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-main font-mono tracking-tight">KOT History</h1>
            <p className="text-xs text-text-muted font-medium">Kitchen Order Tickets</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search KOT or Table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-text-main focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium"
            />
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>

          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-text-main focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-medium appearance-none"
            />
            <Calendar size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6 flex flex-col">
        {loading ? (
          <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
             <div className="p-4 border-b border-border flex items-center gap-4">
               <div className="h-6 bg-text-muted/20 rounded w-1/4 animate-pulse"></div>
               <div className="h-6 bg-text-muted/20 rounded w-1/4 animate-pulse"></div>
               <div className="h-6 bg-text-muted/20 rounded w-1/4 animate-pulse"></div>
             </div>
             {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 border-b border-border flex items-center gap-4">
                  <div className="h-4 bg-text-muted/20 rounded w-1/6 animate-pulse"></div>
                  <div className="h-4 bg-text-muted/20 rounded w-1/4 animate-pulse"></div>
                  <div className="h-4 bg-text-muted/20 rounded w-1/3 animate-pulse"></div>
                  <div className="h-4 bg-text-muted/20 rounded w-1/6 animate-pulse"></div>
                </div>
             ))}
          </div>
        ) : kots.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl flex-1 flex flex-col items-center justify-center text-text-muted shadow-sm">
            <FileText size={48} className="opacity-20 mb-4" />
            <p className="font-mono text-lg">No KOTs found.</p>
            <p className="text-sm">Try adjusting your filters or search.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-background sticky top-0 z-10 shadow-sm border-b border-border">
                  <tr>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider">KOT No</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider">Time</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider">Table / Order</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider hidden md:table-cell">Items Summary</th>
                    <th className="p-4 font-bold text-xs uppercase text-text-muted tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {kots.map((kot) => (
                    <tr key={`${kot.billId}-${kot.kotNumber}`} className="hover:bg-background/50 transition-colors group">
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg font-mono shadow-sm border ${
                          kot.kotNumber.startsWith('CANCEL') 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          {kot.kotNumber}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-mono font-medium text-text-main">
                          {new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-bold text-text-main">{kot.tableNo}</span>
                      </td>
                      <td className="p-4 w-full max-w-xs hidden md:table-cell">
                        <p className="text-sm font-medium text-text-muted truncate">
                          {getItemsSummary(kot.items)}
                        </p>
                      </td>
                      <td className="p-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleReprint(kot)}
                          className="px-3 py-1.5 bg-surface hover:bg-orange-50 text-orange-600 font-bold text-sm rounded-lg border border-border hover:border-orange-200 transition-all inline-flex items-center gap-2 group-hover:bg-orange-600 group-hover:text-white"
                        >
                          <Printer size={14} />
                          Reprint
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Footer Summary */}
            <div className="bg-background border-t border-border p-4 flex justify-between items-center text-sm font-medium text-text-muted">
              <span>Showing {kots.length} KOTs</span>
              <span>Date: {selectedDate}</span>
            </div>
          </div>
        )}
      </div>

      {selectedKOT && (
        <KOT 
          order={selectedKOT}
          onClose={() => setSelectedKOT(null)}
        />
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
};

export default KOTHistory;
