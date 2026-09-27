"use client";

import { useState } from "react";
import {
  Angry,
  CircleAlert,
  CircleMinus,
  Frown,
  PartyPopper,
  Smile,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { trackEvent } from "@/utils/mixpanel";
import AssistantModalShell from "./AssistantModalShell";

interface MoodToneAssistantProps {
  currentText: string;
  onEnhance: (mood: string, tone: string) => void;
  onDefaultEnhance: () => void;
  onClose: () => void;
}

const MOODS = [
  { label: "Neutral", icon: CircleMinus },
  { label: "Happy", icon: Smile },
  { label: "Sad", icon: Frown },
  { label: "Angry", icon: Angry },
  { label: "Excited", icon: PartyPopper },
  { label: "Concerned", icon: CircleAlert },
];
const TONES = ["Formal", "Informal", "Friendly", "Serious", "Humorous", "Respectful"];

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
    <AssistantModalShell
      title="Mood & tone"
      icon={<Sparkles className="h-4 w-4" />}
      onClose={onClose}
      size="lg"
    >
      <button
        type="button"
        onClick={handleDefaultEnhanceClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/70 bg-indigo-50/50 px-4 py-2.5 text-xs font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-400/15 dark:bg-indigo-400/[0.05] dark:text-indigo-200 dark:hover:bg-indigo-400/[0.08]"
      >
        <WandSparkles className="h-4 w-4" />
        Auto polish
      </button>

      <SelectionSection title="Mood">
        {MOODS.map((mood) => (
          <ChoiceButton
            key={mood.label}
            label={mood.label}
            icon={<mood.icon className="h-3.5 w-3.5" />}
            active={selectedMood === mood.label}
            onClick={() => setSelectedMood(mood.label)}
          />
        ))}
      </SelectionSection>

      <SelectionSection title="Tone">
        {TONES.map((tone) => (
          <ChoiceButton
            key={tone}
            label={tone}
            active={selectedTone === tone}
            onClick={() => setSelectedTone(tone)}
          />
        ))}
      </SelectionSection>

      <button
        type="button"
        className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-medium text-white transition hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-white dark:text-slate-950 dark:hover:bg-indigo-300"
        onClick={handleEnhanceClick}
      >
        Apply
      </button>
    </AssistantModalShell>
  );
}

interface SelectionSectionProps {
  title: string;
  children: React.ReactNode;
}

function SelectionSection({ title, children }: SelectionSectionProps) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
        {title}
      </h3>
      <div className="grid grid-cols-3 gap-2">{children}</div>
    </div>
  );
}

function ChoiceButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        active
          ? "border-indigo-500 bg-indigo-500 text-white"
          : "border-slate-200/80 bg-white/40 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-300 dark:hover:border-indigo-400/20 dark:hover:text-indigo-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
