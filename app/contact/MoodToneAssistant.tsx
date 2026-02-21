"use client";

import { useState } from "react";
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
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Button } from "@/components/ui/button";

interface MoodToneAssistantProps {
  currentText: string;
  onEnhance: (mood: string, tone: string) => void;
  onDefaultEnhance: () => void;
  onClose: () => void;
}

interface MoodOption {
  label: string;
  icon: IconDefinition;
}

interface ToneOption {
  label: string;
}

const MOODS: MoodOption[] = [
  { label: "Neutral", icon: faPeace },
  { label: "Happy", icon: faSmile },
  { label: "Sad", icon: faFrown },
  { label: "Angry", icon: faAngry },
  { label: "Excited", icon: faLaugh },
  { label: "Concerned", icon: faHandshake },
];

const TONES: ToneOption[] = [
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

  function handleEnhanceClick() {
    trackEvent("MoodTone Enhance Button Clicked", {
      mood: selectedMood,
      tone: selectedTone,
    });
    onEnhance(selectedMood, selectedTone);
  }

  function handleDefaultEnhanceClick() {
    trackEvent("Default Enhance Button Clicked");
    onDefaultEnhance();
  }

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
        <ModalHeader onClose={onClose} />

        <div className="p-5">
          <Button
            variant="indigo"
            size="lg"
            fullWidth
            type="button"
            onClick={handleDefaultEnhanceClick}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              Enhance as a professional message
            </span>
          </Button>

          <Divider text="Or customize" />

          <SelectionSection title="Select a mood">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MOODS.map((mood) => (
                <Button
                  key={mood.label}
                  type="button"
                  variant="selection"
                  active={selectedMood === mood.label}
                  size="lg"
                  fullWidth
                  onClick={() => setSelectedMood(mood.label)}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <FontAwesomeIcon icon={mood.icon} />
                    {mood.label}
                  </span>
                </Button>
              ))}
            </div>
          </SelectionSection>

          <SelectionSection title="Select a tone" className="mt-8">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TONES.map((tone) => (
                <Button
                  key={tone.label}
                  type="button"
                  variant="selection"
                  active={selectedTone === tone.label}
                  size="lg"
                  fullWidth
                  onClick={() => setSelectedTone(tone.label)}
                >
                  {tone.label}
                </Button>
              ))}
            </div>
          </SelectionSection>

          <Button
            variant="indigo"
            size="lg"
            fullWidth
            type="button"
            className="mt-8"
            onClick={handleEnhanceClick}
          >
            Enhance with chosen mood &amp; tone
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-white/10">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Mood &amp; tone
        </h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Make your message sound exactly right.
        </p>
      </div>
      <Button variant="ghost" size="sm" type="button" onClick={onClose} aria-label="Close">
        ✕
      </Button>
    </div>
  );
}

function Divider({ text }: { text: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {text}
      </div>
      <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
    </div>
  );
}

interface SelectionSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

function SelectionSection({ title, children, className = "" }: SelectionSectionProps) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-3">
        <span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-indigo-600 to-purple-600" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-gray-100">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
