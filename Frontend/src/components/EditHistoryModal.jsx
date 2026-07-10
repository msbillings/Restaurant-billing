import React from 'react';
import { X, Clock, ArrowRight, FileSignature } from 'lucide-react';

const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

const EditHistoryModal = ({ order, onClose }) => {
  if (!order || !order.editHistory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-border">
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-background">
          <div>
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
              <FileSignature className="text-primary" size={24} />
              Audit Trail: {order.billNumber || order.tableNo}
            </h2>
            <p className="text-sm text-text-muted mt-1">Detailed history of all modifications to this order</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-xl text-text-muted hover:text-text-main transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-surface space-y-6">
          {order.editHistory.length === 0 ? (
            <div className="text-center text-text-muted py-10">No edit history recorded for this bill.</div>
          ) : (
            order.editHistory.map((edit, idx) => (
              <div key={idx} className="border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-background px-4 py-3 border-b border-border flex justify-between items-center">
                  <span className="font-bold text-text-main text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                      #{idx + 1}
                    </span>
                    Edit Snapshot
                  </span>
                  <span className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                    <Clock size={14} />
                    {new Date(edit.editedAt).toLocaleString()}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                  {/* Before */}
                  <div className="p-4 bg-red-50/10">
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 text-red-500">Before Edit</h4>
                    <div className="space-y-2 mb-4">
                      {edit.previousState?.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-text-main">{item.quantity}x {item.name}</span>
                          <span className="text-text-muted">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                      {(!edit.previousState?.items || edit.previousState.items.length === 0) && (
                        <div className="text-sm text-text-muted italic">No items</div>
                      )}
                    </div>
                    <div className="border-t border-border/50 pt-3 space-y-1">
                      <div className="flex justify-between text-xs text-text-muted">
                        <span>Subtotal</span>
                        <span>{formatCurrency(edit.previousState?.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-text-muted">
                        <span>Discount</span>
                        <span>-{formatCurrency(edit.previousState?.totalDiscount)}</span>
                      </div>
                      {edit.previousState?.totalTax > 0 && (
                        <div className="flex justify-between text-xs text-text-muted">
                          <span>Tax</span>
                          <span>+{formatCurrency(edit.previousState?.totalTax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm text-text-main mt-1 pt-1 border-t border-border/50">
                        <span>Total</span>
                        <span className="text-red-600">{formatCurrency(edit.previousState?.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* After */}
                  <div className="p-4 bg-green-50/10 relative">
                    <div className="absolute left-1/2 -translate-x-1/2 -top-3 md:-left-3 md:top-1/2 md:-translate-y-1/2 w-6 h-6 bg-surface border border-border rounded-full flex items-center justify-center z-10 hidden md:flex">
                      <ArrowRight size={14} className="text-text-muted" />
                    </div>
                    
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 text-green-500">After Edit</h4>
                    <div className="space-y-2 mb-4">
                      {edit.newState?.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-text-main font-medium">{item.quantity}x {item.name}</span>
                          <span className="text-text-muted">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                      {(!edit.newState?.items || edit.newState.items.length === 0) && (
                        <div className="text-sm text-text-muted italic">No items</div>
                      )}
                    </div>
                    <div className="border-t border-border/50 pt-3 space-y-1">
                      <div className="flex justify-between text-xs text-text-muted">
                        <span>Subtotal</span>
                        <span>{formatCurrency(edit.newState?.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-text-muted">
                        <span>Discount</span>
                        <span>-{formatCurrency(edit.newState?.totalDiscount)}</span>
                      </div>
                      {edit.newState?.totalTax > 0 && (
                        <div className="flex justify-between text-xs text-text-muted">
                          <span>Tax</span>
                          <span>+{formatCurrency(edit.newState?.totalTax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm text-text-main mt-1 pt-1 border-t border-border/50">
                        <span>Total</span>
                        <span className="text-green-600">{formatCurrency(edit.newState?.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EditHistoryModal;
