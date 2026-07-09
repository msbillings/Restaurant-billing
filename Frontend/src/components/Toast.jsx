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
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300 print:hidden">
      <div className={`${bgColors[type]} text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 min-w-[300px] max-w-md`}>
        {icons[type]}
        <p className="font-medium text-sm flex-1">{message}</p>
        <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
