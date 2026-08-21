import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', cancelText = 'Cancel', isDanger = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-border overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className={`p-2.5 sm:p-3 rounded-full shrink-0 ${isDanger ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
              <AlertTriangle size={20} className="sm:hidden" />
              <AlertTriangle size={24} className="hidden sm:block" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-text-main mb-1 sm:mb-2">{title}</h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{message}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-text-muted hover:text-text-main transition-colors p-1 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-background border-t border-border flex justify-end gap-2.5 sm:gap-3">
          <button 
            onClick={onClose}
            className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm text-text-muted hover:bg-surface hover:text-text-main transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 sm:flex-initial px-5 py-2.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all active:scale-95 cursor-pointer ${
              isDanger 
                ? 'bg-danger hover:bg-red-600 shadow-danger/20' 
                : 'bg-primary hover:bg-primary-hover shadow-primary/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
