import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', cancelText = 'Cancel', isDanger = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDanger ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-text-main mb-2">{title}</h3>
              <p className="text-text-muted leading-relaxed">{message}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-text-muted hover:text-text-main transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 bg-background border-t border-border flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-medium text-text-muted hover:bg-surface hover:text-text-main transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${
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
