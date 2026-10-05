"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagic, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { trackEvent } from "@/utils/mixpanel";

interface TextRefinementAssistantProps {
  setPopupMessageWithTimeout: (message: string) => void;
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
  currentDescription: string;
  updateDescription: (newDescription: string) => void;
  textAreaSelectionRef: React.MutableRefObject<{ start: number; end: number } | null>;
}

export default function TextRefinementAssistant({
  setPopupMessageWithTimeout,
  globalLoading,
  setGlobalLoading,
  currentDescription,
  updateDescription,
  textAreaSelectionRef,
}: TextRefinementAssistantProps) {
  function getHighlightedText(): string {
    if (textAreaSelectionRef.current) {
      const { start, end } = textAreaSelectionRef.current;
      return currentDescription.substring(start, end);
    }
    return window.getSelection()?.toString() || "";
  }

  function replaceSelectedText(replacementText: string): void {
    if (textAreaSelectionRef.current) {
      const { start, end } = textAreaSelectionRef.current;
      const newValue =
        currentDescription.substring(0, start) +
        replacementText +
        currentDescription.substring(end);
      updateDescription(newValue);
      textAreaSelectionRef.current = null;
      window.getSelection()?.removeAllRanges();
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(replacementText));
      window.getSelection()?.removeAllRanges();
    }
  }

  async function handleRefineClick(): Promise<void> {
    trackEvent("Text Refinement Clicked");
    const text = getHighlightedText();

    if (!text.trim()) {
      setPopupMessageWithTimeout("Please highlight some text to refine.");
      return;
    }

    setGlobalLoading(true);

    try {
      const response = await fetch("https://u-mail.co/api/text-refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const rawText: string = data.refinedText || "No refinements found.";
      const cleanedText = rawText.replace(/^"+|"+$/g, "");
      replaceSelectedText(cleanedText);
    } catch (error) {
      console.error("Error refining text:", error);
      setPopupMessageWithTimeout("Error refining text.");
    } finally {
      setGlobalLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRefineClick}
      disabled={globalLoading}
      className="contact-tool inline-flex min-h-12 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200/80 bg-white/60 px-3 py-3 text-xs font-medium text-gray-800 shadow-none transition-colors duration-300 motion-reduce:transition-none hover:border-indigo-300 hover:bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.025] dark:text-gray-100 dark:hover:bg-white/[0.06]"
      aria-label="Refine selected text"
    >
      {globalLoading ? (
        <>
          <FontAwesomeIcon icon={faSpinner} spin className="text-indigo-500 dark:text-indigo-300" />
          Refining…
        </>
      ) : (
        <>
          <FontAwesomeIcon icon={faMagic} className="text-indigo-500 dark:text-indigo-300" />
          <span>Text Refine</span>
        </>
      )}
    </button>
  );
}
