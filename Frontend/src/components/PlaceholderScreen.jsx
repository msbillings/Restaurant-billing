import { useLanguage } from "../context/LanguageContext";import React from 'react';
import { ArrowLeft, Clock, Wrench } from 'lucide-react';
import BackButton from './common/BackButton';

const PlaceholderScreen = ({ onNavigate, onGoBack, title, description, icon: Icon = Wrench }) => {const { t } = useLanguage();
  return (
    <div className="h-full flex flex-col bg-gray-50 p-6">
      <div className="flex items-center gap-4 mb-8">
        <BackButton onClick={onGoBack} />
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          {title}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
          <Icon size={48} strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-black text-gray-800 mb-4">{title}</h2>
        <p className="text-gray-500 max-w-md text-lg mb-8">
          {description || "This feature is currently under active development. Stay tuned for upcoming updates!"}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-full font-bold text-sm border border-amber-200">
          <Clock size={16} />{t("Coming Soon in Next Update")}
        </div>
      </div>
    </div>);

};

export default PlaceholderScreen;