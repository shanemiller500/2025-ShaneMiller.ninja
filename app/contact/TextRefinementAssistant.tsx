// TextRefinementAssistant.tsx
'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagic, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { trackEvent } from '@/utils/mixpanel';

interface TextRefinementAssistantProps {
  setPopupMessageWithTimeout: (message: string) => void;
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
  // For controlled textarea replacement:
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
  // Get the highlighted text from the controlled textarea (if available), or fallback.
  const getHighlightedText = (): string => {
    if (textAreaSelectionRef.current) {
      const { start, end } = textAreaSelectionRef.current;
      return currentDescription.substring(start, end);
    } else {
      return window.getSelection()?.toString() || '';
    }
  };

  // Replace the highlighted text.
  const replaceSelectedText = (replacementText: string): void => {
    if (textAreaSelectionRef.current) {
      const { start, end } = textAreaSelectionRef.current;
      const newValue =
        currentDescription.substring(0, start) +
        replacementText +
        currentDescription.substring(end);
      updateDescription(newValue);
      // Clear the stored selection.
      textAreaSelectionRef.current = null;
      // Also clear any browser selection.
      window.getSelection()?.removeAllRanges();
    } else {
      // Fallback: if selection is not in a controlled textarea.
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(replacementText));
        // Clear the selection after insertion.
        window.getSelection()?.removeAllRanges();
      }
    }
  };

  // Call the API and replace the highlighted text.
  const fetchTextRefinement = async (): Promise<void> => {
    trackEvent('Text Refinement Clicked');
    const text = getHighlightedText();
    if (!text.trim()) {
      setPopupMessageWithTimeout('Please highlight some text to refine.');
      return;
    }
    setGlobalLoading(true);
    try {
      const response = await fetch('https://u-mail.co/api/text-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Remove any leading/trailing double quotes from the returned text.
      const rawText: string = data.refinedText || 'No refinements found.';
      const cleanedText = rawText.replace(/^"+|"+$/g, '');
      // Replace the highlighted text with the cleaned refined text.
      replaceSelectedText(cleanedText);
    } catch (error) {
      console.error('Error refining text:', error);
      setPopupMessageWithTimeout('Error refining text.');
    } finally {
      setGlobalLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={fetchTextRefinement}
      disabled={globalLoading}
      className="btn btn-outline-primary btn-sm get-in-touch px-4 py-2 rounded border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {globalLoading ? (
        <>
          <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
          Refining...
        </>
      ) : (
        <>
          <FontAwesomeIcon icon={faMagic} className="mr-2" />
          <span className="hidden sm:inline">Text Refine</span>
        </>
      )}
    </button>
  );
};

export default TextRefinementAssistant;
