import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const BackButton = ({ onClick, label = 'Back', className = '' }) => {
  const { t } = useLanguage();
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors md:px-4 md:py-2 md:text-base ${className}`}
      aria-label={t(label)}
    >
      <ArrowLeft size={18} className="md:w-5 md:h-5" />
      <span className="hidden sm:inline">{t(label)}</span>
    </button>
  );
};

export default BackButton;
