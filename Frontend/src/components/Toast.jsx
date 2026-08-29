import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} className="text-white shrink-0" />,
    error: <AlertCircle size={20} className="text-white shrink-0" />,
    warning: <AlertTriangle size={20} className="text-white shrink-0" />,
    info: <Info size={20} className="text-white shrink-0" />
  };

  const bgColors = {
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
    warning: 'bg-amber-600',
    info: 'bg-blue-600'
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] w-[calc(100%-2rem)] max-w-md pointer-events-none print:hidden">
      <div className={`${bgColors[type] || 'bg-amber-600'} text-white px-5 py-3.5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/20 flex items-center gap-3 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200`}>
        {icons[type] || icons.warning}
        <p className="font-bold text-sm flex-1 leading-snug">{message}</p>
        <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors shrink-0 cursor-pointer">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
