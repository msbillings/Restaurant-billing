import React from 'react';
import { X, Clock, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const EditHistoryModal = ({ bill, onClose }) => {
  const { t } = useLanguage();

  if (!bill || !bill.editHistory || bill.editHistory.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-full overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              {t("Edit History")}
              <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">
                {bill.billNumber || 'Unbilled'}
              </span>
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {t("Table")}: {bill.tableNo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
          <div className="space-y-8">
            {bill.editHistory.map((edit, index) => (
              <div key={index} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                
                {/* Edit Header */}
                <div className="bg-slate-100 px-5 py-3 border-b border-slate-200 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Clock size={16} className="text-slate-500" />
                  {t("Edit")} #{index + 1} - {new Date(edit.editedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium', timeStyle: 'short'
                  })}
                </div>

                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  
                  {/* Before */}
                  <div className="p-5">
                    <h4 className="text-sm font-black text-slate-500 mb-4 uppercase tracking-wider bg-slate-100 inline-block px-2 py-1 rounded">
                      {t("Before Edit")}
                    </h4>
                    
                    <div className="space-y-3">
                      {edit.previousState.items?.map((item, i) => (
                        <div key={i} className="flex justify-between items-start text-sm border-b border-slate-50 pb-2">
                          <div className="font-medium text-slate-700">
                            {item.name} <span className="text-slate-400">x{item.quantity}</span>
                          </div>
                          <div className="font-bold text-slate-800">₹{item.total}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-200 space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{t("Subtotal")}</span>
                        <span>₹{edit.previousState.subtotal || 0}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{t("Tax")}</span>
                        <span>₹{edit.previousState.totalTax || 0}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{t("Discount")}</span>
                        <span>₹{edit.previousState.totalDiscount || 0}</span>
                      </div>
                      <div className="flex justify-between font-black text-slate-800 mt-2 text-base pt-2 border-t border-slate-100">
                        <span>{t("Total")}</span>
                        <span>₹{edit.previousState.total || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* After */}
                  <div className="p-5 bg-orange-50/30">
                    <h4 className="text-sm font-black text-primary mb-4 uppercase tracking-wider bg-orange-100 inline-block px-2 py-1 rounded flex items-center gap-2 w-max">
                      {t("After Edit")}
                    </h4>

                    <div className="space-y-3">
                      {edit.newState.items?.map((item, i) => {
                        // Check if item was newly added or quantity changed
                        const prevItem = edit.previousState.items?.find(p => p.name === item.name);
                        const isNew = !prevItem;
                        const qtyChanged = prevItem && prevItem.quantity !== item.quantity;
                        
                        return (
                          <div key={i} className={`flex justify-between items-start text-sm border-b border-orange-100/50 pb-2 ${isNew || qtyChanged ? 'bg-orange-50/80 -mx-2 px-2 rounded' : ''}`}>
                            <div className={`font-medium ${isNew || qtyChanged ? 'text-primary' : 'text-slate-700'}`}>
                              {item.name} <span className="text-slate-400">x{item.quantity}</span>
                              {qtyChanged && (
                                <span className="text-[10px] ml-2 text-orange-500 bg-orange-100 px-1 rounded">
                                  (was {prevItem.quantity})
                                </span>
                              )}
                              {isNew && (
                                <span className="text-[10px] ml-2 text-emerald-600 bg-emerald-100 px-1 rounded">
                                  {t("NEW")}
                                </span>
                              )}
                            </div>
                            <div className={`font-bold ${isNew || qtyChanged ? 'text-primary' : 'text-slate-800'}`}>₹{item.total}</div>
                          </div>
                        );
                      })}
                      
                      {/* Check for removed items */}
                      {edit.previousState.items?.map((pItem, i) => {
                        const exists = edit.newState.items?.find(n => n.name === pItem.name);
                        if (!exists) {
                          return (
                            <div key={`rem-${i}`} className="flex justify-between items-start text-sm border-b border-red-50 pb-2 bg-red-50/50 -mx-2 px-2 rounded opacity-75">
                              <div className="font-medium text-red-500 line-through">
                                {pItem.name} <span>x{pItem.quantity}</span>
                              </div>
                              <div className="font-bold text-red-500 line-through">₹{pItem.total}</div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-orange-200/50 space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{t("Subtotal")}</span>
                        <span>₹{edit.newState.subtotal || 0}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{t("Tax")}</span>
                        <span>₹{edit.newState.totalTax || 0}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{t("Discount")}</span>
                        <span>₹{edit.newState.totalDiscount || 0}</span>
                      </div>
                      <div className="flex justify-between font-black text-slate-800 mt-2 text-base pt-2 border-t border-orange-200/50">
                        <span>{t("Total")}</span>
                        <div className="flex items-center gap-2">
                           {edit.newState.total !== edit.previousState.total && (
                             <span className={`text-[11px] px-1.5 py-0.5 rounded ${edit.newState.total > edit.previousState.total ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                               {edit.newState.total > edit.previousState.total ? '+' : ''}{edit.newState.total - edit.previousState.total}
                             </span>
                           )}
                           <span className="text-primary">₹{edit.newState.total || 0}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditHistoryModal;