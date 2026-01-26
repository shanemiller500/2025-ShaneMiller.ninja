"use client";

import { trackEvent } from "@/utils/mixpanel";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenNib } from "@fortawesome/free-solid-svg-icons";

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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Select Writing Style"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setShowWritingStyleModal(false);
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-brand-900">
        <ModalHeader onClose={() => setShowWritingStyleModal(false)} />

        <div className="p-5">
          <div className="mt-4 max-h-[320px] overflow-y-auto pr-1">
            <ul className="space-y-2">
              {WRITING_STYLES.map((style) => (
                <li key={style.name}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
                    onClick={() => handleStyleSelect(style)}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
                      <FontAwesomeIcon icon={faPenNib} className="text-gray-700 dark:text-gray-200" />
                    </span>
                    <span className="flex-1">{style.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
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
          Select writing style
        </h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Pick a vibe. We'll rewrite the message.
        </p>
      </div>
      <button
        type="button"
        className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 dark:text-gray-200 dark:hover:bg-white/10"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}
