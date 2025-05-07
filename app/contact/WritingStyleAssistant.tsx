'use client';

import React from 'react';
import { trackEvent } from '@/utils/mixpanel';

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

const styles: Style[] = [
  { name: 'Descriptive' },
  { name: 'Analytical' },
  { name: 'Poetic' },
  { name: 'Innovative' },
  { name: 'Inclusive' },
  { name: 'Creative' },
  { name: 'Empathetic' },
  { name: 'Energetic' },
  { name: 'Narrative' },
  { name: 'Engaging' },
  { name: 'Inspirational' },
  { name: 'Optimistic' },
  { name: 'Visionary' },
  { name: 'Motivational' },
  { name: 'Persuasive' },
  { name: 'Witty' },
  { name: 'Insightful' },
];

const WritingStyleAssistant: React.FC<WritingStyleAssistantProps> = ({
  currentDescription,
  updateDescription,
  setPopupMessageWithTimeout,
  setShowWritingStyleModal,
  enhanceTextWithStyle,
}) => {

  const handleStyleChange = async (style: Style) => {
    // Close the modal immediately.
    setShowWritingStyleModal(false);
    if (!currentDescription.trim()) {
      setPopupMessageWithTimeout("Add some text to enhance!");
      return;
    }
    // Log the event and call the parent's API function.
    trackEvent('Writing Style Selected', { style: style.name });
    const enhancedText = await enhanceTextWithStyle(currentDescription, style.name);
    if (enhancedText) {
      updateDescription(enhancedText);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-brand-900 rounded p-6 w-full max-w-md">
        <div className="flex justify-end">
          <button
            type="button"
            className="text-gray-700 dark:text-gray-300 text-2xl"
            aria-label="Close"
            onClick={() => setShowWritingStyleModal(false)}
          >
            &times;
          </button>
        </div>
        <h2 className="text-xl font-semibold mb-4 text-center">Select Writing Style</h2>
        <div className="max-h-64 overflow-y-auto">
          <ul className="space-y-2">
            {styles.map((style, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="flex items-center w-full p-2 bg-gray-200 dark:bg-brand-900 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  onClick={() => handleStyleChange(style)}
                >
                  {style.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
  
};

export default WritingStyleAssistant;
