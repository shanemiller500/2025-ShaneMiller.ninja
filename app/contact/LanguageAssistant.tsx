// app/contact/LanguageAssistant.tsx
"use client";

import React, { useMemo, useState } from "react";
import ReactCountryFlag from "react-country-flag";
import { trackEvent } from "@/utils/mixpanel";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

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
  { name: "English", code: "en", flagCode: "GB", key: "en-GB" },
  { name: "Spanish", code: "es", flagCode: "ES", key: "es-ES" },
  { name: "French", code: "fr", flagCode: "FR", key: "fr-FR" },
  { name: "Italian", code: "it", flagCode: "IT", key: "it-IT" },
  { name: "Latin Spanish", code: "es", flagCode: "MX", key: "es-MX" },
  { name: "Greek", code: "el", flagCode: "GR", key: "el-GR" },
  { name: "German", code: "de", flagCode: "DE", key: "de-DE" },
  { name: "Punjabi", code: "pa", flagCode: "IN", key: "pa-IN" },
  { name: "Mandarin Chinese", code: "zh", flagCode: "CN", key: "zh-CN" },
  { name: "Cantonese Chinese", code: "zh", flagCode: "HK", key: "zh-HK" },
  { name: "Japanese", code: "ja", flagCode: "JP", key: "ja-JP" },
  { name: "Hindi", code: "hi", flagCode: "IN", key: "hi-IN" },
  { name: "Russian", code: "ru", flagCode: "RU", key: "ru-RU" },
  { name: "Portuguese", code: "pt", flagCode: "PT", key: "pt-PT" },
  { name: "Arabic", code: "ar", flagCode: "SA", key: "ar-SA" },
  { name: "Hebrew", code: "he", flagCode: "IL", key: "he-IL" },

  // fun variants (kept)
  {
    name: "Australian Slang",
    code: "en",
    flagCode: "AU",
    key: "en-AU",
    context: "real Aussie lingo, dont hold back with the slang words, make it sound like a drunk Australian slob",
  },
  {
    name: "Cockney British",
    code: "en",
    flagCode: "GB",
    key: "en-GB-2",
    context: "real Cockney British lingo, dont hold back with the slang words and lack of teeth",
  },
  {
    name: "American Southern",
    code: "en",
    flagCode: "US",
    key: "en-US",
    context: "real American southern bell lingo with slang words",
  },
  {
    name: "millennial",
    code: "en",
    flagCode: "UN",
    key: "en-US-1",
    context: "real millennial slang words & lingo, dont hold back on making it sound really millennial sounding",
  },
  {
    name: "Generation Z",
    code: "en",
    flagCode: "UN",
    key: "en-US-2",
    context: "real Generation Z slang words & lingo, dont hold back on making it sound really Generation Z sounding make it emo",
  },
  {
    name: "boomer",
    code: "en",
    flagCode: "UN",
    key: "en-US-3",
    context: "real boomer talk & slang words & lingo, dont hold back on making it sound really boomer sounding",
  },
];

export default function LanguageAssistant({ onTranslate, onClose }: LanguageAssistantProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter((l) => l.name.toLowerCase().includes(q));
  }, [query]);

  const handleLanguageChange = (language: Language) => {
    trackEvent("Language Translation Clicked", { language: language.name });
    onTranslate(language);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Select Language"
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-brand-900">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Select language</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Translate your message with one tap.
            </p>
          </div>
          <button
            className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 dark:text-gray-200 dark:hover:bg-white/10"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          
          <div className="mt-4 max-h-[320px] overflow-y-auto pr-1">
            <ul className="space-y-2">
              {filtered.map((language) => (
                <li key={language.key}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
                    onClick={() => handleLanguageChange(language)}
                  >
                    <ReactCountryFlag
                      countryCode={language.flagCode}
                      svg
                      style={{ width: "1.6em", height: "1.6em" }}
                      aria-label={language.name}
                    />
                    <span className="flex-1">{language.name}</span>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{language.code}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                  No matches. Try a different search.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
