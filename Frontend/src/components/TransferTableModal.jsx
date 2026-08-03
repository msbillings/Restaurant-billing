import { useLanguage } from "../context/LanguageContext";
import React, { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';

const TransferTableModal = ({ floors, currentTable, openOrdersList = [], onClose, onTransfer }) => {
  const { t } = useLanguage();
  
  const activeOrders = openOrdersList.filter(o => o.status === 'Open' || o.status === 'Billed');
  const activeTableNumbers = activeOrders.map(o => o.tableNo);
  
  const initialCurrentTable = activeTableNumbers.includes(currentTable) ? currentTable : '';
  const [selectedCurrentTable, setSelectedCurrentTable] = useState(initialCurrentTable);
  const [newTable, setNewTable] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTable || !selectedCurrentTable || newTable === selectedCurrentTable) return;
    
    // Find the orderId for the selected current table
    const order = activeOrders.find(o => o.tableNo === selectedCurrentTable);
    if (order) {
      onTransfer(newTable, order._id, selectedCurrentTable);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-linear-to-r from-primary/10 to-transparent">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <ArrowRightLeft className="text-primary" size={20} />{t("Transfer Table")}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors text-text-muted hover:text-text-main">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-main">{t("Current Table")}</label>
            <select
              value={selectedCurrentTable}
              onChange={(e) => setSelectedCurrentTable(e.target.value)}
              className="bg-background border border-border rounded-xl px-4 py-3 font-bold text-text-main focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              required>
              <option value="" disabled>{t("Select Current Table")}</option>
              {activeOrders.map(order => (
                <option key={order._id} value={order.tableNo}>{order.tableNo}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-main">{t("Transfer To Table")}</label>
            <select
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              className="bg-background border border-border rounded-xl px-4 py-3 font-bold text-text-main focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              required>
              <option value="" disabled>{t("Select New Table")}</option>
              {floors.map((floor) => {
                const hasItems = floor.tables?.length > 0 || floor.cabins?.length > 0 || floor.sofas?.length > 0;
                if (!hasItems) return null;
                
                // Check if any table in this floor is available
                const availableTables = floor.tables?.filter(t => !activeTableNumbers.includes(`${floor.name} - ${t.name}`)) || [];
                const availableCabins = floor.cabins?.filter(c => !activeTableNumbers.includes(`${floor.name} - ${c.name}`)) || [];
                const availableSofas = floor.sofas?.filter(s => !activeTableNumbers.includes(`${floor.name} - ${s.name}`)) || [];
                
                if (availableTables.length === 0 && availableCabins.length === 0 && availableSofas.length === 0) return null;

                return (
                  <optgroup key={floor.id} label={floor.name}>
                    {availableTables.map((tableObj) => {
                      const val = `${floor.name} - ${tableObj.name}`;
                      return <option key={`t-${tableObj.id}`} value={val} disabled={val === selectedCurrentTable}>{tableObj.name} {t("(Table)")}</option>;
                    })}
                    {availableCabins.map((c) => {
                      const val = `${floor.name} - ${c.name}`;
                      return <option key={`c-${c.id}`} value={val} disabled={val === selectedCurrentTable}>{c.name} {t("(Cabin)")}</option>;
                    })}
                    {availableSofas.map((s) => {
                      const val = `${floor.name} - ${s.name}`;
                      return <option key={`s-${s.id}`} value={val} disabled={val === selectedCurrentTable}>{s.name} {t("(Sofa)")}</option>;
                    })}
                  </optgroup>
                );
              })}
              {/* Fallback */}
              {floors.length === 0 && [...Array(20)].map((_, i) => {
                const val = `TBL-${String(i + 1).padStart(2, '0')}`;
                if (activeTableNumbers.includes(val)) return null;
                return (
                  <option key={i} value={val} disabled={val === selectedCurrentTable}>{t("Table")} {String(i + 1).padStart(2, '0')}</option>
                );
              })}
            </select>
          </div>

          <button
            type="submit"
            disabled={!newTable || !selectedCurrentTable || newTable === selectedCurrentTable}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2">
            <ArrowRightLeft size={18} />{t("Transfer Order")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransferTableModal;