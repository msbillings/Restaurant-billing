import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

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
    success: <CheckCircle size={20} className="text-white" />,
    error: <AlertCircle size={20} className="text-white" />,
    info: <Info size={20} className="text-white" />
  };

  const bgColors = {
    success: 'bg-success',
    error: 'bg-danger',
    info: 'bg-primary'
  };

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm pointer-events-none print:hidden">
      <div className={`${bgColors[type]} text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto animate-in slide-in-from-top-3 fade-in duration-200`}>
        {icons[type]}
        <p className="font-semibold text-sm flex-1">{message}</p>
        <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
