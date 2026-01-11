// app/contact/MoodToneAssistant.tsx
"use client";

import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPeace,
  faSmile,
  faFrown,
  faAngry,
  faLaugh,
  faHandshake,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { trackEvent } from "@/utils/mixpanel";

interface MoodToneAssistantProps {
  currentText: string;
  onEnhance: (mood: string, tone: string) => void;
  onDefaultEnhance: () => void;
  onClose: () => void;
}

type Option = { label: string; icon?: any };

const moods: Option[] = [
  { label: "Neutral", icon: faPeace },
  { label: "Happy", icon: faSmile },
  { label: "Sad", icon: faFrown },
  { label: "Angry", icon: faAngry },
  { label: "Excited", icon: faLaugh },
  { label: "Concerned", icon: faHandshake },
];

const tones: Option[] = [
  { label: "Formal" },
  { label: "Informal" },
  { label: "Friendly" },
  { label: "Serious" },
  { label: "Humorous" },
  { label: "Respectful" },
];

export default function MoodToneAssistant({
  onEnhance,
  onDefaultEnhance,
  onClose,
}: MoodToneAssistantProps) {
  const [selectedMood, setSelectedMood] = useState("Neutral");
  const [selectedTone, setSelectedTone] = useState("Formal");

  const finalMood = useMemo(() => selectedMood, [selectedMood]);
  const finalTone = useMemo(() => selectedTone, [selectedTone]);

  const pickBtn =
    "w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500/60";

  const isSelected = (active: boolean) =>
    active
      ? "border-transparent bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm"
      : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10";

  const handleEnhanceClick = () => {
    trackEvent("MoodTone Enhance Button Clicked", {
      mood: finalMood,
      tone: finalTone,
    });
    onEnhance(finalMood, finalTone);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Mood and Tone"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-brand-900">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Mood &amp; tone
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Make your message sound exactly right.
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
          {/* Default enhance */}
          <button
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition"
            type="button"
            onClick={() => {
              trackEvent("Default Enhance Button Clicked");
              onDefaultEnhance();
            }}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              Enhance as a professional message
            </span>
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Or customize
            </div>
            <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
          </div>

          {/* Mood Section */}
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-indigo-600 to-purple-600" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100">
                Select a mood
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {moods.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  className={pickBtn + " " + isSelected(selectedMood === m.label)}
                  onClick={() => setSelectedMood(m.label)}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {m.icon && <FontAwesomeIcon icon={m.icon} />}
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone Section */}
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-indigo-600 to-purple-600" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100">
                Select a tone
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {tones.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className={pickBtn + " " + isSelected(selectedTone === t.label)}
                  onClick={() => setSelectedTone(t.label)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            className="mt-8 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition"
            onClick={handleEnhanceClick}
          >
            Enhance with chosen mood &amp; tone
          </button>
        </div>
      </div>
    </div>
  );
}
