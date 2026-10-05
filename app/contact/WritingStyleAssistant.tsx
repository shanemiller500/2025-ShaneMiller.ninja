"use client";

import { trackEvent } from "@/utils/mixpanel";
import { PenLine } from "lucide-react";
import AssistantModalShell from "./AssistantModalShell";

interface Style {
  name: string;
}

interface WritingStyleAssistantProps {
  currentDescription: string;
  updateDescription: (text: string) => void;
  setPopupMessageWithTimeout: (message: string) => void;
  setShowWritingStyleModal: (show: boolean) => void;
  enhanceTextWithStyle: (text: string, style: string) => Promise<string>;
}

const WRITING_STYLES: Style[] = [
  { name: "Descriptive" },
  { name: "Analytical" },
  { name: "Poetic" },
  { name: "Innovative" },
  { name: "Inclusive" },
  { name: "Creative" },
  { name: "Empathetic" },
  { name: "Energetic" },
  { name: "Narrative" },
  { name: "Engaging" },
  { name: "Inspirational" },
  { name: "Optimistic" },
  { name: "Visionary" },
  { name: "Motivational" },
  { name: "Persuasive" },
  { name: "Witty" },
  { name: "Insightful" },
];

export default function WritingStyleAssistant({
  currentDescription,
  updateDescription,
  setPopupMessageWithTimeout,
  setShowWritingStyleModal,
  enhanceTextWithStyle,
}: WritingStyleAssistantProps) {
  async function handleStyleSelect(style: Style) {
    setShowWritingStyleModal(false);

    if (!currentDescription.trim()) {
      setPopupMessageWithTimeout("Add some text to enhance!");
      return;
    }

    trackEvent("Writing Style Selected", { style: style.name });
    const enhancedText = await enhanceTextWithStyle(currentDescription, style.name);
    if (enhancedText) {
      updateDescription(enhancedText);
    }
  }

  return (
    <AssistantModalShell
      title="Writing style"
      description="Pick a style to give your draft a new direction."
      icon={<PenLine className="h-4 w-4" />}
      onClose={() => setShowWritingStyleModal(false)}
    >
      <div className="max-h-[390px] overflow-y-auto pr-1">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {WRITING_STYLES.map((style) => (
            <li key={style.name}>
              <button
                type="button"
                className="contact-assistant-choice flex min-h-12 w-full items-center gap-2 rounded-xl border border-slate-200/80 bg-white/40 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-300 dark:hover:border-indigo-400/20 dark:hover:bg-indigo-400/[0.06] dark:hover:text-indigo-200"
                onClick={() => handleStyleSelect(style)}
              >
                <PenLine className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                <span className="min-w-0 break-words">{style.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AssistantModalShell>
  );
}
