import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

const languages = [
{ code: 'en', name: 'English', native: 'English' },
{ code: 'hi', name: 'Hindi', native: 'हिंदी' },
{ code: 'te', name: 'Telugu', native: 'తెలుగు' },
{ code: 'ta', name: 'Tamil', native: 'தமிழ்' },
{ code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
{ code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
{ code: 'mr', name: 'Marathi', native: 'मराठी' },
{ code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
{ code: 'bn', name: 'Bengali', native: 'বাংলা' }];


const LanguageSwitcher = () => {const { t } = useLanguage();
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeLang = languages.find((l) => l.code === language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 p-1.5 px-3 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white shadow-sm h-8" title={t("Change Language")}>

        
        <Globe size={16} className="text-gray-500" />
        <span className="text-xs font-bold uppercase tracking-wider">{activeLang.code}</span>
      </button>

      {isOpen &&
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t("Select Language")}</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {languages.map((lang) =>
          <button
            key={lang.code}
            onClick={() => {
              setLanguage(lang.code);
              setIsOpen(false);
            }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
            language === lang.code ? 'text-primary font-bold bg-primary/5' : 'text-gray-700'}`
            }>
            
                <span>{lang.native}</span>
                <span className="text-xs text-gray-400">{lang.name}</span>
              </button>
          )}
          </div>
        </div>
      }
    </div>);

};

export default LanguageSwitcher;