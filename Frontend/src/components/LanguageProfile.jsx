import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import { ArrowLeft, Save, Languages, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const LanguageProfile = ({ onNavigate }) => {const { t } = useLanguage();
  const { language: currentLanguage, setLanguage: changeLanguage } = useLanguage();
  const [selectedLang, setSelectedLang] = useState(currentLanguage || 'en');

  const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' }];


  useEffect(() => {
    setSelectedLang(currentLanguage);
  }, [currentLanguage]);

  const handleSave = () => {
    changeLanguage(selectedLang);
    // In a real app, this would also save to the User's DB profile via API
    alert('Language Profile saved successfully! Your POS will now default to this language on login.');
    onNavigate('operations');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Languages className="text-primary" />{t("Language Profiles")}
            </h1>
            <p className="text-sm text-gray-500">{t("Set the default interface language for your personal account")}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-sm">
          
          <Save size={18} />{t("Save Profile")}
        </button>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col md:flex-row gap-8">
        
        <div className="w-full md:w-1/3 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 pb-8 md:pb-0 pr-0 md:pr-8">
          <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <User size={64} />
          </div>
          <h2 className="text-xl font-bold text-gray-800">{t("Current User")}</h2>
          <p className="text-gray-500 text-sm">{t("Personal Interface Settings")}</p>
          <div className="mt-6 w-full p-4 bg-primary/10 rounded-lg text-center">
            <span className="block text-xs font-bold text-primary uppercase mb-1">{t("Active Profile Language")}</span>
            <span className="font-bold text-gray-800">{languages.find((l) => l.code === selectedLang)?.name || 'English'}</span>
          </div>
        </div>

        <div className="w-full md:w-2/3">
          <h3 className="text-lg font-bold text-gray-800 mb-6">{t("Select your preferred language")}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {languages.map((lang) =>
            <button
              key={lang.code}
              onClick={() => setSelectedLang(lang.code)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedLang === lang.code ?
              'border-primary bg-primary/5' :
              'border-gray-200 hover:border-primary/50'}`
              }>
              
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-bold ${selectedLang === lang.code ? 'text-primary' : 'text-gray-700'}`}>
                      {lang.name}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{lang.nativeName}</div>
                  </div>
                  {selectedLang === lang.code &&
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                }
                </div>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>);

};

export default LanguageProfile;