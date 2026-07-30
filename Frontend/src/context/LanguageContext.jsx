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

  // Translation function
  const t = (key) => {
    // If the language dictionary exists and the key exists, return it
    if (translations[language] && translations[language][key]) {
      return translations[language][key];
    }
    // Fallback to English if translation is missing in selected language
    if (translations['en'] && translations['en'][key]) {
      return translations['en'][key];
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
