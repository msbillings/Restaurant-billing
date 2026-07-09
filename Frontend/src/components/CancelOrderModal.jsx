import React, { useState } from 'react';
import { X, ShieldAlert, FileText, Eye, EyeOff } from 'lucide-react';

const CancelOrderModal = ({ isOpen, onClose, onConfirm, validPin }) => {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (pin !== validPin) {
      setError('Invalid PIN. Cancellation denied.');
      return;
    }

    if (!reason.trim()) {
      setError('Cancellation reason is required.');
      return;
    }

    onConfirm(reason);
    setPin('');
    setReason('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-danger/10 p-4 border-b border-danger/20 flex justify-between items-center">
          <div className="flex items-center gap-3 text-danger font-bold text-lg">
            <ShieldAlert size={24} />
            <h2>Cancel Order</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-text-muted hover:text-text-main transition-colors p-1 rounded-lg hover:bg-background"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-danger/10 text-danger text-sm p-3 rounded-lg border border-danger/20">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={14} /> Owner / Admin PIN
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter PIN to authorize"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-danger transition-colors text-text-main"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <FileText size={14} /> Cancellation Reason
            </label>
            <textarea
              placeholder="Please explain why this order is being cancelled..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-danger transition-colors text-text-main resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold text-text-muted bg-background hover:bg-border/50 border border-border transition-colors"
            >
              Keep Order
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 shadow-lg shadow-danger/20 transition-all active:scale-[0.98]"
            >
              Confirm Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CancelOrderModal;
