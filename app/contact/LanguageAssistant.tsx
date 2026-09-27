"use client";

import ReactCountryFlag from "react-country-flag";
import { Languages } from "lucide-react";
import { trackEvent } from "@/utils/mixpanel";
import AssistantModalShell from "./AssistantModalShell";

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

const LANGUAGES: Language[] = [
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
  {
    name: "Australian English",
    code: "en",
    flagCode: "AU",
    key: "en-AU",
    context: "natural Australian English with recognizable regional expressions and slang",
  },
  {
    name: "Cockney English",
    code: "en",
    flagCode: "GB",
    key: "en-GB-2",
    context: "natural Cockney English with recognizable phrasing and rhyming slang",
  },
  {
    name: "Southern US English",
    code: "en",
    flagCode: "US",
    key: "en-US",
    context: "warm Southern US English with natural regional expressions",
  },
  {
    name: "Millennial",
    code: "en",
    flagCode: "UN",
    key: "en-US-1",
    context: "conversational millennial phrasing with natural contemporary expressions",
  },
  {
    name: "Gen Z",
    code: "en",
    flagCode: "UN",
    key: "en-US-2",
    context: "conversational Gen Z phrasing with natural current expressions",
  },
  {
    name: "Baby Boomer",
    code: "en",
    flagCode: "UN",
    key: "en-US-3",
    context: "clear conversational phrasing associated with the baby boomer generation",
  },
];

export default function LanguageAssistant({ onTranslate, onClose }: LanguageAssistantProps) {
  function handleLanguageSelect(language: Language) {
    trackEvent("Language Translation Clicked", { language: language.name });
    onTranslate(language);
  }

  return (
    <AssistantModalShell
      title="Language"
      icon={<Languages className="h-4 w-4" />}
      onClose={onClose}
    >
      <div className="no-scrollbar max-h-[390px] overflow-y-auto">
        <ul className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((language) => (
            <li key={language.key}>
              <button
                type="button"
                className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-slate-200/80 bg-white/40 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-300 dark:hover:border-indigo-400/20 dark:hover:bg-indigo-400/[0.06] dark:hover:text-indigo-200"
                onClick={() => handleLanguageSelect(language)}
              >
                <ReactCountryFlag
                  countryCode={language.flagCode}
                  style={{ fontSize: "1rem", lineHeight: "1rem" }}
                  aria-label={language.name}
                />
                <span className="min-w-0 truncate">{language.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AssistantModalShell>
  );
}
