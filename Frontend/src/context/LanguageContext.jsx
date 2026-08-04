import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // Load saved language from localStorage or default to English
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('appLanguage') || 'en';
  });

  // Save language preference whenever it changes
  useEffect(() => {
    localStorage.setItem('appLanguage', language);
  }, [language]);

  const t = (key) => {
    if (!key) return key;

    // Exact match first
    if (translations[language] && translations[language][key]) {
      return translations[language][key];
    }

    // Case-insensitive match for the selected language
    if (translations[language]) {
      const lowerKey = String(key).toLowerCase();
      const match = Object.keys(translations[language]).find(k => k.toLowerCase() === lowerKey);
      if (match) return translations[language][match];
    }

    // Fallback to English if translation is missing in selected language
    if (translations['en'] && translations['en'][key]) {
      return translations['en'][key];
    }

    // Case-insensitive fallback to English
    if (translations['en']) {
      const lowerKey = String(key).toLowerCase();
      const match = Object.keys(translations['en']).find(k => k.toLowerCase() === lowerKey);
      if (match) return translations['en'][match];
    }

    // If all else fails, just return the key itself
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
