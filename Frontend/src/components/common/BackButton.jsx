import React from 'react';
import { ArrowLeft } from 'lucide-react';

const BackButton = ({ onClick, label = 'Back', className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white bg-[#2a2a3c] hover:bg-[#34344a] rounded-lg transition-colors md:px-4 md:py-2 md:text-base ${className}`}
      aria-label={label}
    >
      <ArrowLeft size={18} className="md:w-5 md:h-5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default BackButton;
