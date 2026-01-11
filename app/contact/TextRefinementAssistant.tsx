// app/contact/TextRefinementAssistant.tsx
"use client";

import React from "react";
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

const TextRefinementAssistant: React.FC<TextRefinementAssistantProps> = ({
  setPopupMessageWithTimeout,
  globalLoading,
  setGlobalLoading,
  currentDescription,
  updateDescription,
  textAreaSelectionRef,
}) => {
  const getHighlightedText = (): string => {
    if (textAreaSelectionRef.current) {
      const { start, end } = textAreaSelectionRef.current;
      return currentDescription.substring(start, end);
    }
    return window.getSelection()?.toString() || "";
  };

  const replaceSelectedText = (replacementText: string): void => {
    if (textAreaSelectionRef.current) {
      const { start, end } = textAreaSelectionRef.current;
      const newValue = currentDescription.substring(0, start) + replacementText + currentDescription.substring(end);
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
  };

  const fetchTextRefinement = async (): Promise<void> => {
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
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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
  };

  return (
    <button
      type="button"
      onClick={fetchTextRefinement}
      disabled={globalLoading}
      className={
  "inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border " +
  "border-gray-200 dark:border-white/10 " +
  "bg-white/70 dark:bg-white/5 " +
  "px-3 py-2 text-xs sm:text-sm font-medium " +
  "text-gray-800 dark:text-gray-100 " +
  "hover:bg-gray-50 dark:hover:bg-white/10 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/60 " +
  "transition disabled:opacity-50 disabled:cursor-not-allowed"
}
      aria-label="Refine selected text"
    >
      {globalLoading ? (
        <>
          <FontAwesomeIcon icon={faSpinner} spin />
          Refining…
        </>
      ) : (
        <>
          <FontAwesomeIcon icon={faMagic} />
          <span>Text Refine</span>
        </>
      )}
    </button>
  );
};

export default TextRefinementAssistant;
