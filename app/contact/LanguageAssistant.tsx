import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import ReactCountryFlag from "react-country-flag";
import { trackEvent } from '@/utils/mixpanel';

interface Language {
  name: string;
  code: string;
  flagCode: string;
  key: string;
  context?: string;
}

interface LanguageAssistantProps {
  currentText: string;
  onTranslate: (language: Language) => void;
  onClose: () => void;
}

const languages: Language[] = [
  { name: 'English', code: 'en', flagCode: 'GB', key: 'en-GB' },
  { name: 'Spanish', code: 'es', flagCode: 'ES', key: 'es-ES' },
  { name: 'French', code: 'fr', flagCode: 'FR', key: 'fr-FR' },
  { name: 'Italian', code: 'it', flagCode: 'IT', key: 'it-IT' },
  { name: 'Latin Spanish', code: 'es', flagCode: 'MX', key: 'es-MX' },
  { name: 'Greek', code: 'el', flagCode: 'GR', key: 'el-GR' },
  { name: 'German', code: 'de', flagCode: 'DE', key: 'de-DE' },
  { name: 'Punjabi', code: 'pa', flagCode: 'IN', key: 'pa-IN' },
  { name: 'Mandarin Chinese', code: 'zh', flagCode: 'CN', key: 'zh-CN' },
  { name: 'Cantonese Chinese', code: 'zh', flagCode: 'HK', key: 'zh-HK' },
  { name: 'Japanese', code: 'ja', flagCode: 'JP', key: 'ja-JP' },
  { name: 'Hindi', code: 'hi', flagCode: 'IN', key: 'hi-IN' },
  { name: 'Russian', code: 'ru', flagCode: 'RU', key: 'ru-RU' },
  { name: 'Portuguese', code: 'pt', flagCode: 'PT', key: 'pt-PT' },
  { name: 'Arabic', code: 'ar', flagCode: 'SA', key: 'ar-SA' },
  { name: 'Hebrew', code: 'he', flagCode: 'IL', key: 'he-IL' },
  { name: 'Australian Slang', code: 'en', flagCode: 'AU', key: 'en-AU', context: 'real Aussie lingo, dont hold back with the slang words, make it sound like a drunk Australian slob' },
  { name: 'Cockney British', code: 'en', flagCode: 'GB', key: 'en-GB-2', context: 'real Cockney British lingo, dont hold back with the slang words and lack of teeth' },
  { name: 'American Southern', code: 'en', flagCode: 'US', key: 'en-US', context: 'real American southern bell lingo with slang words' },
  { name: 'millennial', code: 'en', flagCode: 'UN', key: 'en-US-1', context: 'real millennial slang words & lingo, dont hold back on making it sound really millennial sounding' },
  { name: 'Generation Z', code: 'en', flagCode: 'UN', key: 'en-US-2', context: 'real Generation Z slang words & lingo, dont hold back on making it sound really Generation Z sounding make it emo' },
  { name: 'boomer', code: 'en', flagCode: 'UN', key: 'en-US-3', context: 'real boomer talk & slang words & lingo, dont hold back on making it sound really boomer sounding' },
];

const LanguageAssistant: React.FC<LanguageAssistantProps> = ({ currentText, onTranslate, onClose }) => {
  const [loading, setLoading] = useState(false);

  const handleLanguageChange = (language: Language) => {
    trackEvent('Language Translation Clicked', { language: language.name });
    onTranslate(language);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded p-6 w-full max-w-md">
        <div className="flex justify-end">
          <button className="text-gray-700 dark:text-gray-300 text-2xl" onClick={onClose}>
            &times;
          </button>
        </div>
        <h2 className="text-xl font-semibold mb-4 text-center">Select Language</h2>
        <div className="max-h-64 overflow-y-auto">
          <ul className="space-y-2">
            {languages.map((language) => (
              <li key={language.key}>
                <button
                  type="button"
                  className="flex items-center w-full p-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  onClick={() => handleLanguageChange(language)}
                >
                  <ReactCountryFlag
                    countryCode={language.flagCode}
                    svg
                    style={{ marginRight: '10px', width: '2em', height: '2em' }}
                  />
                  {language.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-white" />
        </div>
      )}
    </div>
  );
};

export default LanguageAssistant;
