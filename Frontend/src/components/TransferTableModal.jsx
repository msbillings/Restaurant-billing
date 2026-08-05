import { useLanguage } from "../context/LanguageContext";
import React, { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';

const TransferTableModal = ({ floors, currentTable, currentOrderId, openOrdersList = [], onClose, onTransfer }) => {
  const { t } = useLanguage();

  const activeOrders = openOrdersList.filter(o => o.status === 'Open' || o.status === 'Billed');
  const activeTableNumbers = activeOrders.map(o => o.tableNo);

  const [newTable, setNewTable] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTable || !currentTable || newTable === currentTable) return;

    // Find the orderId for the current table
    let orderId = currentOrderId;
    if (!orderId) {
      const order = activeOrders.find(o => o.tableNo === currentTable);
      orderId = order?._id;
    }

    if (orderId) {
      onTransfer(newTable, orderId, currentTable);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
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
              value={currentTable}
              disabled
              className="bg-background border border-border rounded-xl px-4 py-3 font-bold text-text-main focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all opacity-80 cursor-not-allowed appearance-none"
              required>
              <option value={currentTable}>{currentTable || t("Select Current Table")}</option>
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
                const hasItems = floor.tables?.length > 0 || floor.cabins?.length > 0 || floor.sofas?.length > 0 || floor.spaces?.length > 0;
                if (!hasItems) return null;

                // Check if any table in this floor is available
                const availableTables = floor.tables?.filter(t => !activeTableNumbers.includes(t.name)) || [];
                const availableCabins = floor.cabins?.filter(c => !activeTableNumbers.includes(c.name)) || [];
                const availableSofas = floor.sofas?.filter(s => !activeTableNumbers.includes(s.name)) || [];
                const availableSpaces = floor.spaces?.filter(sp => !activeTableNumbers.includes(sp.name)) || [];

                if (availableTables.length === 0 && availableCabins.length === 0 && availableSofas.length === 0 && availableSpaces.length === 0) return null;

                return (
                  <optgroup key={floor.id} label={floor.name}>
                    {availableTables.map((tableObj) => {
                      const val = tableObj.name;
                      return <option key={`t-${tableObj.id}`} value={val} disabled={val === currentTable}>{tableObj.name} {t("(Table)")}</option>;
                    })}
                    {availableCabins.map((c) => {
                      const val = c.name;
                      return <option key={`c-${c.id}`} value={val} disabled={val === currentTable}>{c.name} {t("(Cabin)")}</option>;
                    })}
                    {availableSofas.map((s) => {
                      const val = s.name;
                      return <option key={`s-${s.id}`} value={val} disabled={val === currentTable}>{s.name} {t("(Sofa)")}</option>;
                    })}
                    {availableSpaces.map((sp) => {
                      const val = sp.name;
                      return <option key={`sp-${sp.id}`} value={val} disabled={val === currentTable}>{sp.name} {t(`(${sp.type || 'Space'})`)}</option>;
                    })}
                  </optgroup>
                );
              })}
              {/* Fallback */}
              {floors.length === 0 && [...Array(20)].map((_, i) => {
                const val = `TBL-${String(i + 1).padStart(2, '0')}`;
                if (activeTableNumbers.includes(val)) return null;
                return (
                  <option key={i} value={val} disabled={val === currentTable}>{t("Table")} {String(i + 1).padStart(2, '0')}</option>
                );
              })}
            </select>
          </div>

          <button
            type="submit"
            disabled={!newTable || !currentTable || newTable === currentTable}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2">
            <ArrowRightLeft size={18} />{t("Transfer Order")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransferTableModal;