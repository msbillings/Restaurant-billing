import React, { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';

const TransferTableModal = ({ floors, currentTable, onClose, onTransfer }) => {
  const [newTable, setNewTable] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTable || newTable === currentTable) return;
    onTransfer(newTable);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-gradient-to-r from-primary/10 to-transparent">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <ArrowRightLeft className="text-primary" size={20} />
            Transfer Table
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors text-text-muted hover:text-text-main"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-main">
              Current Table
            </label>
            <div className="bg-background border border-border rounded-xl px-4 py-3 text-text-muted font-bold">
              {currentTable}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-main">
              Transfer To Table
            </label>
            <select 
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              className="bg-background border border-border rounded-xl px-4 py-3 font-bold text-text-main focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              required
            >
              <option value="" disabled>Select New Table</option>
              {floors.map(floor => {
                const hasItems = floor.tables?.length > 0 || floor.cabins?.length > 0 || floor.sofas?.length > 0;
                if (!hasItems) return null;
                return (
                  <optgroup key={floor.id} label={floor.name}>
                    {floor.tables?.map(t => {
                      const val = `${floor.name} - ${t.name}`;
                      return <option key={`t-${t.id}`} value={val} disabled={val === currentTable}>{t.name} (Table)</option>
                    })}
                    {floor.cabins?.map(c => {
                      const val = `${floor.name} - ${c.name}`;
                      return <option key={`c-${c.id}`} value={val} disabled={val === currentTable}>{c.name} (Cabin)</option>
                    })}
                    {floor.sofas?.map(s => {
                      const val = `${floor.name} - ${s.name}`;
                      return <option key={`s-${s.id}`} value={val} disabled={val === currentTable}>{s.name} (Sofa)</option>
                    })}
                  </optgroup>
                );
              })}
              {/* Fallback */}
              {floors.length === 0 && [...Array(20)].map((_, i) => (
                <option key={i} value={`TBL-${String(i + 1).padStart(2, '0')}`} disabled={`TBL-${String(i + 1).padStart(2, '0')}` === currentTable}>
                  Table {String(i + 1).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          <button 
            type="submit"
            disabled={!newTable || newTable === currentTable}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
          >
            <ArrowRightLeft size={18} />
            Transfer Order
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransferTableModal;
